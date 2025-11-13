import { prisma } from '@/lib/prisma';

async function main() {
  try {
    console.log('🔧 Correction des liens GLOBAL manquants...\n');
    
    // Trouver tous les documents actifs sans lien GLOBAL
    const docsWithoutGlobal = await prisma.document.findMany({
      where: {
        status: 'active',
        links: {
          none: {
            linkedType: 'global'
          }
        }
      },
      include: {
        links: true
      }
    });
    
    console.log(`📄 ${docsWithoutGlobal.length} documents actifs sans lien GLOBAL:`);
    docsWithoutGlobal.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.filenameOriginal}`);
      console.log(`      Liens actuels: ${doc.links.map(l => l.linkedType).join(', ')}`);
    });
    
    let addedCount = 0;
    for (const doc of docsWithoutGlobal) {
      try {
        await prisma.documentLink.create({
          data: {
            documentId: doc.id,
            linkedType: 'global',
            linkedId: 'global'
          }
        });
        console.log(`✅ Lien GLOBAL ajouté à: ${doc.filenameOriginal}`);
        addedCount++;
      } catch (error: any) {
        if (error.code === 'P2002') {
          console.log(`⏭️  Lien GLOBAL déjà existant pour: ${doc.filenameOriginal}`);
        } else {
          console.error(`❌ Erreur pour ${doc.filenameOriginal}:`, error.message);
        }
      }
    }
    
    console.log(`\n🎉 ${addedCount} liens GLOBAL ajoutés !`);
    
    // Vérification finale
    const totalGlobalLinks = await prisma.documentLink.count({
      where: { linkedType: 'global' }
    });
    console.log(`📊 Total des liens GLOBAL: ${totalGlobalLinks}`);
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
