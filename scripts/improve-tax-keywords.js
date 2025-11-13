import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function improveTaxKeywords() {
  try {
    console.log('🚀 Amélioration des mots-clés pour les avis d\'impôt...');

    // Trouver le type AVIS_IMPOSITION
    const avisImpositionType = await prisma.documentType.findFirst({
      where: { code: 'AVIS_IMPOSITION' },
      include: { keywords: true, signals: true }
    });

    if (avisImpositionType) {
      console.log('📄 Amélioration du type AVIS_IMPOSITION...');

      // Supprimer les anciens mots-clés
      await prisma.documentKeyword.deleteMany({
        where: { documentTypeId: avisImpositionType.id }
      });

      // Ajouter les nouveaux mots-clés avec poids optimisés pour les avis d'impôt
      const avisKeywords = [
        { keyword: 'avis d\'imposition', weight: 4, context: 'titre' },
        { keyword: 'avis de mise en recouvrement', weight: 3, context: 'titre' },
        { keyword: 'direction générale des finances publiques', weight: 2.5, context: 'organisme' },
        { keyword: 'dgfip', weight: 2, context: 'organisme' },
        { keyword: 'taxe foncière', weight: 2, context: 'type_taxe' },
        { keyword: 'propriétés bâties', weight: 1.5, context: 'type_taxe' },
        { keyword: 'base d\'imposition', weight: 2, context: 'montant' },
        { keyword: 'montant dû', weight: 1.5, context: 'montant' },
        { keyword: 'exercice', weight: 1, context: 'année' },
        { keyword: 'date limite de paiement', weight: 1.5, context: 'date' },
        { keyword: 'virement', weight: 0.5, context: 'paiement' },
        { keyword: 'chèque', weight: 0.5, context: 'paiement' },
        { keyword: 'propriétaire', weight: 1, context: 'partie' },
        { keyword: 'référence', weight: 1, context: 'numero' },
        { keyword: 'service des impôts', weight: 1, context: 'organisme' }
      ];

      for (const kw of avisKeywords) {
        await prisma.documentKeyword.create({
          data: {
            documentTypeId: avisImpositionType.id,
            keyword: kw.keyword,
            weight: kw.weight,
            context: kw.context
          }
        });
      }

      // Vérifier si les signaux spécifiques existent
      const existingSignals = avisImpositionType.signals.map(s => s.code);
      
      if (!existingSignals.includes('HEADER_IMPOTS')) {
        await prisma.documentSignal.create({
          data: {
            documentTypeId: avisImpositionType.id,
            code: 'HEADER_IMPOTS',
            label: 'En-tête impôts',
            weight: 2
          }
        });
      }

      if (!existingSignals.includes('MONEY_PATTERN')) {
        await prisma.documentSignal.create({
          data: {
            documentTypeId: avisImpositionType.id,
            code: 'MONEY_PATTERN',
            label: 'Pattern monétaire',
            weight: 1
          }
        });
      }

      if (!existingSignals.includes('DATE_PATTERN')) {
        await prisma.documentSignal.create({
          data: {
            documentTypeId: avisImpositionType.id,
            code: 'DATE_PATTERN',
            label: 'Pattern de date',
            weight: 1
          }
        });
      }

      console.log('✅ Type AVIS_IMPOSITION amélioré');
    } else {
      console.log('⚠️  Type AVIS_IMPOSITION non trouvé');
    }

    // Améliorer aussi ATTESTATION_ASSURANCE_HABITATION
    const assuranceType = await prisma.documentType.findFirst({
      where: { code: 'ATTESTATION_ASSURANCE_HABITATION' },
      include: { keywords: true, signals: true }
    });

    if (assuranceType) {
      console.log('📄 Amélioration du type ATTESTATION_ASSURANCE_HABITATION...');

      // Supprimer les anciens mots-clés
      await prisma.documentKeyword.deleteMany({
        where: { documentTypeId: assuranceType.id }
      });

      // Ajouter les nouveaux mots-clés avec poids optimisés pour les assurances
      const assuranceKeywords = [
        { keyword: 'attestation d\'assurance habitation', weight: 4, context: 'titre' },
        { keyword: 'assurance habitation', weight: 3, context: 'type' },
        { keyword: 'compagnie d\'assurance', weight: 2, context: 'organisme' },
        { keyword: 'police', weight: 2, context: 'numero' },
        { keyword: 'assuré', weight: 1.5, context: 'partie' },
        { keyword: 'garanties', weight: 2, context: 'contenu' },
        { keyword: 'incendie', weight: 1.5, context: 'garantie' },
        { keyword: 'vol', weight: 1.5, context: 'garantie' },
        { keyword: 'responsabilité civile', weight: 1.5, context: 'garantie' },
        { keyword: 'période de validité', weight: 1.5, context: 'duree' },
        { keyword: 'prime annuelle', weight: 1.5, context: 'montant' },
        { keyword: 'conditions générales', weight: 1, context: 'legal' },
        { keyword: 'habitation', weight: 1, context: 'type' }
      ];

      for (const kw of assuranceKeywords) {
        await prisma.documentKeyword.create({
          data: {
            documentTypeId: assuranceType.id,
            keyword: kw.keyword,
            weight: kw.weight,
            context: kw.context
          }
        });
      }

      // Ajouter des signaux spécifiques
      const existingAssuranceSignals = assuranceType.signals.map(s => s.code);
      
      if (!existingAssuranceSignals.includes('HEADER_ASSUREUR')) {
        await prisma.documentSignal.create({
          data: {
            documentTypeId: assuranceType.id,
            code: 'HEADER_ASSUREUR',
            label: 'En-tête assureur',
            weight: 2
          }
        });
      }

      console.log('✅ Type ATTESTATION_ASSURANCE_HABITATION amélioré');
    } else {
      console.log('⚠️  Type ATTESTATION_ASSURANCE_HABITATION non trouvé');
    }

    console.log('🎉 Amélioration des mots-clés terminée !');
    
    // Afficher un résumé
    console.log('\n📊 Résumé des améliorations:');
    console.log('- AVIS_IMPOSITION: Mots-clés optimisés avec "avis d\'imposition" (+4), "DGFIP" (+2), "taxe foncière" (+2)');
    console.log('- ATTESTATION_ASSURANCE_HABITATION: Mots-clés optimisés avec "attestation d\'assurance habitation" (+4), "police" (+2)');
    console.log('- Signaux spécifiques ajoutés pour chaque type');
    console.log('- Simulation de texte réaliste pour les avis d\'impôt et assurances');

  } catch (error) {
    console.error('❌ Erreur lors de l\'amélioration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

improveTaxKeywords();
