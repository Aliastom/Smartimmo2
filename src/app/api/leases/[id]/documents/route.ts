import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leaseId = params.id;

    // Récupérer tous les documents liés au bail via DocumentLink
    const documentLinks = await prisma.documentLink.findMany({
      where: {
        linkedType: 'lease',
        linkedId: leaseId
      },
      include: {
        Document: {
          include: {
            DocumentType: true
          }
        }
      }
    });

    const documents = documentLinks.map(link => link.Document);

    // Organiser les documents par type
    const summary = {
      bailSigne: null,
      etatLieuxEntrant: null,
      etatLieuxSortant: null,
      assuranceLocataire: null,
      depotGarantie: null,
      otherDocuments: []
    };

    for (const doc of documents) {
      const documentType = doc.DocumentType?.code || '';
      
      const documentData = {
        id: doc.id,
        filenameOriginal: doc.filenameOriginal || doc.fileName || 'Document',
        DocumentType: {
          code: doc.DocumentType?.code || '',
          label: doc.DocumentType?.label || 'Document'
        },
        url: doc.url || '',
        createdAt: doc.createdAt.toISOString(),
        status: doc.status || 'classified'
      };
      
      switch (documentType) {
        case 'BAIL_SIGNE':
          summary.bailSigne = documentData;
          break;
        case 'ETAT_LIEUX_ENTRANT':
          summary.etatLieuxEntrant = documentData;
          break;
        case 'ETAT_LIEUX_SORTANT':
          summary.etatLieuxSortant = documentData;
          break;
        case 'ASSURANCE_LOCATAIRE':
          summary.assuranceLocataire = documentData;
          break;
        case 'DEPOT_GARANTIE':
          summary.depotGarantie = documentData;
          break;
        default:
          summary.otherDocuments.push(documentData);
      }
    }

    return NextResponse.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des documents du bail:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la récupération des documents',
        details: error instanceof Error ? error.message : 'Erreur inconnue'
      },
      { status: 500 }
    );
  }
}
