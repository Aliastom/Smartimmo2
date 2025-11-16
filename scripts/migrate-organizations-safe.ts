/**
 * Script de migration NON-DESTRUCTIF pour préparer la multi-tenancy.
 * ✅ Conserve toutes les données existantes et les assigne aux organisations.
 *
 * Usage :
 *   npx ts-node scripts/migrate-organizations-safe.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40) || 'organisation';
}

/**
 * 1. Créer une organisation par utilisateur existant
 */
async function createOrganizationsForUsers() {
  console.log('🏗️  Création des organisations par utilisateur...');
  
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, organizationId: true },
  });

  let created = 0;
  let updated = 0;

  for (const user of users) {
    // Si l'utilisateur a déjà une organisation valide (pas "default"), on passe
    if (user.organizationId && user.organizationId !== 'default') {
      const orgExists = await prisma.organization.findUnique({
        where: { id: user.organizationId },
      });
      if (orgExists) {
        console.log(`  ⏭️  ${user.email || user.name || user.id} ➜ organisation existante: ${orgExists.slug}`);
        continue;
      }
    }

    const label = user.name || user.email || `user-${user.id.slice(0, 6)}`;
    const baseSlug = slugify(label);
    let slug = baseSlug;
    let suffix = 1;

    let organizationId: string | null = null;
    while (!organizationId) {
      try {
        const org = await prisma.organization.create({
          data: {
            name: label,
            slug,
            ownerUserId: user.id,
          },
        });
        organizationId = org.id;
        created++;
        console.log(`  ✅ ${label} ➜ nouvelle organisation: ${slug}`);
      } catch (error: any) {
        if (error.code === 'P2002') {
          slug = `${baseSlug}-${suffix++}`;
        } else {
          throw error;
        }
      }
    }

    // Mettre à jour l'utilisateur avec la nouvelle organisation
    await prisma.user.update({
      where: { id: user.id },
      data: { organizationId },
    });
    updated++;
  }

  console.log(`\n📊 Résumé : ${created} organisation(s) créée(s), ${updated} utilisateur(s) mis à jour\n`);
}

/**
 * 2. Assigner les données existantes aux organisations
 */
