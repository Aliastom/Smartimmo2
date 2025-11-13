import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('📦 Sauvegarde des données DocumentLink...\n');
  
  // 1. Extraire les données existantes
  const existingLinks = await prisma.$queryRawUnsafe<Array<{
    id: string;
    documentId: string;
    targetType: string;
    targetId: string | null;
  }>>(`SELECT id, documentId, targetType, targetId FROM DocumentLink`);
  
  console.log(`✅ ${existingLinks.length} liens extraits`);
  console.log('\n📝 Aperçu des données:');
  existingLinks.slice(0, 5).forEach(link => {
    console.log(`  - Doc: ${link.documentId.substring(0, 8)}... → ${link.targetType}/${link.targetId?.substring(0, 8) || 'null'}`);
  });
  
  // 2. Sauvegarder dans un fichier JSON
  const backupPath = `prisma/documentlink-backup-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(existingLinks, null, 2));
  console.log(`\n💾 Sauvegarde créée: ${backupPath}`);
  
  // 3. Transformer les données pour la nouvelle structure
  const transformedLinks = existingLinks.map(link => ({
    documentId: link.documentId,
    linkedType: link.targetType.toLowerCase(),
    linkedId: link.targetId || link.targetType // Si targetId est null (cas GLOBAL), utiliser targetType
  }));
  
  console.log('\n🔄 Données transformées:');
  transformedLinks.slice(0, 5).forEach(link => {
    console.log(`  - Doc: ${link.documentId.substring(0, 8)}... → ${link.linkedType}/${link.linkedId.substring(0, 8)}...`);
  });
  
  // Sauvegarder aussi les données transformées
  const transformedPath = `prisma/documentlink-transformed-${Date.now()}.json`;
  fs.writeFileSync(transformedPath, JSON.stringify(transformedLinks, null, 2));
  console.log(`\n💾 Données transformées sauvegardées: ${transformedPath}`);
  
  console.log('\n✅ Export terminé !');
  console.log('\n⚠️  Vous pouvez maintenant lancer:');
  console.log('   npx prisma db push --force-reset --skip-generate');
  console.log('   puis réimporter avec le script restore-documentlink-data.ts');
  
  await prisma.$disconnect();
}

main().catch(console.error);

