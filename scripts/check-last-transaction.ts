import { prisma } from '@/lib/prisma';

async function main() {
  try {
    const lastTx = await prisma.transaction.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { 
        documents: true,
        property: { select: { address: true } }
      }
    });
    
    if (lastTx) {
      console.log('✅ Dernière transaction créée:');
      console.log(`   ID: ${lastTx.id.substring(0, 8)}...`);
      console.log(`   Label: ${lastTx.label}`);
      console.log(`   Montant: ${lastTx.amount}€`);
      console.log(`   Bien: ${lastTx.property?.address}`);
      console.log(`   Documents: ${lastTx.documents.length}`);
      
      // Vérifier les liens
      const links = await prisma.documentLink.findMany({
        where: { linkedType: 'transaction', linkedId: lastTx.id }
      });
      console.log(`   Liens DocumentLink: ${links.length}`);
    } else {
      console.log('❌ Aucune transaction trouvée');
    }
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
