import { prisma } from '@/lib/prisma';

/**
 * Script pour créer le type de document BAIL_SIGNE
 */
async function main() {
  console.log('🔧 Création du type de document BAIL_SIGNE...\n');
  
  try {
    // Vérifier si le type existe déjà
    const existingType = await prisma.documentType.findUnique({
      where: { code: 'BAIL_SIGNE' }
    });
    
    if (existingType) {
      console.log(`✅ Type BAIL_SIGNE existe déjà: ${existingType.label}`);
      return;
    }
    
    // Créer le type BAIL_SIGNE
    const newType = await prisma.documentType.create({
      data: {
        code: 'BAIL_SIGNE',
        label: 'Bail signé',
        description: 'Document de bail signé par le locataire',
        icon: 'file-text',
        isActive: true,
        autoAssignThreshold: 0.8,
        order: 10
      }
    });
    
    console.log(`✅ Type BAIL_SIGNE créé:`);
    console.log(`   Code: ${newType.code}`);
    console.log(`   Label: ${newType.label}`);
    console.log(`   ID: ${newType.id}`);
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la création:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
