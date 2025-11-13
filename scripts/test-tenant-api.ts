import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTenantAPI() {
  console.log('🧪 Test de l\'API des locataires...\n');
  
  try {
    // 1. Tester la création d'un locataire
    console.log('1️⃣ Test de création d\'un locataire...');
    
    const testTenantData = {
      firstName: 'Test',
      lastName: 'API',
      email: 'test.api@example.com',
      phone: '+33123456789',
      nationality: 'Française',
      address: '123 rue de test',
      postalCode: '75001',
      city: 'Paris',
      country: 'France',
      occupation: 'Développeur',
      employer: 'Test Company',
      monthlyIncome: 3000,
      emergencyContact: 'Contact d\'urgence',
      emergencyPhone: '+33987654321',
      notes: 'Notes de test',
      status: 'ACTIVE',
      tags: JSON.stringify(['VIP', 'Test'])
    };
    
    const createdTenant = await prisma.tenant.create({
      data: testTenantData
    });
    
    console.log('   ✅ Locataire créé avec succès:', {
      id: createdTenant.id,
      name: `${createdTenant.firstName} ${createdTenant.lastName}`,
      email: createdTenant.email
    });
    
    // 2. Tester la mise à jour du locataire
    console.log('\n2️⃣ Test de mise à jour du locataire...');
    
    const updatedTenant = await prisma.tenant.update({
      where: { id: createdTenant.id },
      data: {
        firstName: 'Test Updated',
        notes: 'Notes mises à jour'
      }
    });
    
    console.log('   ✅ Locataire mis à jour avec succès:', {
      id: updatedTenant.id,
      name: `${updatedTenant.firstName} ${updatedTenant.lastName}`,
      notes: updatedTenant.notes
    });
    
    // 3. Tester la récupération du locataire
    console.log('\n3️⃣ Test de récupération du locataire...');
    
    const retrievedTenant = await prisma.tenant.findUnique({
      where: { id: createdTenant.id }
    });
    
    if (retrievedTenant) {
      console.log('   ✅ Locataire récupéré avec succès:', {
        id: retrievedTenant.id,
        name: `${retrievedTenant.firstName} ${retrievedTenant.lastName}`,
        email: retrievedTenant.email,
        phone: retrievedTenant.phone,
        address: retrievedTenant.address,
        tags: retrievedTenant.tags
      });
    } else {
      console.log('   ❌ Locataire non trouvé');
    }
    
    // 4. Nettoyer - supprimer le locataire de test
    console.log('\n4️⃣ Nettoyage - suppression du locataire de test...');
    
    await prisma.tenant.delete({
      where: { id: createdTenant.id }
    });
    
    console.log('   ✅ Locataire de test supprimé');
    
    console.log('\n🎉 Tous les tests de l\'API des locataires ont réussi !');
    
  } catch (error) {
    console.error('💥 Erreur lors du test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testTenantAPI()
  .then(() => {
    console.log('\n🎉 Test terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du test:', error);
    process.exit(1);
  });

export { testTenantAPI };
