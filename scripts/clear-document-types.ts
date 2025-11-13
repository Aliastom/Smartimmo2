import { prisma } from '@/lib/prisma';

async function main() {
  try {
    console.log('🗑️ Suppression de tous les types de documents...\n');
    
    const result = await prisma.documentType.deleteMany({});
    console.log(`✅ ${result.count} types de documents supprimés`);
    
    const remainingCount = await prisma.documentType.count();
    console.log(`📊 Types de documents restants: ${remainingCount}`);
    
    console.log('\n✅ Table DocumentType maintenant vide !');
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la suppression:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