async function assignDataToOrganizations() {
  console.log('📦 Attribution des données existantes aux organisations...\n');

  // Properties → organisation de l'utilisateur créateur (si non traçable, première organisation)
  console.log('  🏠 Attribution des biens...');
  const properties = await prisma.property.findMany({
    where: { organizationId: 'default' },
    select: { id: true },
  });
  
  if (properties.length > 0) {
    // Pour les biens sans organisation, on les assigne à la première organisation disponible
    const firstOrg = await prisma.organization.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    
    if (firstOrg) {
      const result = await prisma.property.updateMany({
        where: { organizationId: 'default' },
        data: { organizationId: firstOrg.id },
      });
      console.log(`    ✅ ${result.count} bien(s) assigné(s) à l'organisation ${firstOrg.id}`);
    }
  }

  // Transactions → organisation du bien associé (ou fallback)
  console.log('  💰 Attribution des transactions...');
  const transactionsDefault = await prisma.transaction.findMany({
    where: { organizationId: 'default' },
    select: { id: true, propertyId: true },
    take: 100, // Traiter par lots
  });
  
  for (const transaction of transactionsDefault) {
    let targetOrgId: string | undefined;
    
    if (transaction.propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: transaction.propertyId },
        select: { organizationId: true },
      });
      if (property?.organizationId && property.organizationId !== 'default') {
        targetOrgId = property.organizationId;
      }
    }
    
    if (!targetOrgId) {
      const firstOrg = await prisma.organization.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      targetOrgId = firstOrg?.id;
    }
    
    if (targetOrgId) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { organizationId: targetOrgId },
      });
    }
  }
  console.log(`    ✅ Transactions traitées`);

  // Documents → organisation du bien/propriétaire associé
  console.log('  📄 Attribution des documents...');
  const documentsDefault = await prisma.document.findMany({
    where: { organizationId: 'default' },
    select: { id: true },
  });
  
  if (documentsDefault.length > 0) {
    // Vérifier les liens des documents pour trouver l'organisation
    for (const doc of documentsDefault.slice(0, 100)) { // Traiter par lots
      const links = await prisma.documentLink.findMany({
        where: { documentId: doc.id },
        select: { linkedType: true, linkedId: true },
      });
      
      let targetOrgId: string | undefined;
      
      for (const link of links) {
        if (link.linkedType === 'PROPERTY' && link.linkedId) {
          const property = await prisma.property.findUnique({
            where: { id: link.linkedId },
            select: { organizationId: true },
          });
          if (property?.organizationId && property.organizationId !== 'default') {
            targetOrgId = property.organizationId;
            break;
          }
        }
      }
      
      if (!targetOrgId) {
        const firstOrg = await prisma.organization.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        targetOrgId = firstOrg?.id;
      }
      
      if (targetOrgId) {
        await prisma.document.update({
          where: { id: doc.id },
          data: { organizationId: targetOrgId },
        });
      }
    }
  }
  console.log(`    ✅ Documents traités`);

  // Leases → organisation du bien associé
  console.log('  📋 Attribution des baux...');
  const leasesDefault = await prisma.lease.findMany({
    where: { organizationId: 'default' },
    select: { id: true, propertyId: true },
  });
  
  for (const lease of leasesDefault) {
    let targetOrgId: string | undefined;
    
    if (lease.propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: lease.propertyId },
        select: { organizationId: true },
      });
      if (property?.organizationId && property.organizationId !== 'default') {
        targetOrgId = property.organizationId;
      }
    }
    
    if (!targetOrgId) {
      const firstOrg = await prisma.organization.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      targetOrgId = firstOrg?.id;
    }
    
    if (targetOrgId) {
      await prisma.lease.update({
        where: { id: lease.id },
        data: { organizationId: targetOrgId },
      });
    }
  }
  console.log(`    ✅ ${leasesDefault.length} bail/baux traité(s)`);

  // Tenants → organisation du bail associé
  console.log('  👤 Attribution des locataires...');
  const tenantsDefault = await prisma.tenant.findMany({
    where: { organizationId: 'default' },
    select: { id: true },
  });
  
  for (const tenant of tenantsDefault) {
    const lease = await prisma.lease.findFirst({
      where: { tenantId: tenant.id },
      select: { organizationId: true },
    });
    
    let targetOrgId = lease?.organizationId;
    
    if (!targetOrgId || targetOrgId === 'default') {
      const firstOrg = await prisma.organization.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      targetOrgId = firstOrg?.id;
    }
    
    if (targetOrgId && targetOrgId !== 'default') {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { organizationId: targetOrgId },
      });
    }
  }
  console.log(`    ✅ ${tenantsDefault.length} locataire(s) traité(s)`);

  // Loans → organisation du bien associé
  console.log('  💳 Attribution des prêts...');
  const loansDefault = await prisma.loan.findMany({
    where: { organizationId: 'default' },
    select: { id: true, propertyId: true },
  });
  
  for (const loan of loansDefault) {
    let targetOrgId: string | undefined;
    
    if (loan.propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: loan.propertyId },
        select: { organizationId: true },
      });
      if (property?.organizationId && property.organizationId !== 'default') {
        targetOrgId = property.organizationId;
      }
    }
    
    if (!targetOrgId) {
      const firstOrg = await prisma.organization.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      targetOrgId = firstOrg?.id;
    }
    
    if (targetOrgId) {
      await prisma.loan.update({
        where: { id: loan.id },
        data: { organizationId: targetOrgId },
      });
    }
  }
  console.log(`    ✅ ${loansDefault.length} prêt(s) traité(s)`);

  // Payments, Photos, etc. → organisation du bien associé
  console.log('  💸 Attribution des paiements et photos...');
  const paymentsDefault = await prisma.payment.findMany({
    where: { organizationId: 'default' },
    select: { id: true, loanId: true },
  });
  
  for (const payment of paymentsDefault) {
    let targetOrgId: string | undefined;
    
    if (payment.loanId) {
      const loan = await prisma.loan.findUnique({
        where: { id: payment.loanId },
        select: { organizationId: true },
      });
      if (loan?.organizationId && loan.organizationId !== 'default') {
        targetOrgId = loan.organizationId;
      }
    }
    
    if (!targetOrgId) {
      const firstOrg = await prisma.organization.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      targetOrgId = firstOrg?.id;
    }
    
    if (targetOrgId) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { organizationId: targetOrgId },
      });
    }
  }
  
  const photosDefault = await prisma.photo.findMany({
    where: { organizationId: 'default' },
    select: { id: true, propertyId: true },
  });
  
  for (const photo of photosDefault) {
    let targetOrgId: string | undefined;
    
    if (photo.propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: photo.propertyId },
        select: { organizationId: true },
      });
      if (property?.organizationId && property.organizationId !== 'default') {
        targetOrgId = property.organizationId;
      }
    }
    
    if (!targetOrgId) {
      const firstOrg = await prisma.organization.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      targetOrgId = firstOrg?.id;
    }
    
    if (targetOrgId) {
      await prisma.photo.update({
        where: { id: photo.id },
        data: { organizationId: targetOrgId },
      });
    }
  }
  
  console.log(`    ✅ ${paymentsDefault.length} paiement(s) et ${photosDefault.length} photo(s) traité(s)`);

  // UploadSessions et UploadStagedItems → organisation par défaut ou première disponible
  console.log('  📤 Attribution des sessions d\'upload...');
  const firstOrg = await prisma.organization.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  
  if (firstOrg) {
    await prisma.uploadSession.updateMany({
      where: { organizationId: 'default' },
      data: { organizationId: firstOrg.id },
    });
    
    await prisma.uploadStagedItem.updateMany({
      where: { organizationId: 'default' },
      data: { organizationId: firstOrg.id },
    });
  }
  console.log(`    ✅ Sessions d'upload traitées`);

  console.log('\n✅ Attribution des données terminée\n');
}

