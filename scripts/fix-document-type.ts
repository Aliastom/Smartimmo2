import { prisma } from '@/lib/prisma';

/**
 * Script pour corriger le type du document BAIL_SIGNE
 */
async function main() {
  const documentId = 'cmgy2fyu80003if005246p4dh';
  
  console.log(`🔧 Correction du type de document ${documentId}...\n`);
  
  try {
    // 1. Trouver le type BAIL_SIGNE
    const bailSigneType = await prisma.documentType.findUnique({
      where: { code: 'BAIL_SIGNE' }
    });
    
    if (!bailSigneType) {
      console.log('❌ Type BAIL_SIGNE non trouvé !');
      return;
    }
    
    console.log(`📋 Type BAIL_SIGNE trouvé: ${bailSigneType.label} (${bailSigneType.id})`);
    
    // 2. Mettre à jour le document
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: { documentTypeId: bailSigneType.id },
      include: {
        documentType: { select: { code: true, label: true } }
      }
    });
    
    console.log(`✅ Document mis à jour:`);
    console.log(`   Nom: ${updatedDocument.filenameOriginal}`);
    console.log(`   Type: ${updatedDocument.documentType?.label} (${updatedDocument.documentType?.code})`);
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la correction:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
