import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Récupérer les paramètres de filtre
    const periodStart = searchParams.get('periodStart'); // Format: YYYY-MM
    const periodEnd = searchParams.get('periodEnd'); // Format: YYYY-MM
    const propertyId = searchParams.get('propertyId'); // Pour filtrer par bien

    // Si propertyId est fourni, d'abord récupérer les IDs de documents liés à ce bien
    let documentIdsForProperty: string[] | undefined;
    if (propertyId) {
      const links = await prisma.documentLink.findMany({
        where: {
          linkedType: 'property',
          linkedId: propertyId
        },
        select: {
          documentId: true
        }
      });
      documentIdsForProperty = links.map(link => link.documentId);
      
      // Si aucun document n'est lié à ce bien, retourner des KPI vides
      if (documentIdsForProperty.length === 0) {
        return NextResponse.json({
          total: 0,
          pending: 0,
          unclassified: 0,
          ocrFailed: 0,
          orphans: 0,
        });
      }
    }

    // Construire les filtres Prisma
    const where: any = {
      deletedAt: null, // Exclure les documents supprimés
    };

    // Filtre par période (date de création)
    if (periodStart && periodEnd) {
      const startDate = new Date(`${periodStart}-01T00:00:00.000Z`);
      const endDate = new Date(`${periodEnd}-01T00:00:00.000Z`);
      endDate.setMonth(endDate.getMonth() + 1); // Fin du mois
      
      where.createdAt = {
        gte: startDate,
        lt: endDate,
      };
    }

    // Filtre par IDs si propertyId fourni
    if (documentIdsForProperty) {
      where.id = {
        in: documentIdsForProperty
      };
    }

    // Récupérer tous les documents
    const documents = await prisma.document.findMany({
      where,
      select: {
        id: true,
        status: true,
        ocrStatus: true,
        documentTypeId: true,
      },
    });

    // Récupérer les liens de documents pour identifier les orphelins
    const documentIds = documents.map(d => d.id);
    const documentLinks = await prisma.documentLink.findMany({
      where: {
        documentId: { in: documentIds }
      },
      select: {
        documentId: true
      }
    });

    // Créer un Set des IDs de documents qui ont des liens
    const documentsWithLinks = new Set(documentLinks.map(link => link.documentId));

    // Calculer les KPI
    const total = documents.length;
    
    // En attente = OCR pending OU status pending
    const pending = documents.filter(d => 
      d.ocrStatus === 'pending' || 
      d.status === 'pending'
    ).length;
    
    // Non classés = pas de documentTypeId assigné
    const unclassified = documents.filter(d => 
      !d.documentTypeId
    ).length;
    
    // OCR échoué
    const ocrFailed = documents.filter(d => 
      d.ocrStatus === 'failed'
    ).length;
    
    // Orphelins = documents sans aucune liaison
    const orphans = documents.filter(d => 
      !documentsWithLinks.has(d.id)
    ).length;

    return NextResponse.json({
      total,
      pending,
      unclassified,
      ocrFailed,
      orphans,
    });
  } catch (error) {
    console.error('Erreur lors du calcul des KPI documents:', error);
    return NextResponse.json(
      { error: 'Erreur lors du calcul des KPI' },
      { status: 500 }
    );
  }
}

