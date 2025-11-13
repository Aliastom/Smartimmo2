import { prisma } from '@/lib/prisma';

/**
 * Script pour corriger les documents orphelins (sans liens DocumentLink)
 */
async function main() {
  console.log('🔍 Recherche des documents orphelins...\n');
  
  try {
    // 1. Trouver tous les documents actifs
    const allDocuments = await prisma.document.findMany({
      where: { status: 'active' },
      select: { 
        id: true, 
        filenameOriginal: true, 
        documentType: { select: { code: true, label: true } },
        uploadedAt: true
      }
    });
    
    console.log(`📄 ${allDocuments.length} documents actifs trouvés`);
    
    // 2. Trouver les documents qui ont des liens
    const documentsWithLinks = await prisma.documentLink.findMany({
      select: { documentId: true },
      distinct: ['documentId']
    });
    
    const linkedDocumentIds = new Set(documentsWithLinks.map(d => d.documentId));
    
    // 3. Identifier les documents orphelins
    const orphanedDocuments = allDocuments.filter(doc => !linkedDocumentIds.has(doc.id));
    
    console.log(`🔗 ${documentsWithLinks.length} documents avec des liens`);
    console.log(`❌ ${orphanedDocuments.length} documents orphelins trouvés\n`);
    
    if (orphanedDocuments.length === 0) {
      console.log('✅ Aucun document orphelin !');
      return;
    }
    
    // 4. Afficher les documents orphelins
    console.log('📋 Documents orphelins :');
    orphanedDocuments.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.filenameOriginal}`);
      console.log(`     Type: ${doc.documentType?.label || 'Non classé'} (${doc.documentType?.code || 'N/A'})`);
      console.log(`     Uploadé: ${doc.uploadedAt.toLocaleDateString('fr-FR')}`);
      console.log(`     ID: ${doc.id}`);
      console.log('');
    });
    
    // 5. Proposer de créer des liens GLOBAL pour les documents orphelins
    console.log('🔧 Solution : Créer des liens GLOBAL pour ces documents...');
    
    let createdLinks = 0;
    for (const doc of orphanedDocuments) {
      try {
        // Vérifier si un lien GLOBAL existe déjà
        const existingGlobalLink = await prisma.documentLink.findUnique({
          where: {
            documentId_linkedType_linkedId: {
              documentId: doc.id,
              linkedType: 'global',
              linkedId: 'global'
            }
          }
        });
        
        if (!existingGlobalLink) {
          await prisma.documentLink.create({
            data: {
              documentId: doc.id,
              linkedType: 'global',
              linkedId: 'global'
            }
          });
          createdLinks++;
          console.log(`✅ Lien GLOBAL créé pour: ${doc.filenameOriginal}`);
        } else {
          console.log(`⏭️  Lien GLOBAL déjà existant pour: ${doc.filenameOriginal}`);
        }
      } catch (error) {
        console.error(`❌ Erreur pour ${doc.filenameOriginal}:`, error);
      }
    }
    
    console.log(`\n🎉 ${createdLinks} liens GLOBAL créés !`);
    console.log('\n📝 Les documents devraient maintenant apparaître dans la page Documents.');
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la correction:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
