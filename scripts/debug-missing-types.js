/**
 * Script pour diagnostiquer pourquoi les types de documents ne s'affichent plus
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debugMissingTypes() {
  console.log('🔍 Diagnostic - Types de documents manquants\n');

  try {
    // Vérifier tous les types dans la base
    const allTypes = await prisma.documentType.findMany({
      orderBy: [{ isSystem: 'desc' }, { code: 'asc' }]
    });

    console.log(`📊 Total des types dans la base: ${allTypes.length}`);
    
    if (allTypes.length === 0) {
      console.log('❌ AUCUN TYPE TROUVÉ dans la base de données !');
      return;
    }

    console.log('\n📋 Types trouvés:');
    allTypes.forEach((type, index) => {
      console.log(`   ${index + 1}. ${type.code} (${type.label})`);
      console.log(`      - ID: ${type.id}`);
      console.log(`      - Système: ${type.isSystem}`);
      console.log(`      - Actif: ${type.isActive}`);
      console.log(`      - Ordre: ${type.order || 'Non défini'}`);
      console.log('');
    });

    // Vérifier les types actifs
    const activeTypes = allTypes.filter(type => type.isActive);
    console.log(`✅ Types actifs: ${activeTypes.length}/${allTypes.length}`);

    // Vérifier les types système
    const systemTypes = allTypes.filter(type => type.isSystem);
    console.log(`🏷️ Types système: ${systemTypes.length}/${allTypes.length}`);

    // Tester l'API directement
    console.log('\n🌐 Test de l\'API:');
    
    // Simuler la requête API
    const apiTypes = await prisma.documentType.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { documents: true }
        }
      },
      orderBy: [{ isSystem: 'desc' }, { order: 'asc' }]
    });

    console.log(`📡 API retourne: ${apiTypes.length} types actifs`);
    
    if (apiTypes.length > 0) {
      console.log('✅ L\'API devrait retourner des données');
      
      // Tester le parsing JSON sur le premier type
      const firstType = apiTypes[0];
      console.log(`\n🧪 Test de parsing sur ${firstType.code}:`);
      
      try {
        const parsedType = {
          ...firstType,
          documentsCount: firstType._count.documents,
          _count: undefined,
          defaultContexts: firstType.defaultContexts ? JSON.parse(firstType.defaultContexts) : [],
          suggestionConfig: firstType.suggestionConfig ? JSON.parse(firstType.suggestionConfig) : null,
          lockInFlows: firstType.lockInFlows ? JSON.parse(firstType.lockInFlows) : [],
          metadataSchema: firstType.metadataSchema ? JSON.parse(firstType.metadataSchema) : null,
        };
        
        console.log('✅ Parsing JSON réussi');
        console.log(`   - defaultContexts: [${parsedType.defaultContexts.join(', ')}]`);
        console.log(`   - suggestionConfig: ${parsedType.suggestionConfig ? 'Défini' : 'Null'}`);
        console.log(`   - lockInFlows: [${parsedType.lockInFlows.join(', ')}]`);
        console.log(`   - metadataSchema: ${parsedType.metadataSchema ? 'Défini' : 'Null'}`);
        
      } catch (parseError) {
        console.log('❌ Erreur de parsing JSON:');
        console.log(`   Erreur: ${parseError.message}`);
      }
    } else {
      console.log('❌ L\'API ne retourne aucun type actif');
    }

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugMissingTypes().catch(console.error);
