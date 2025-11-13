/**
 * Script pour corriger les documents avec ocrStatus "pending" 
 * mais qui ont déjà du texte extrait (extractedText)
 * 
 * Usage: node scripts/fix-pending-ocr-status.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixPendingOcrStatus() {
  console.log('🔧 Correction des statuts OCR en attente...');
  
  try {
    // 1. Identifier les documents avec ocrStatus = 'pending' mais extractedText non null
    console.log('\n1️⃣ Identification des documents avec OCR traité mais statut pending...');
    
    const documentsToFix = await prisma.document.findMany({
      where: {
        ocrStatus: 'pending',
        extractedText: {
          not: null
        },
        // Exclure les textes vides ou trop courts
        AND: {
          NOT: {
            extractedText: ''
          }
        }
      },
      select: {
        id: true,
        filenameOriginal: true,
        extractedText: true,
        status: true,
        source: true,
        createdAt: true
      }
    });
    
    console.log(`📊 Trouvé ${documentsToFix.length} documents à corriger`);
    
    if (documentsToFix.length === 0) {
      console.log('✅ Aucun document à corriger !');
      return;
    }
    
    // 2. Afficher les documents pour information
    console.log('\n📄 Documents à corriger:');
    documentsToFix.forEach((doc, index) => {
      const textLength = doc.extractedText ? doc.extractedText.length : 0;
      console.log(`${index + 1}. ${doc.filenameOriginal} (${doc.id})`);
      console.log(`   Status: ${doc.status} | Source: ${doc.source} | Texte: ${textLength} chars`);
      console.log(`   Créé: ${doc.createdAt}`);
    });
    
    // 3. Corriger les statuts OCR
    console.log('\n2️⃣ Correction des statuts OCR...');
    
    const updateResults = [];
    
    for (const doc of documentsToFix) {
      const textLength = doc.extractedText ? doc.extractedText.length : 0;
      
      // Déterminer le nouveau statut OCR selon la qualité du texte
      let newOcrStatus = 'success';
      let ocrConfidence = 0.8;
      
      if (textLength < 50) {
        newOcrStatus = 'success'; // Mais faible confiance
        ocrConfidence = 0.3;
      } else if (textLength < 200) {
        ocrConfidence = 0.6;
      }
      
      try {
        const result = await prisma.document.update({
          where: { id: doc.id },
          data: {
            ocrStatus: newOcrStatus,
            ocrVendor: 'unified-service',
            ocrConfidence: ocrConfidence,
            ocrError: null // Nettoyer les anciennes erreurs
          }
        });
        
        updateResults.push({
          id: doc.id,
          filename: doc.filenameOriginal,
          success: true,
          newStatus: newOcrStatus,
          confidence: ocrConfidence
        });
        
        console.log(`✅ ${doc.filenameOriginal}: ${newOcrStatus} (${Math.round(ocrConfidence * 100)}%)`);
        
      } catch (error) {
        updateResults.push({
          id: doc.id,
          filename: doc.filenameOriginal,
          success: false,
          error: error.message
        });
        
        console.error(`❌ ${doc.filenameOriginal}: ${error.message}`);
      }
    }
    
    // 4. Résumé des résultats
    console.log('\n3️⃣ Résumé:');
    const successCount = updateResults.filter(r => r.success).length;
    const errorCount = updateResults.filter(r => !r.success).length;
    
    console.log(`✅ Succès: ${successCount} documents`);
    console.log(`❌ Erreurs: ${errorCount} documents`);
    
    if (errorCount > 0) {
      console.log('\n❌ Documents en erreur:');
      updateResults.filter(r => !r.success).forEach(r => {
        console.log(`   ${r.filename}: ${r.error}`);
      });
    }
    
    // 5. Vérification finale
    console.log('\n4️⃣ Vérification finale...');
    
    const remainingPendingWithText = await prisma.document.count({
      where: {
        ocrStatus: 'pending',
        extractedText: {
          not: null
        },
        AND: {
          NOT: {
            extractedText: ''
          }
        }
      }
    });
    
    if (remainingPendingWithText === 0) {
      console.log('✅ Correction terminée avec succès ! Plus de documents avec OCR pending mais texte extrait.');
    } else {
      console.log(`⚠️ Il reste encore ${remainingPendingWithText} documents à corriger manuellement.`);
    }
    
    // 6. Statistiques finales
    const ocrStats = await prisma.$queryRaw`
      SELECT 
        ocrStatus,
        COUNT(*) as count
      FROM Document 
      WHERE deletedAt IS NULL
      GROUP BY ocrStatus
      ORDER BY count DESC
    `;
    
    console.log('\n📈 Statistiques OCR finales:');
    ocrStats.forEach(stat => {
      console.log(`   ${stat.ocrStatus}: ${stat.count} documents`);
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
fixPendingOcrStatus();
