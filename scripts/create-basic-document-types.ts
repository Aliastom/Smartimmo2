import { prisma } from '@/lib/prisma';

async function main() {
  try {
    console.log('🏗️ Création des types de documents de base...\n');

    // Types de documents essentiels
    const documentTypes = [
      {
        code: 'BAIL_SIGNE',
        label: 'Bail signé',
        description: 'Document de bail signé par le locataire',
        icon: 'file-text',
        scope: 'global',
        isSystem: false,
        isRequired: false,
        order: 10,
        isActive: true,
        isSensitive: false,
        autoAssignThreshold: 0.8,
        versioningEnabled: true
      },
      {
        code: 'QUITTANCE_LOYER',
        label: 'Quittance de loyer',
        description: 'Quittance de paiement du loyer',
        icon: 'receipt',
        scope: 'global',
        isSystem: false,
        isRequired: false,
        order: 20,
        isActive: true,
        isSensitive: false,
        autoAssignThreshold: 0.8,
        versioningEnabled: true
      },
      {
        code: 'AVIS_ECHEANCE',
        label: 'Avis d\'échéance',
        description: 'Avis d\'échéance de loyer',
        icon: 'calendar',
        scope: 'global',
        isSystem: false,
        isRequired: false,
        order: 30,
        isActive: true,
        isSensitive: false,
        autoAssignThreshold: 0.8,
        versioningEnabled: true
      },
      {
        code: 'FACTURE_CHARGES',
        label: 'Facture de charges',
        description: 'Facture pour les charges de copropriété',
        icon: 'file-text',
        scope: 'global',
        isSystem: false,
        isRequired: false,
        order: 40,
        isActive: true,
        isSensitive: false,
        autoAssignThreshold: 0.8,
        versioningEnabled: true
      },
      {
        code: 'CONTRAT_ASSURANCE',
        label: 'Contrat d\'assurance',
        description: 'Contrat d\'assurance propriétaire',
        icon: 'shield',
        scope: 'global',
        isSystem: false,
        isRequired: false,
        order: 50,
        isActive: true,
        isSensitive: false,
        autoAssignThreshold: 0.8,
        versioningEnabled: true
      },
      {
        code: 'AUTRE',
        label: 'Autre document',
        description: 'Document non classé',
        icon: 'file',
        scope: 'global',
        isSystem: false,
        isRequired: false,
        order: 999,
        isActive: true,
        isSensitive: false,
        autoAssignThreshold: 0.0,
        versioningEnabled: true
      }
    ];

    let createdCount = 0;
    for (const docType of documentTypes) {
      try {
        await prisma.documentType.create({
          data: docType
        });
        console.log(`✅ Créé: ${docType.label} (${docType.code})`);
        createdCount++;
      } catch (error: any) {
        if (error.code === 'P2002') { // Unique constraint failed
          console.log(`⏭️  Type "${docType.label}" existe déjà.`);
        } else {
          console.error(`❌ Erreur pour ${docType.label}:`, error);
        }
      }
    }

    console.log(`\n🎉 ${createdCount} types de documents créés avec succès !`);
    const totalTypes = await prisma.documentType.count();
    console.log(`📊 Total des types de documents dans la base: ${totalTypes}`);

  } catch (error: any) {
    console.error('❌ Erreur lors de la création des types de documents:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
