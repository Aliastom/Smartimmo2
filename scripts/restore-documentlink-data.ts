import { prisma } from '@/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('📥 Restauration des données DocumentLink...\n');
  
  // 1. Trouver le fichier de sauvegarde le plus récent
  const prismaDir = path.join(process.cwd(), 'prisma');
  const files = fs.readdirSync(prismaDir);
  const transformedFiles = files.filter(f => f.startsWith('documentlink-transformed-'));
  
  if (transformedFiles.length === 0) {
    console.error('❌ Aucun fichier de sauvegarde trouvé !');
    return;
  }
  
  const latestFile = transformedFiles.sort().reverse()[0];
  const filePath = path.join(prismaDir, latestFile);
  
  console.log(`📂 Fichier trouvé: ${latestFile}`);
  
  // 2. Charger les données
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Array<{
    documentId: string;
    linkedType: string;
    linkedId: string;
  }>;
  
  console.log(`✅ ${data.length} liens à restaurer\n`);
  
  // 3. Insérer les données une par une
  let successCount = 0;
  let skipCount = 0;
  
  for (const link of data) {
    try {
      // Vérifier si le lien existe déjà
      const existing = await prisma.documentLink.findUnique({
        where: {
          documentId_linkedType_linkedId: {
            documentId: link.documentId,
            linkedType: link.linkedType,
            linkedId: link.linkedId
          }
        }
      });
      
      if (!existing) {
        await prisma.documentLink.create({ data: link });
        successCount++;
        console.log(`✅ Créé: ${link.linkedType}/${link.linkedId.substring(0, 8)}...`);
      } else {
        skipCount++;
        console.log(`⏭️  Déjà existant: ${link.linkedType}/${link.linkedId.substring(0, 8)}...`);
      }
    } catch (error: any) {
      console.error(`❌ Erreur pour ${link.linkedType}/${link.linkedId}:`, error.message);
    }
  }
  
  console.log(`\n📊 Résumé:`);
  console.log(`   ✅ ${successCount} liens créés`);
  console.log(`   ⏭️  ${skipCount} liens déjà existants`);
  console.log(`   ❌ ${data.length - successCount - skipCount} erreurs`);
  
  // 4. Vérification finale
  const finalCount = await prisma.documentLink.count();
  console.log(`\n🎯 Total des liens dans la base: ${finalCount}`);
  
  console.log('\n✅ Restauration terminée !');
  
  await prisma.$disconnect();
}

main().catch(console.error);

