#!/usr/bin/env node

/**
 * Script de migration des statuts legacy français vers anglais
 * À exécuter après la mise à jour du schéma Prisma
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Mapping des anciens statuts vers les nouveaux
 */
const LEGACY_STATUS_MAPPING = {
  'BROUILLON': 'DRAFT',
  'ENVOYÉ': 'SENT',
  'ENVOYE': 'SENT',
  'SIGNÉ': 'SIGNED',
  'SIGNE': 'SIGNED',
  'ACTIF': 'ACTIVE',
  'RÉSILIÉ': 'TERMINATED',
  'RESILIE': 'TERMINATED',
  'ARCHIVÉ': 'TERMINATED',
  'ARCHIVE': 'TERMINATED',
};

function normalizeLeaseStatus(legacyStatus) {
  return LEGACY_STATUS_MAPPING[legacyStatus] || 'DRAFT';
}

async function migrateLeaseStatuses() {
  console.log('🔄 Début de la migration des statuts de bail...');
  
  try {
    // Compter les baux à migrer
    const leasesToMigrate = await prisma.lease.findMany({
      where: {
        status: {
          in: Object.keys(LEGACY_STATUS_MAPPING)
        }
      }
    });
    
    console.log(`📊 ${leasesToMigrate.length} baux à migrer`);
    
    if (leasesToMigrate.length === 0) {
      console.log('✅ Aucun bail à migrer, tous les statuts sont déjà en anglais');
      return;
    }
    
    // Afficher les statuts actuels
    const statusCounts = {};
    leasesToMigrate.forEach(lease => {
      statusCounts[lease.status] = (statusCounts[lease.status] || 0) + 1;
    });
    
    console.log('📈 Statuts actuels:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count} baux`);
    });
    
    // Migrer chaque bail
    let migratedCount = 0;
    const errors = [];
    
    for (const lease of leasesToMigrate) {
      try {
        const newStatus = normalizeLeaseStatus(lease.status);
        
        await prisma.lease.update({
          where: { id: lease.id },
          data: { 
            status: newStatus,
            updatedAt: new Date()
          }
        });
        
        migratedCount++;
        
        if (migratedCount % 10 === 0) {
          console.log(`⏳ Migré ${migratedCount}/${leasesToMigrate.length} baux...`);
        }
      } catch (error) {
        errors.push({
          id: lease.id,
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        });
      }
    }
    
    console.log(`✅ Migration terminée: ${migratedCount} baux migrés`);
    
    if (errors.length > 0) {
      console.log(`❌ ${errors.length} erreurs rencontrées:`);
      errors.forEach(({ id, error }) => {
        console.log(`  - Bail ${id}: ${error}`);
      });
    }
    
    // Vérifier le résultat
    const newStatusCounts = {};
    const allLeases = await prisma.lease.findMany({
      select: { status: true }
    });
    
    allLeases.forEach(lease => {
      newStatusCounts[lease.status] = (newStatusCounts[lease.status] || 0) + 1;
    });
    
    console.log('📊 Nouveaux statuts:');
    Object.entries(newStatusCounts).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count} baux`);
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  }
}

async function main() {
  try {
    await migrateLeaseStatuses();
    console.log('🎉 Migration terminée avec succès !');
  } catch (error) {
    console.error('💥 Échec de la migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
main();
