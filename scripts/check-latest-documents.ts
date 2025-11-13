import { prisma } from '@/lib/prisma';

async function main() {
  try {
    console.log('=== DERNIERS DOCUMENTS ===\n');
    
    const docs = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        links: true,
        documentType: {
          select: {
            label: true,
            code: true
          }
        }
      }
    });
    
    docs.forEach((doc, i) => {
      console.log(`${i+1}. ${doc.filename}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Type: ${doc.documentType?.label || 'Non classé'} (${doc.documentType?.code || 'N/A'})`);
      console.log(`   Liens: ${doc.links.length}`);
      doc.links.forEach(link => {
        console.log(`     - ${link.linkedType}: ${link.linkedId}`);
      });
      console.log(`   Créé: ${doc.createdAt.toISOString()}`);
      console.log('');
    });
    
    console.log(`Total: ${docs.length} documents récents\n`);
    
    // Vérifier les documents sans liens
    const docsWithoutLinks = await prisma.document.findMany({
      where: {
        links: {
          none: {}
        }
      },
      include: {
        documentType: {
          select: {
            label: true,
            code: true
          }
        }
      }
    });
    
    if (docsWithoutLinks.length > 0) {
      console.log('=== DOCUMENTS SANS LIENS ===\n');
      docsWithoutLinks.forEach((doc, i) => {
        console.log(`${i+1}. ${doc.filename} (${doc.status}) - Type: ${doc.documentType?.label || 'Non classé'}`);
      });
      console.log(`\nTotal: ${docsWithoutLinks.length} documents sans liens\n`);
    }
    
    // Vérifier les documents avec liens global
    const docsWithGlobalLinks = await prisma.document.findMany({
      where: {
        links: {
          some: {
            linkedType: 'global'
          }
        }
      },
      include: {
        links: true,
        documentType: {
          select: {
            label: true,
            code: true
          }
        }
      }
    });
    
    console.log('=== DOCUMENTS AVEC LIENS GLOBAL ===\n');
    docsWithGlobalLinks.forEach((doc, i) => {
      console.log(`${i+1}. ${doc.filename} (${doc.status}) - ${doc.links.length} liens`);
    });
    console.log(`\nTotal: ${docsWithGlobalLinks.length} documents avec liens global\n`);
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