/**
 * 3. Afficher un résumé de la migration
 */
async function showMigrationSummary() {
  console.log('📊 Résumé de la migration :\n');
  
  const orgs = await prisma.organization.findMany({
    include: {
      _count: {
        select: {
          Property: true,
          Transaction: true,
          Document: true,
          Lease: true,
          Tenant: true,
        },
      },
    },
  });
  
  for (const org of orgs) {
    console.log(`  🏢 ${org.name} (${org.slug})`);
    console.log(`     - ${org._count.Property} bien(s)`);
    console.log(`     - ${org._count.Transaction} transaction(s)`);
    console.log(`     - ${org._count.Document} document(s)`);
    console.log(`     - ${org._count.Lease} bail/baux`);
    console.log(`     - ${org._count.Tenant} locataire(s)`);
  }
  
  // Vérifier s'il reste des données avec "default"
  const counts = {
    properties: await prisma.property.count({ where: { organizationId: 'default' } }),
    transactions: await prisma.transaction.count({ where: { organizationId: 'default' } }),
    documents: await prisma.document.count({ where: { organizationId: 'default' } }),
    leases: await prisma.lease.count({ where: { organizationId: 'default' } }),
    tenants: await prisma.tenant.count({ where: { organizationId: 'default' } }),
  };
  
  const hasDefaults = Object.values(counts).some(c => c > 0);
  
  if (hasDefaults) {
    console.log('\n⚠️  Attention : Il reste des données avec organizationId="default" :');
    console.log(`     - ${counts.properties} bien(s)`);
    console.log(`     - ${counts.transactions} transaction(s)`);
    console.log(`     - ${counts.documents} document(s)`);
    console.log(`     - ${counts.leases} bail/baux`);
    console.log(`     - ${counts.tenants} locataire(s)`);
    console.log('\n💡 Relancez le script pour traiter les données restantes.\n');
  } else {
    console.log('\n✅ Toutes les données ont été assignées à des organisations !\n');
  }
}

async function main() {
  console.log('🚀 Début de la migration multi-tenancy (mode non-destructif)\n');
  console.log('⚠️  Cette migration va :');
  console.log('   1. Créer une organisation par utilisateur existant');
  console.log('   2. Assigner les données existantes aux bonnes organisations');
  console.log('   3. Conserver toutes les données\n');
  
  try {
    await createOrganizationsForUsers();
    await assignDataToOrganizations();
    await showMigrationSummary();
    
    console.log('✅ Migration terminée avec succès !');
    console.log('📝 Les nouvelles données seront automatiquement isolées par organisation.\n');
  } catch (error) {
    console.error('❌ Erreur lors de la migration :', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('❌ Migration échouée:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

