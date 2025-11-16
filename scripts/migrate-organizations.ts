/**
 * Script de migration pour préparer la multi-tenance.
 * ⚠️ DESTRUCTIF : supprime toutes les données métiers avant de recréer une organisation par utilisateur.
 *
 * Usage :
 *   CONFIRM_MULTI_TENANT_RESET=true npx ts-node scripts/migrate-organizations.ts --force
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const FORCE_FLAG = '--force';
const ENV_FLAG = 'CONFIRM_MULTI_TENANT_RESET';

const purgeOrder: Array<keyof PrismaClient> = [
  'documentLink',
  'documentField',
  'documentTextIndex',
  'document',
  'transaction',
  'paymentAttachment',
  'payment',
  'uploadStagedItem',
  'uploadSession',
  'reminder',
  'echeanceRecurrente',
  'loan',
  'photo',
  'occupancyHistory',
  'leaseVersion',
  'lease',
  'tenant',
  'property',
  'fiscalSimulation',
  'taxSourceSnapshot',
  'taxSourceConfig',
  // Tables utilisateurs (doivent être supprimées après les données métier)
  'account',
  'session',
  'verificationToken',
  'userProfile',
  'user',
  'organization',
];

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40) || 'organisation';
}

async function purgeAllTenantData() {
  console.log('🧹 Purge des données multi-tenant...');
  for (const modelKey of purgeOrder) {
    const model = (prisma as any)[modelKey];
    if (!model?.deleteMany) {
      console.warn(`  - ${modelKey}: modèle introuvable, ignoré`);
      continue;
    }
    try {
      const result = await model.deleteMany({});
      console.log(`  - ${modelKey}: ${result.count} lignes supprimées`);
    } catch (error) {
      console.error(`  - ${modelKey}: échec de la suppression`, error);
      throw error;
    }
  }
}

async function createOrganizationsForUsers() {
  console.log('🏗️  Création des organisations par utilisateur...');
  
  // Recréer l'organisation par défaut
  try {
    await prisma.organization.create({
      data: {
        id: 'default',
        name: 'Organisation par défaut',
        slug: 'default',
      },
    });
    console.log('  ✅ Organisation par défaut créée');
  } catch (error: any) {
    if (error.code !== 'P2002') {
      throw error;
    }
    console.log('  ⏭️  Organisation par défaut existe déjà');
  }
  
  // Si on veut recréer des utilisateurs, il faudrait les recréer ici
  // Pour l'instant, on ne crée pas d'utilisateurs automatiquement
  console.log('  ℹ️  La base est maintenant vide. Créez de nouveaux utilisateurs via l\'interface d\'authentification.');
}

async function main() {
  if (!process.argv.includes(FORCE_FLAG)) {
    console.error(`❌ Ajoutez l'argument ${FORCE_FLAG} pour exécuter ce script.`);
    process.exit(1);
  }

  if (process.env[ENV_FLAG] !== 'true') {
    console.error(`❌ Définissez ${ENV_FLAG}=true pour confirmer la suppression.`);
    process.exit(1);
  }

  await purgeAllTenantData();
  await createOrganizationsForUsers();

  console.log('\n✅ Migration terminée. Base de données complètement nettoyée.');
  console.log('📝 Les nouveaux utilisateurs auront automatiquement leur organisation créée.');
  console.log('🔒 Toutes les nouvelles données seront isolées par organisation.\n');
}

main()
  .catch((error) => {
    console.error('❌ Migration échouée:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

