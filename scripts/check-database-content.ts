import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('\n📊 CONTENU DE LA BASE DE DONNÉES\n');
  console.log('='.repeat(60));

  // Compter les types de documents
  const documentTypesCount = await prisma.documentType.count();
  console.log(`\n📁 DocumentType: ${documentTypesCount} entrées`);
  
  if (documentTypesCount > 0) {
    const types = await prisma.documentType.findMany({
      select: { code: true, label: true, scope: true, isRequired: true },
      orderBy: [{ scope: 'asc' }, { label: 'asc' }]
    });
    
    const byScope = types.reduce((acc, t) => {
      if (!acc[t.scope]) acc[t.scope] = [];
      acc[t.scope].push(t);
      return acc;
    }, {} as Record<string, typeof types>);
    
    Object.entries(byScope).forEach(([scope, items]) => {
      console.log(`\n  ${scope.toUpperCase()}:`);
      items.forEach(t => {
        const required = t.isRequired ? '⭐ (requis)' : '';
        console.log(`    - ${t.label} ${required}`);
      });
    });
  }

  // Compter les documents
  const documentsCount = await prisma.document.count();
  console.log(`\n📄 Document: ${documentsCount} entrées`);

  // Compter les biens
  const propertiesCount = await prisma.property.count();
  console.log(`🏠 Property: ${propertiesCount} entrées`);

  // Compter les baux
  const leasesCount = await prisma.lease.count();
  console.log(`📋 Lease: ${leasesCount} entrées`);

  // Compter les transactions
  const transactionsCount = await prisma.transaction.count();
  console.log(`💰 Transaction: ${transactionsCount} entrées`);

  // Compter les locataires
  const tenantsCount = await prisma.tenant.count();
  console.log(`👥 Tenant: ${tenantsCount} entrées`);

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Script terminé\n');
}

checkDatabase()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

