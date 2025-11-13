/**
 * Script de migration - Typer automatiquement les biens existants
 * Affecte fiscalTypeId et fiscalRegimeId selon les anciennes colonnes
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Migration des types et régimes fiscaux pour les biens existants...\n');

  // ========== BACKUP CSV AVANT MIGRATION ==========
  
  console.log('💾 Création du backup CSV...');
  
  const properties = await prisma.property.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      fiscalTypeId: true,
      fiscalRegimeId: true,
    },
  });

  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `properties-before-fiscal-migration-${timestamp}.csv`);

  const csvHeader = 'id,name,type,fiscalTypeId,fiscalRegimeId\n';
  const csvRows = properties.map(
    (p) =>
      `${p.id},"${p.name}",${p.type},${p.fiscalTypeId || ''},${p.fiscalRegimeId || ''}`
  );
  const csvContent = csvHeader + csvRows.join('\n');

  fs.writeFileSync(backupPath, csvContent);
  console.log(`   ✅ Backup créé: ${backupPath}\n`);

  // ========== MIGRATION DES TYPES ET RÉGIMES ==========

  let updated = 0;
  let skipped = 0;
  let notClassified: any[] = [];

  for (const property of properties) {
    // Si déjà typé, on skip
    if (property.fiscalTypeId && property.fiscalRegimeId) {
      skipped++;
      continue;
    }

    let fiscalTypeId: string | null = null;
    let fiscalRegimeId: string | null = null;

    // ========== MAPPING SELON L'ANCIEN TYPE ==========

    switch (property.type.toLowerCase()) {
      case 'apartment':
      case 'house':
      case 'studio':
      case 'duplex':
      case 'loft':
        // Location nue par défaut
        fiscalTypeId = 'NU';
        fiscalRegimeId = 'REEL'; // Par défaut régime réel (plus avantageux souvent)
        break;

      case 'meuble':
      case 'furnished':
      case 'colocation':
        // Location meublée
        fiscalTypeId = 'MEUBLE';
        fiscalRegimeId = 'MICRO_BIC'; // Par défaut micro-BIC
        break;

      case 'sci':
      case 'commercial':
        // SCI à l'IS
        fiscalTypeId = 'SCI_IS';
        fiscalRegimeId = 'IS_NORMAL';
        break;

      default:
        // Type non reconnu, on le log pour traitement manuel
        notClassified.push({
          id: property.id,
          name: property.name,
          type: property.type,
        });
        continue;
    }

    // Mettre à jour le bien
    await prisma.property.update({
      where: { id: property.id },
      data: {
        fiscalTypeId,
        fiscalRegimeId,
      },
    });

    updated++;
    console.log(`✅ ${property.name} → ${fiscalTypeId} / ${fiscalRegimeId}`);
  }

  // ========== RÉSUMÉ ==========

  console.log('\n✨ Migration terminée !');
  console.log(`\n📊 Statistiques :`);
  console.log(`   - ${updated} bien(s) mis à jour`);
  console.log(`   - ${skipped} bien(s) déjà typés (ignorés)`);
  console.log(`   - ${notClassified.length} bien(s) non classifiés`);

  if (notClassified.length > 0) {
    console.log('\n⚠️  Biens non classifiés (à traiter manuellement) :');
    notClassified.forEach((p) => {
      console.log(`   - ${p.name} (${p.id}) - Type: "${p.type}"`);
    });

    // Sauvegarder dans un fichier
    const notClassifiedPath = path.join(backupDir, `not-classified-${timestamp}.json`);
    fs.writeFileSync(notClassifiedPath, JSON.stringify(notClassified, null, 2));
    console.log(`\n   📄 Liste sauvegardée dans: ${notClassifiedPath}`);
  }

  console.log('\n💾 Backup disponible: ' + backupPath);
  console.log('\n✅ Vous pouvez maintenant vérifier les biens dans l\'admin !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors de la migration:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

