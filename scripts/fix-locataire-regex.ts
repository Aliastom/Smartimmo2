/**
 * Script pour corriger la regex locataire dans RELEVE_COMPTE_PROP
 * Le problème : la regex ne détecte pas les locataires avec Mme/M./Mlle
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Correction de la regex locataire pour RELEVE_COMPTE_PROP...\n');

  // 1. Récupérer la configuration actuelle
  const docType = await prisma.documentType.findUnique({
    where: { code: 'RELEVE_COMPTE_PROP' },
    select: {
      code: true,
      suggestionsConfig: true,
    },
  });

  if (!docType) {
    console.error('❌ Type de document RELEVE_COMPTE_PROP non trouvé');
    return;
  }

  console.log('📋 Configuration actuelle :');
  console.log(JSON.stringify(docType.suggestionsConfig, null, 2));
  console.log('\n');

  // 2. Parser la configuration (elle est stockée comme string JSON)
  const config = typeof docType.suggestionsConfig === 'string' 
    ? JSON.parse(docType.suggestionsConfig)
    : docType.suggestionsConfig;
  
  if (!config.regex) {
    config.regex = {};
  }

  console.log('🔍 Regex locataire actuelle :');
  console.log(config.regex.locataire || 'AUCUNE');
  console.log('\n');

  // Regex améliorée pour détecter les locataires :
  // - Supporte M./Mme/Mlle/Mr/Monsieur/Madame
  // - Nom en majuscules ou minuscules (mixte aussi)
  // - Avec ou sans virgule après
  // - Détecte jusqu'au "(" qui précède "entrée"
  config.regex.locataire = "(?:M\\.|Mme|Mlle|Mr|Monsieur|Madame)[\\s,]+([A-ZÉÈÀÙÂÊÎÔÛÇa-zéèàùâêîôûç]+(?:[\\s-][A-ZÉÈÀÙÂÊÎÔÛÇa-zéèàùâêîôûç]+)*?)\\s*\\(entr";

  // Ajouter le locataire au mapping si pas déjà présent
  if (!config.mapping) {
    config.mapping = {};
  }

  console.log('✅ Nouvelle regex locataire :');
  console.log(config.regex.locataire);
  console.log('\n');

  // 3. Mettre à jour en base (convertir en string JSON)
  await prisma.documentType.update({
    where: { code: 'RELEVE_COMPTE_PROP' },
    data: {
      suggestionsConfig: JSON.stringify(config),
    },
  });

  console.log('✅ Configuration mise à jour avec succès !');
  console.log('\n');

  // 4. Vérifier la mise à jour
  const updated = await prisma.documentType.findUnique({
    where: { code: 'RELEVE_COMPTE_PROP' },
    select: {
      suggestionsConfig: true,
    },
  });

  console.log('📋 Configuration après mise à jour :');
  console.log(JSON.stringify((updated?.suggestionsConfig as any)?.regex?.locataire, null, 2));
}

main()
  .catch((e) => {
    console.error('❌ Erreur :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

