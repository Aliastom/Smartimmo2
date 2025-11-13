#!/usr/bin/env tsx

/**
 * Script pour tester si les nouveaux modèles Prisma sont disponibles
 */

import { prisma } from '../src/lib/prisma';

async function testModels() {
  try {
    console.log('🔍 Test de la disponibilité des modèles Prisma...');
    
    // Test 1: Vérifier si les modèles existent
    console.log('📋 Vérification des modèles...');
    console.log('prisma.natureCategoryAllowed:', typeof prisma.natureCategoryAllowed);
    console.log('prisma.natureCategoryDefault:', typeof prisma.natureCategoryDefault);
    
    // Test 2: Essayer de compter les enregistrements
    if (prisma.natureCategoryAllowed) {
      const allowedCount = await prisma.natureCategoryAllowed.count();
      console.log('✅ NatureCategoryAllowed disponible, count:', allowedCount);
    } else {
      console.log('❌ NatureCategoryAllowed non disponible');
    }
    
    if (prisma.natureCategoryDefault) {
      const defaultCount = await prisma.natureCategoryDefault.count();
      console.log('✅ NatureCategoryDefault disponible, count:', defaultCount);
    } else {
      console.log('❌ NatureCategoryDefault non disponible');
    }
    
    // Test 3: Essayer de récupérer des données
    if (prisma.natureCategoryAllowed && prisma.natureCategoryDefault) {
      console.log('📊 Récupération des données...');
      const allowedRules = await prisma.natureCategoryAllowed.findMany();
      const defaultRules = await prisma.natureCategoryDefault.findMany();
      
      console.log('Règles autorisées:', allowedRules.length);
      console.log('Règles par défaut:', defaultRules.length);
      
      if (allowedRules.length > 0) {
        console.log('Première règle autorisée:', allowedRules[0]);
      }
      if (defaultRules.length > 0) {
        console.log('Première règle par défaut:', defaultRules[0]);
      }
    }
    
    console.log('✅ Test terminé avec succès');
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testModels();
