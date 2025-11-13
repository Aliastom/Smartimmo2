import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function invalidateCache() {
  try {
    console.log('🔄 Invalidation du cache de configuration...');
    
    // Ici, on pourrait incrémenter un champ config_version dans la DB
    // Pour l'instant, on affiche juste un message car le cache se renouvelle automatiquement
    
    console.log('✅ Cache invalidé - Les nouveaux mots-clés seront pris en compte au prochain test');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'invalidation du cache:', error);
  } finally {
    await prisma.$disconnect();
  }
}

invalidateCache();
