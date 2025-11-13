import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    // Types de documents par défaut
    const defaultDocumentTypes = [
      {
        code: 'SIGNED_LEASE',
        label: 'Bail signé',
        icon: '📄',
        isSystem: true,
        isActive: true,
        order: 0,
        isSensitive: false,
        defaultContexts: JSON.stringify(['lease']),
        suggestionConfig: JSON.stringify({
          patterns: ['bail.*signe', 'contrat.*signe', 'lease.*signed'],
          mimeTypes: ['application/pdf']
        })
      },
      {
        code: 'RENT_RECEIPT',
        label: 'Quittance de loyer',
        icon: '💰',
        isSystem: true,
        isActive: true,
        order: 1,
        isSensitive: false,
        defaultContexts: JSON.stringify(['transaction', 'lease', 'property']),
        suggestionConfig: JSON.stringify({
          patterns: ['quittance', 'loyer', 'rent.*receipt'],
          mimeTypes: ['application/pdf']
        })
      },
      {
        code: 'LEASE_DRAFT',
        label: 'Brouillon de bail',
        icon: '📝',
        isSystem: true,
        isActive: true,
        order: 3,
        isSensitive: false,
        defaultContexts: JSON.stringify(['lease', 'property']),
        suggestionConfig: JSON.stringify({
          patterns: ['bail.*brouillon', 'draft.*lease', 'contrat.*brouillon'],
          mimeTypes: ['application/pdf']
        })
      },
      {
        code: 'EDL_IN',
        label: 'État des lieux d\'entrée',
        icon: '🏠',
        isSystem: true,
        isActive: true,
        order: 4,
        isSensitive: false,
        defaultContexts: JSON.stringify(['property', 'lease']),
        suggestionConfig: JSON.stringify({
          patterns: ['etat.*lieux.*entree', 'edl.*in', 'etat.*entree'],
          mimeTypes: ['application/pdf', 'image/jpeg', 'image/png']
        })
      },
      {
        code: 'EDL_OUT',
        label: 'État des lieux de sortie',
        icon: '🚪',
        isSystem: true,
        isActive: true,
        order: 5,
        isSensitive: false,
        defaultContexts: JSON.stringify(['property', 'lease']),
        suggestionConfig: JSON.stringify({
          patterns: ['etat.*lieux.*sortie', 'edl.*out', 'etat.*sortie'],
          mimeTypes: ['application/pdf', 'image/jpeg', 'image/png']
        })
      },
      {
        code: 'INSURANCE',
        label: 'Assurance',
        icon: '🛡️',
        isSystem: true,
        isActive: true,
        order: 6,
        isSensitive: false,
        defaultContexts: JSON.stringify(['property', 'lease', 'tenant']),
        suggestionConfig: JSON.stringify({
          patterns: ['assurance', 'insurance', 'garantie'],
          mimeTypes: ['application/pdf']
        })
      },
      {
        code: 'TAX',
        label: 'Impôts',
        icon: '🏛️',
        isSystem: true,
        isActive: true,
        order: 7,
        isSensitive: false,
        defaultContexts: JSON.stringify(['property']),
        suggestionConfig: JSON.stringify({
          patterns: ['impot', 'tax', 'fiscal'],
          mimeTypes: ['application/pdf']
        })
      },
      {
        code: 'RIB',
        label: 'Relevé d\'identité bancaire',
        icon: '🏦',
        isSystem: true,
        isActive: true,
        order: 8,
        isSensitive: true,
        defaultContexts: JSON.stringify(['tenant', 'lease']),
        suggestionConfig: JSON.stringify({
          patterns: ['rib', 'releve.*identite', 'bancaire'],
          mimeTypes: ['application/pdf', 'image/jpeg', 'image/png']
        })
      },
      {
        code: 'PHOTO',
        label: 'Photo',
        icon: '📷',
        isSystem: true,
        isActive: true,
        order: 9,
        isSensitive: false,
        defaultContexts: JSON.stringify(['property']),
        suggestionConfig: JSON.stringify({
          patterns: ['photo', 'image', 'picture'],
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp']
        })
      },
      {
        code: 'MISC',
        label: 'Divers',
        icon: '📁',
        isSystem: true,
        isActive: true,
        order: 10,
        isSensitive: false,
        defaultContexts: JSON.stringify(['global']),
        suggestionConfig: JSON.stringify({
          patterns: ['divers', 'misc', 'autre'],
          mimeTypes: ['application/pdf', 'image/jpeg', 'image/png']
        })
      },
      {
        code: 'ID_DOC',
        label: 'Pièce d\'identité',
        icon: '🆔',
        isSystem: false,
        isActive: true,
        order: 0,
        isSensitive: true,
        defaultContexts: JSON.stringify(['tenant']),
        suggestionConfig: JSON.stringify({
          patterns: ['identite', 'id', 'carte.*identite', 'passport'],
          mimeTypes: ['image/jpeg', 'image/png', 'application/pdf']
        })
      }
    ];

    // Créer les types s'ils n'existent pas
    const createdTypes = [];
    for (const docType of defaultDocumentTypes) {
      const existing = await prisma.documentType.findUnique({
        where: { code: docType.code }
      });

      if (!existing) {
        const created = await prisma.documentType.create({
          data: docType
        });
        createdTypes.push(created);
      }
    }

    return NextResponse.json({
      message: 'Types de documents initialisés avec succès',
      created: createdTypes.length,
      types: createdTypes
    });

  } catch (error) {
    console.error('Error initializing document types:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'initialisation des types de documents' },
      { status: 500 }
    );
  }
}
