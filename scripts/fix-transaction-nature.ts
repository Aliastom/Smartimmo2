import { prisma } from '../src/lib/prisma';

async function fixTransactionNature() {
  console.log('Correction de la nature de la transaction...');
  
  // Mettre à jour la transaction pour qu'elle ait la bonne nature
  const updatedTransaction = await prisma.transaction.update({
    where: {
      id: 'cmgxwcb8k0005i3omnpmn1afy'
    },
    data: {
      nature: 'RECETTE_LOYER' // C'est un loyer, donc une recette
    }
  });
  
  console.log('Transaction mise à jour:', updatedTransaction);
  
  await prisma.$disconnect();
}

fixTransactionNature().catch(console.error);
