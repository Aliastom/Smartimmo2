import { prisma } from '@/lib/prisma';

/**
 * Script pour ajouter un lien GLOBAL à un document spécifique
 */
async function main() {
  const documentId = 'cmgy1ufzg0007136gxks04u9s'; // ID du document bail-signe
  
  console.log(`🔧 Ajout d'un lien GLOBAL pour le document ${documentId}...\n`);
  
  try {
    // 1. Vérifier que le document existe
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { 
        id: true, 
        filenameOriginal: true, 
        status: true,
        documentType: { select: { code: true, label: true } }
      }
    });
    
    if (!document) {
      console.log('❌ Document non trouvé !');
      return;
    }
    
    console.log(`📄 Document trouvé: ${document.filenameOriginal}`);
    console.log(`   Type: ${document.documentType?.label || 'Non classé'}`);
    console.log(`   Statut: ${document.status}`);
    
    // 2. Vérifier si un lien GLOBAL existe déjà
    const existingGlobalLink = await prisma.documentLink.findUnique({
      where: {
        documentId_linkedType_linkedId: {
          documentId: documentId,
          linkedType: 'global',
          linkedId: 'global'
        }
      }
    });
    
    if (existingGlobalLink) {
      console.log('⏭️  Lien GLOBAL déjà existant !');
      return;
    }
    
    // 3. Créer le lien GLOBAL
    await prisma.documentLink.create({
      data: {
        documentId: documentId,
        linkedType: 'global',
        linkedId: 'global'
      }
    });
    
    console.log('✅ Lien GLOBAL créé avec succès !');
    console.log('\n📝 Le document devrait maintenant apparaître sur la page Documents.');
    
    // 4. Vérifier tous les liens du document
    const allLinks = await prisma.documentLink.findMany({
      where: { documentId: documentId }
    });
    
    console.log(`\n🔗 Liens actuels (${allLinks.length}):`);
    allLinks.forEach((link, index) => {
      console.log(`   ${index + 1}. ${link.linkedType} → ${link.linkedId}`);
    });
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la création du lien:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
