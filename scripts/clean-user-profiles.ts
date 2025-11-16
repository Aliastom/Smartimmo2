/**
 * Suppression des profils utilisateurs avant migration
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Suppression des profils utilisateurs...\n');

  const deleted = await prisma.userProfile.deleteMany({});
  console.log(`✅ ${deleted.count} profil(s) utilisateur supprimé(s)\n`);
  console.log('✨ Prêt pour la migration !\n');
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

