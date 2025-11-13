import { prisma } from '@/lib/prisma';

async function main() {
  try {
    console.log('🔍 Vérification des documents et leurs liens...\n');
    
    const docs = await prisma.document.findMany({ 
      include: { 
        links: true,
        documentType: { select: { label: true } }
      } 
    });
    
    console.log(`📄 ${docs.length} documents dans la base:`);
    docs.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.filenameOriginal}`);
      console.log(`      Status: ${doc.status}`);
      console.log(`      Type: ${doc.documentType?.label || 'Non classé'}`);
      console.log(`      Liens: ${doc.links.length} (${doc.links.map(l => l.linkedType).join(', ')})`);
    });
    
    // Vérifier les liens global
    const globalLinks = await prisma.documentLink.findMany({
      where: { linkedType: 'global' }
    });
    
    console.log(`\n🌐 ${globalLinks.length} liens GLOBAL trouvés:`);
    globalLinks.forEach((link, index) => {
      console.log(`   ${index + 1}. Document ${link.documentId.substring(0, 8)}...`);
    });
    
    if (globalLinks.length === 0) {
      console.log('\n❌ PROBLÈME: Aucun lien GLOBAL trouvé !');
      console.log('💡 C\'est pour ça que la page Documents est vide.');
      console.log('🔧 Solution: Ajouter des liens GLOBAL aux documents existants.');
    }
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
