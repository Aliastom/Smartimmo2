import { prisma } from '../src/lib/prisma';

async function checkTransactionNature() {
  console.log('Vérification de la nature des transactions...');
  
  // Récupérer la transaction problématique
  const transaction = await prisma.transaction.findFirst({
    where: {
      id: 'cmgxwcb8k0005i3omnpmn1afy'
    },
    select: {
      id: true,
      nature: true,
      label: true,
      amount: true
    }
  });
  
  console.log('Transaction trouvée:', transaction);
  
  // Récupérer toutes les natures disponibles
  const natures = await prisma.natureEntity.findMany({
    select: {
      code: true,
      label: true
    }
  });
  
  console.log('Natures disponibles:', natures);
  
  // Vérifier si la nature de la transaction existe
  if (transaction?.nature) {
    const matchingNature = natures.find(n => n.code === transaction.nature);
    console.log('Nature correspondante:', matchingNature);
  } else {
    console.log('Transaction sans nature définie');
  }
  
  await prisma.$disconnect();
}

checkTransactionNature().catch(console.error);
