/**
 * Script de test de la multi-tenancy
 * 
 * Crée 2 comptes (1 ADMIN, 1 USER) avec des données pour chaque portefeuille
 * et vérifie que l'isolation fonctionne correctement.
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, 'blue');
}

function logTest(message: string) {
  log(`🧪 ${message}`, 'cyan');
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void> | void) {
  try {
    logTest(`Test: ${name}`);
    await testFn();
    testResults.push({ name, passed: true });
    logSuccess(`Test passé: ${name}`);
  } catch (error: any) {
    testResults.push({ name, passed: false, error: error.message });
    logError(`Test échoué: ${name} - ${error.message}`);
  }
}

async function main() {
  log('\n🧪 DÉMARRAGE DES TESTS DE MULTI-TENANCY\n', 'cyan');

  // Créer une nouvelle instance de PrismaClient
  // Note: On utilise le pooler Supabase qui peut causer des problèmes de prepared statements
  // mais on gère cela avec des retries dans le code
  const prisma = new PrismaClient({
    log: [],
  });

  // Se connecter
  await prisma.$connect();
  
  // Fonction helper pour retry en cas d'erreur de prepared statement
  async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delay = 500
  ): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        if (error?.meta?.code === '42P05' || error?.message?.includes('prepared statement')) {
          // Erreur de prepared statement : attendre et réessayer
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            continue;
          }
        }
        throw error;
      }
    }
    throw lastError;
  }

  let adminUser: any = null;
  let userUser: any = null;
  let adminOrg: any = null;
  let userOrg: any = null;

  try {
    // ============================================
    // 1. CRÉATION DES ORGANISATIONS ET UTILISATEURS
    // ============================================
    log('\n📦 1. CRÉATION DES ORGANISATIONS ET UTILISATEURS\n', 'yellow');

    // Créer l'organisation ADMIN (avec un slug unique)
    const adminSlug = `org-admin-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    adminOrg = await withRetry(async () => {
      return await prisma.organization.create({
        data: {
          name: 'Portefeuille Admin',
          slug: adminSlug,
        },
      });
    });
    

    // Créer l'utilisateur ADMIN
    adminUser = await withRetry(async () => {
      return await prisma.user.create({
        data: {
          email: 'admin@test.com',
          name: 'Admin Test',
          role: 'ADMIN',
          organizationId: adminOrg.id,
          emailVerified: new Date(),
          supabaseId: `supabase-admin-${Date.now()}`,
        },
      });
    });

    // Mettre à jour l'organisation pour définir le propriétaire
    adminOrg = await withRetry(async () => {
      return await prisma.organization.update({
        where: { id: adminOrg.id },
        data: { ownerUserId: adminUser.id },
      });
    });

    // Créer l'organisation USER (avec un slug unique)
    const userSlug = `org-user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    userOrg = await withRetry(async () => {
      return await prisma.organization.create({
        data: {
          name: 'Portefeuille User',
          slug: userSlug,
        },
      });
    });

    // Créer l'utilisateur USER
    userUser = await withRetry(async () => {
      return await prisma.user.create({
        data: {
          email: 'user@test.com',
          name: 'User Test',
          role: 'USER',
          organizationId: userOrg.id,
          emailVerified: new Date(),
          supabaseId: `supabase-user-${Date.now()}`,
        },
      });
    });

    // Mettre à jour l'organisation pour définir le propriétaire
    userOrg = await withRetry(async () => {
      return await prisma.organization.update({
        where: { id: userOrg.id },
        data: { ownerUserId: userUser.id },
      });
    });

    logSuccess(`Organisation ADMIN créée: ${adminOrg.id}`);
    logSuccess(`Utilisateur ADMIN créé: ${adminUser.id} (${adminUser.email})`);
    logSuccess(`Organisation USER créée: ${userOrg.id}`);
    logSuccess(`Utilisateur USER créé: ${userUser.id} (${userUser.email})`);

    // ============================================
    // 2. CRÉATION DES DONNÉES ADMIN (partagées)
    // ============================================
    log('\n📦 2. CRÉATION DES DONNÉES ADMIN (partagées)\n', 'yellow');

    // Catégorie
    const category = await prisma.category.create({
      data: {
        slug: 'loyer_principal',
        label: 'Loyer principal',
        type: 'REVENUE',
        deductible: false,
        capitalizable: false,
        system: true,
        actif: true,
      },
    });
    logSuccess(`Catégorie créée: ${category.slug}`);

    // Nature
    const nature = await prisma.natureEntity.create({
      data: {
        code: 'RECETTE_LOYER',
        label: 'Recette de loyer',
        flow: 'REVENUE',
      },
    });
    logSuccess(`Nature créée: ${nature.code}`);

    // Document Type
    const docType = await prisma.documentType.create({
      data: {
        code: 'QUITANCE_LOYER',
        label: 'Quittance de loyer',
        scope: 'global',
        isSystem: false,
        isRequired: false,
        order: 0,
        isActive: true,
        isSensitive: false,
        versioningEnabled: true,
      },
    });
    logSuccess(`Type de document créé: ${docType.code}`);

    // ============================================
    // 3. CRÉATION DES DONNÉES PAR PORTEFEUILLE
    // ============================================
    log('\n📦 3. CRÉATION DES DONNÉES PAR PORTEFEUILLE\n', 'yellow');

    // PORTEFEUILLE ADMIN
    logInfo('Portefeuille ADMIN:');
    const adminProperty = await prisma.property.create({
      data: {
        organizationId: adminOrg.id,
        name: 'Bien Admin - Paris',
        type: 'APPARTEMENT',
        address: '123 Rue Admin, Paris',
        postalCode: '75001',
        city: 'Paris',
        surface: 50,
        rooms: 2,
        acquisitionDate: new Date('2020-01-01'),
        acquisitionPrice: 200000,
        notaryFees: 10000,
        currentValue: 250000,
        status: 'LOCATIF',
        occupation: 'OCCUPE',
      },
    });
    logSuccess(`  Bien créé: ${adminProperty.name} (${adminProperty.id})`);

    const adminTenant = await prisma.tenant.create({
      data: {
        organizationId: adminOrg.id,
        firstName: 'Jean',
        lastName: 'Admin',
        email: 'jean.admin@test.com',
        phone: '+33601010101',
      },
    });
    logSuccess(`  Locataire créé: ${adminTenant.firstName} ${adminTenant.lastName}`);

    const adminLease = await prisma.lease.create({
      data: {
        organizationId: adminOrg.id,
        propertyId: adminProperty.id,
        tenantId: adminTenant.id,
        type: 'BAIL_VIDE',
        furnishedType: 'vide',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2026-12-31'),
        rentAmount: 800,
        deposit: 1600,
        status: 'ACTIF',
      },
    });
    logSuccess(`  Bail créé: ${adminLease.id}`);

    const adminTransaction = await prisma.transaction.create({
      data: {
        organizationId: adminOrg.id,
        propertyId: adminProperty.id,
        leaseId: adminLease.id,
        nature: nature.code,
        categoryId: category.id,
        label: 'Loyer janvier 2024',
        amount: 800,
        date: new Date('2024-01-15'),
        paidAt: new Date('2024-01-15'),
        method: 'VIREMENT',
        accounting_month: '2024-01',
      },
    });
    logSuccess(`  Transaction créée: ${adminTransaction.label}`);

    const adminManagementCompany = await prisma.managementCompany.create({
      data: {
        organizationId: adminOrg.id,
        nom: 'Société Admin',
        modeCalcul: 'LOYERS_UNIQUEMENT',
        taux: 0.05,
        actif: true,
      },
    });
    logSuccess(`  Société de gestion créée: ${adminManagementCompany.nom}`);

    // PORTEFEUILLE USER
    logInfo('Portefeuille USER:');
    const userProperty = await prisma.property.create({
      data: {
        organizationId: userOrg.id,
        name: 'Bien User - Lyon',
        type: 'MAISON',
        address: '456 Rue User, Lyon',
        postalCode: '69001',
        city: 'Lyon',
        surface: 80,
        rooms: 4,
        acquisitionDate: new Date('2021-01-01'),
        acquisitionPrice: 300000,
        notaryFees: 15000,
        currentValue: 350000,
        status: 'LOCATIF',
        occupation: 'OCCUPE',
      },
    });
    logSuccess(`  Bien créé: ${userProperty.name} (${userProperty.id})`);

    const userTenant = await prisma.tenant.create({
      data: {
        organizationId: userOrg.id,
        firstName: 'Marie',
        lastName: 'User',
        email: 'marie.user@test.com',
        phone: '+33602020202',
      },
    });
    logSuccess(`  Locataire créé: ${userTenant.firstName} ${userTenant.lastName}`);

    const userLease = await prisma.lease.create({
      data: {
        organizationId: userOrg.id,
        propertyId: userProperty.id,
        tenantId: userTenant.id,
        type: 'BAIL_MEUBLE',
        furnishedType: 'meuble',
        startDate: new Date('2024-02-01'),
        endDate: new Date('2025-01-31'),
        rentAmount: 1200,
        deposit: 2400,
        status: 'ACTIF',
      },
    });
    logSuccess(`  Bail créé: ${userLease.id}`);

    const userTransaction = await prisma.transaction.create({
      data: {
        organizationId: userOrg.id,
        propertyId: userProperty.id,
        leaseId: userLease.id,
        nature: nature.code,
        categoryId: category.id,
        label: 'Loyer février 2024',
        amount: 1200,
        date: new Date('2024-02-15'),
        paidAt: new Date('2024-02-15'),
        method: 'CHEQUE',
        accounting_month: '2024-02',
      },
    });
    logSuccess(`  Transaction créée: ${userTransaction.label}`);

    const userManagementCompany = await prisma.managementCompany.create({
      data: {
        organizationId: userOrg.id,
        nom: 'Société User',
        modeCalcul: 'REVENUS_TOTAUX',
        taux: 0.08,
        actif: true,
      },
    });
    logSuccess(`  Société de gestion créée: ${userManagementCompany.nom}`);

    // ============================================
    // 4. TESTS D'ISOLATION DES DONNÉES
    // ============================================
    log('\n🧪 4. TESTS D\'ISOLATION DES DONNÉES\n', 'yellow');

    // Test 1: L'admin ne voit que ses biens
    await runTest('Admin voit uniquement ses biens', async () => {
      const adminProperties = await prisma.property.findMany({
        where: { organizationId: adminOrg.id },
      });
      if (adminProperties.length !== 1) {
        throw new Error(`Admin devrait voir 1 bien, mais voit ${adminProperties.length}`);
      }
      if (adminProperties[0].id !== adminProperty.id) {
        throw new Error('Admin voit le mauvais bien');
      }
    });

    // Test 2: Le user ne voit que ses biens
    await runTest('User voit uniquement ses biens', async () => {
      const userProperties = await prisma.property.findMany({
        where: { organizationId: userOrg.id },
      });
      if (userProperties.length !== 1) {
        throw new Error(`User devrait voir 1 bien, mais voit ${userProperties.length}`);
      }
      if (userProperties[0].id !== userProperty.id) {
        throw new Error('User voit le mauvais bien');
      }
    });

    // Test 3: L'admin ne voit pas les biens du user
    await runTest('Admin ne voit pas les biens du user', async () => {
      const adminProperties = await prisma.property.findMany({
        where: { organizationId: adminOrg.id },
      });
      const hasUserProperty = adminProperties.some(p => p.id === userProperty.id);
      if (hasUserProperty) {
        throw new Error('Admin ne devrait pas voir le bien du user');
      }
    });

    // Test 4: Le user ne voit pas les biens de l'admin
    await runTest('User ne voit pas les biens de l\'admin', async () => {
      const userProperties = await prisma.property.findMany({
        where: { organizationId: userOrg.id },
      });
      const hasAdminProperty = userProperties.some(p => p.id === adminProperty.id);
      if (hasAdminProperty) {
        throw new Error('User ne devrait pas voir le bien de l\'admin');
      }
    });

    // Test 5: Isolation des transactions
    await runTest('Isolation des transactions', async () => {
      const adminTransactions = await prisma.transaction.findMany({
        where: { organizationId: adminOrg.id },
      });
      const userTransactions = await prisma.transaction.findMany({
        where: { organizationId: userOrg.id },
      });
      
      if (adminTransactions.length !== 1 || adminTransactions[0].id !== adminTransaction.id) {
        throw new Error('Admin devrait voir uniquement sa transaction');
      }
      if (userTransactions.length !== 1 || userTransactions[0].id !== userTransaction.id) {
        throw new Error('User devrait voir uniquement sa transaction');
      }
    });

    // Test 6: Isolation des locataires
    await runTest('Isolation des locataires', async () => {
      const adminTenants = await prisma.tenant.findMany({
        where: { organizationId: adminOrg.id },
      });
      const userTenants = await prisma.tenant.findMany({
        where: { organizationId: userOrg.id },
      });
      
      if (adminTenants.length !== 1 || adminTenants[0].id !== adminTenant.id) {
        throw new Error('Admin devrait voir uniquement son locataire');
      }
      if (userTenants.length !== 1 || userTenants[0].id !== userTenant.id) {
        throw new Error('User devrait voir uniquement son locataire');
      }
    });

    // Test 7: Isolation des sociétés de gestion
    await runTest('Isolation des sociétés de gestion', async () => {
      const adminCompanies = await prisma.managementCompany.findMany({
        where: { organizationId: adminOrg.id },
      });
      const userCompanies = await prisma.managementCompany.findMany({
        where: { organizationId: userOrg.id },
      });
      
      if (adminCompanies.length !== 1 || adminCompanies[0].id !== adminManagementCompany.id) {
        throw new Error('Admin devrait voir uniquement sa société de gestion');
      }
      if (userCompanies.length !== 1 || userCompanies[0].id !== userManagementCompany.id) {
        throw new Error('User devrait voir uniquement sa société de gestion');
      }
    });

    // Test 8: Les données admin sont partagées (catégories, natures, etc.)
    await runTest('Données admin partagées (catégories, natures)', async () => {
      const categories = await prisma.category.findMany();
      const natures = await prisma.natureEntity.findMany();
      const docTypes = await prisma.documentType.findMany();
      
      // Les données admin ne sont pas filtrées par organizationId (partagées)
      if (categories.length === 0 || natures.length === 0 || docTypes.length === 0) {
        throw new Error('Les données admin devraient être accessibles à tous');
      }
      
      // Vérifier que les deux organisations peuvent utiliser les mêmes catégories/natures
      const adminTx = await prisma.transaction.findFirst({
        where: { id: adminTransaction.id },
        include: { Category: true },
      });
      const userTx = await prisma.transaction.findFirst({
        where: { id: userTransaction.id },
        include: { Category: true },
      });
      
      if (!adminTx?.Category || !userTx?.Category) {
        throw new Error('Les transactions devraient avoir des catégories');
      }
      if (adminTx.Category.id !== userTx.Category.id) {
        throw new Error('Les deux transactions devraient utiliser la même catégorie partagée');
      }
    });

    // Test 9: Vérification des liens entre entités (property -> lease -> tenant)
    await runTest('Intégrité des liens entre entités', async () => {
      const adminPropWithLease = await prisma.property.findFirst({
        where: { id: adminProperty.id, organizationId: adminOrg.id },
        include: {
          Lease: {
            include: {
              Tenant: true,
            },
          },
        },
      });
      
      if (!adminPropWithLease || adminPropWithLease.Lease.length !== 1) {
        throw new Error('Le bien admin devrait avoir un bail');
      }
      
      const lease = adminPropWithLease.Lease[0];
      if (lease.organizationId !== adminOrg.id) {
        throw new Error('Le bail devrait appartenir à la même organisation');
      }
      
      if (!lease.Tenant || lease.Tenant.id !== adminTenant.id) {
        throw new Error('Le bail devrait être lié au bon locataire');
      }
      
      if (lease.Tenant.organizationId !== adminOrg.id) {
        throw new Error('Le locataire devrait appartenir à la même organisation');
      }
    });

    // Test 10: Vérification qu'on ne peut pas accéder aux données d'une autre organisation
    await runTest('Impossible d\'accéder aux données d\'une autre organisation', async () => {
      // Essayer de trouver le bien du user avec l'organizationId de l'admin
      const forbiddenProperty = await prisma.property.findFirst({
        where: {
          id: userProperty.id,
          organizationId: adminOrg.id, // On utilise l'org de l'admin pour chercher le bien du user
        },
      });
      
      if (forbiddenProperty) {
        throw new Error('On ne devrait pas pouvoir accéder au bien du user avec l\'org de l\'admin');
      }
    });

    // ============================================
    // 5. RÉSUMÉ DES TESTS
    // ============================================
    log('\n📊 RÉSUMÉ DES TESTS\n', 'yellow');
    
    const passed = testResults.filter(t => t.passed).length;
    const failed = testResults.filter(t => !t.passed).length;
    
    logInfo(`Total: ${testResults.length} test(s)`);
    logSuccess(`Réussis: ${passed}`);
    if (failed > 0) {
      logError(`Échoués: ${failed}`);
    }
    
    log('\n📋 DÉTAIL DES TESTS:\n', 'cyan');
    testResults.forEach(test => {
      if (test.passed) {
        logSuccess(`  ✓ ${test.name}`);
      } else {
        logError(`  ✗ ${test.name}: ${test.error}`);
      }
    });

    if (failed === 0) {
      log('\n✨ TOUS LES TESTS SONT PASSÉS ! ✨\n', 'green');
      logInfo('Les deux comptes de test sont créés :');
      logInfo(`  - ADMIN: ${adminUser.email} (org: ${adminOrg.id})`);
      logInfo(`  - USER: ${userUser.email} (org: ${userOrg.id})`);
      logInfo('\nVous pouvez maintenant tester manuellement avec ces comptes.\n');
    } else {
      log('\n❌ CERTAINS TESTS ONT ÉCHOUÉ\n', 'red');
      process.exit(1);
    }

  } catch (error: any) {
    logError(`Erreur fatale: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error('Erreur:', e);
    process.exit(1);
  });

