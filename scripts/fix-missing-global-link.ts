import { prisma } from '@/lib/prisma';

async function main() {
  try {
    console.log('🔧 Ajout du lien global manquant...\n');
    
    // Trouver le document sans lien global
    const doc = await prisma.document.findFirst({
      where: {
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
    
    if (!doc) {
      console.log('✅ Tous les documents ont déjà un lien global');
      return;
    }
    
    console.log(`📄 Document trouvé: ${doc.filenameOriginal} (${doc.id})`);
    console.log(`📊 Liens actuels: ${doc.links.length}`);
    
    // Ajouter le lien global
    await prisma.documentLink.create({
      data: {
        documentId: doc.id,
        linkedType: 'global',
        linkedId: 'global'
      }
    });
    
    console.log('✅ Lien global ajouté !');
    
    // Vérifier
    const updatedDoc = await prisma.document.findUnique({
      where: { id: doc.id },
      include: { links: true }
    });
    
    console.log(`📊 Liens après ajout: ${updatedDoc?.links.length}`);
    updatedDoc?.links.forEach(link => {
      console.log(`  - ${link.linkedType}: ${link.linkedId}`);
    });
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
