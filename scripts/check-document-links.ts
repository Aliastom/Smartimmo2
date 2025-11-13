import { prisma } from '@/lib/prisma';

/**
 * Script pour vérifier tous les liens DocumentLink
 */
async function main() {
  console.log('🔍 Vérification des liens DocumentLink...\n');
  
  try {
    // 1. Récupérer tous les liens
    const allLinks = await prisma.documentLink.findMany({
      include: {
        document: {
          select: {
            id: true,
            filenameOriginal: true,
            documentType: { select: { code: true, label: true } },
            status: true
          }
        }
      }
    });
    
    console.log(`📊 ${allLinks.length} liens DocumentLink trouvés\n`);
    
    if (allLinks.length === 0) {
      console.log('❌ Aucun lien trouvé !');
      return;
    }
    
    // 2. Grouper par document
    const linksByDocument = new Map();
    for (const link of allLinks) {
      if (!linksByDocument.has(link.documentId)) {
        linksByDocument.set(link.documentId, {
          document: link.document,
          links: []
        });
      }
      linksByDocument.get(link.documentId).links.push({
        linkedType: link.linkedType,
        linkedId: link.linkedId
      });
    }
    
    // 3. Afficher les résultats
    console.log('📋 Documents et leurs liens :');
    for (const [documentId, data] of linksByDocument) {
      const doc = data.document;
      console.log(`\n📄 ${doc.filenameOriginal}`);
      console.log(`   Type: ${doc.documentType?.label || 'Non classé'} (${doc.documentType?.code || 'N/A'})`);
      console.log(`   Statut: ${doc.status}`);
      console.log(`   ID: ${documentId}`);
      console.log(`   Liens (${data.links.length}):`);
      
      data.links.forEach((link, index) => {
        console.log(`     ${index + 1}. ${link.linkedType} → ${link.linkedId}`);
      });
    }
    
    // 4. Vérifier les liens GLOBAL
    const globalLinks = allLinks.filter(link => link.linkedType === 'global');
    console.log(`\n🌐 ${globalLinks.length} liens GLOBAL trouvés`);
    
    if (globalLinks.length === 0) {
      console.log('⚠️  Aucun lien GLOBAL - les documents ne seront pas visibles sur la page Documents !');
    }
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();