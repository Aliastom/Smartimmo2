import { prisma } from '@/lib/prisma';

async function main() {
  try {
    console.log('=== DERNIER DOCUMENT DÉTAILLÉ ===\n');
    
    const doc = await prisma.document.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        documentType: true,
        links: true
      }
    });
    
    if (!doc) {
      console.log('Aucun document trouvé');
      return;
    }
    
    console.log('ID:', doc.id);
    console.log('filenameOriginal:', doc.filenameOriginal);
    console.log('fileName:', doc.fileName);
    console.log('Status:', doc.status);
    console.log('Type:', doc.documentType?.label, `(${doc.documentType?.code})`);
    console.log('MIME:', doc.mime);
    console.log('Size:', doc.size);
    console.log('URL:', doc.url);
    console.log('bucketKey:', doc.bucketKey);
    console.log('Liens:', doc.links.length);
    doc.links.forEach(link => {
      console.log(`  - ${link.linkedType}: ${link.linkedId}`);
    });
    console.log('Créé:', doc.createdAt.toISOString());
    console.log('');
    
    // Vérifier si le document a un lien global
    const hasGlobalLink = doc.links.some(link => link.linkedType === 'global');
    console.log('A un lien global:', hasGlobalLink);
    
    if (!hasGlobalLink) {
      console.log('❌ PROBLÈME: Le document n\'a pas de lien global, il n\'apparaîtra pas sur la page documents !');
    }
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
