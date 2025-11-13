#!/usr/bin/env tsx
/**
 * Script d'ingestion des schémas Prisma
 * Introspection du schéma pour aider l'agent à comprendre les relations
 */

import { config } from 'dotenv';
import { resolve as resolvePath } from 'path';
config({ path: resolvePath(process.cwd(), '.env.local') });
config({ path: resolvePath(process.cwd(), '.env') });

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { generateEmbedding } from './embedder';
import { upsertPoints } from '../../src/lib/ai/clients/qdrant';
import type { QdrantPoint } from '../../src/lib/ai/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCHEMA_PATH = resolve(__dirname, '../../prisma/schema.prisma');
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'smartimmo_kb';

/**
 * Point d'entrée principal
 */
async function main() {
  console.log('\n🚀 Smartimmo - Ingestion des schémas Prisma\n');
  console.log('═'.repeat(60));

  const startTime = Date.now();

  try {
    // 1. Lire le schéma Prisma
    console.log('\n📄 Lecture du schéma Prisma...');
    const schema = readFileSync(SCHEMA_PATH, 'utf-8');

    // 2. Parser et chunker le schéma
    console.log('\n🔍 Parsing du schéma...');
    const chunks = parseSchema(schema);

    console.log(`\n📊 ${chunks.length} modèles/enums extraits`);

    // 3. Générer les embeddings
    console.log('\n🔢 Génération des embeddings...');
    const points = await generateEmbeddingsForChunks(chunks);

    // 4. Envoyer à Qdrant
    console.log('\n📤 Envoi vers Qdrant...');
    await upsertPoints(points, COLLECTION_NAME);

    console.log(`\n✅ Ingestion des schémas terminée !`);
    console.log(`   - ${points.length} modèles/enums ingérés`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   - Durée: ${duration}s`);
    console.log('\n' + '═'.repeat(60));
  } catch (error: any) {
    console.error('\n❌ Erreur lors de l\'ingestion:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Parse le schéma Prisma et extrait les modèles/enums
 */
function parseSchema(schema: string): any[] {
  const chunks = [];

  // Extraire les modèles (model Name { ... })
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let match;

  while ((match = modelRegex.exec(schema)) !== null) {
    const modelName = match[1];
    const modelBody = match[2];

    // Extraire les champs
    const fields = extractFields(modelBody);

    // Extraire les relations
    const relations = extractRelations(modelBody);

    // Créer un chunk descriptif
    const description = `
Modèle Prisma: ${modelName}

Champs:
${fields.map((f) => `- ${f.name}: ${f.type}${f.isOptional ? ' (optionnel)' : ''}${f.comment ? ` // ${f.comment}` : ''}`).join('\n')}

${relations.length > 0 ? `Relations:\n${relations.map((r) => `- ${r.name} → ${r.relatedModel}`).join('\n')}` : ''}

Utilisation: Ce modèle représente ${getModelDescription(modelName)}.
    `.trim();

    chunks.push({
      text: description,
      metadata: {
        type: 'schema',
        modelName,
        fields,
        relations,
      },
    });
  }

  // Extraire les enums
  const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;

  while ((match = enumRegex.exec(schema)) !== null) {
    const enumName = match[1];
    const enumBody = match[2];

    const values = enumBody
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//'));

    const description = `
Enum Prisma: ${enumName}

Valeurs possibles:
${values.map((v) => `- ${v}`).join('\n')}

Utilisation: Cet enum définit les valeurs autorisées pour ${getEnumDescription(enumName)}.
    `.trim();

    chunks.push({
      text: description,
      metadata: {
        type: 'enum',
        enumName,
        values,
      },
    });
  }

  return chunks;
}

/**
 * Extrait les champs d'un modèle
 */
function extractFields(modelBody: string): any[] {
  const fields = [];
  const lines = modelBody.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('@@') || trimmed.startsWith('//')) continue;

    // Format: fieldName Type @decorators
    const fieldMatch = /^(\w+)\s+([\w\[\]?]+)/.exec(trimmed);
    if (fieldMatch) {
      const name = fieldMatch[1];
      const type = fieldMatch[2];
      const isOptional = type.includes('?');

      fields.push({
        name,
        type: type.replace('?', '').replace('[]', ''),
        isOptional,
        comment: extractComment(line),
      });
    }
  }

  return fields;
}

/**
 * Extrait les relations d'un modèle
 */
function extractRelations(modelBody: string): any[] {
  const relations = [];
  const lines = modelBody.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('@@') || trimmed.startsWith('//')) continue;

    // Détecter les relations (champs avec type correspondant à un autre modèle)
    const relationMatch = /^(\w+)\s+(\w+)(\?|\[\])?\s+@relation/.exec(trimmed);
    if (relationMatch) {
      const name = relationMatch[1];
      const relatedModel = relationMatch[2];

      relations.push({
        name,
        relatedModel,
      });
    }
  }

  return relations;
}

/**
 * Extrait un commentaire d'une ligne
 */
function extractComment(line: string): string | undefined {
  const commentMatch = /\/\/\s*(.+)/.exec(line);
  return commentMatch ? commentMatch[1].trim() : undefined;
}

/**
 * Génère une description pour un modèle
 */
function getModelDescription(modelName: string): string {
  const descriptions: Record<string, string> = {
    Property: 'les biens immobiliers (appartements, maisons, etc.)',
    Lease: 'les baux de location',
    Tenant: 'les locataires',
    Transaction: 'les transactions financières (loyers, charges, etc.)',
    Loan: 'les prêts immobiliers',
    Document: 'les documents téléchargés (baux signés, quittances, etc.)',
    Payment: 'les paiements (ancien système)',
    Category: 'les catégories comptables',
    AiChatSession: 'les sessions de conversation avec l\'agent IA',
    AiMessage: 'les messages de conversation',
    AiToolLog: 'les logs d\'exécution des outils IA',
  };

  return descriptions[modelName] || `les entités de type ${modelName}`;
}

/**
 * Génère une description pour un enum
 */
function getEnumDescription(enumName: string): string {
  const descriptions: Record<string, string> = {
    EcheanceType: 'les types d\'échéances (prêt, copropriété, assurance, etc.)',
    Periodicite: 'la périodicité des échéances (mensuelle, trimestrielle, annuelle)',
    Role: 'les rôles utilisateur (admin, user)',
    SensEcheance: 'le sens d\'une échéance (débit ou crédit)',
    LoanRateType: 'le type de taux d\'un prêt (fixe ou variable)',
  };

  return descriptions[enumName] || `le type ${enumName}`;
}

/**
 * Génère les embeddings pour tous les chunks
 */
async function generateEmbeddingsForChunks(chunks: any[]): Promise<QdrantPoint[]> {
  const points: QdrantPoint[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Afficher progression
    if ((i + 1) % 5 === 0 || i === chunks.length - 1) {
      const percent = Math.round(((i + 1) / chunks.length) * 100);
      process.stdout.write(`\r   🔄 Progression: ${i + 1}/${chunks.length} (${percent}%)`);
    }

    // Générer embedding
    const embedding = await generateEmbedding(chunk.text);

    // Créer le point Qdrant
    points.push({
      id: randomUUID(),
      vector: embedding,
      payload: {
        text: chunk.text,
        source: 'prisma/schema.prisma',
        type: chunk.metadata.type,
        modelName: chunk.metadata.modelName,
        enumName: chunk.metadata.enumName,
        tags: ['schema', 'prisma', chunk.metadata.type],
      },
    });
  }

  console.log(''); // Nouvelle ligne après progression
  return points;
}

// Lancer le script
main();

