import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

// Palette de couleurs pour les types de documents (par code ET par label pour compatibilité)

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const TYPE_COLORS: Record<string, string> = {
  // Par code
  'QUITTANCE_LOYER': '#3b82f6', // blue
  'BAIL_SIGNE': '#10b981', // green
  'RELEVE_BANCAIRE': '#f59e0b', // amber
  'TAXE_FONCIERE': '#ef4444', // red
  'FACTURE_TRAVAUX': '#8b5cf6', // violet
  'PHOTO_BIEN': '#ec4899', // pink
  'AUTRE': '#6b7280', // gray
  // Par label (fallback)
  'Quittance de loyer': '#3b82f6',
  'Bail signé': '#10b981',
  'Relevé bancaire': '#f59e0b',
  'Taxe foncière': '#ef4444',
  'Facture travaux': '#8b5cf6',
  'Photo du bien': '#ec4899',
  'Diagnostic': '#06b6d4', // cyan
  'Autre': '#6b7280',
};

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const searchParams = request.nextUrl.searchParams;
    
    // Récupérer les paramètres de filtre
    const periodStart = searchParams.get('periodStart'); // Format: YYYY-MM
    const periodEnd = searchParams.get('periodEnd'); // Format: YYYY-MM
    const propertyId = searchParams.get('propertyId'); // Pour filtrer par bien

    // Si propertyId est fourni, d'abord récupérer les IDs de documents liés à ce bien
    let documentIdsForProperty: string[] | undefined;
    if (propertyId) {
      const property = await prisma.property.findFirst({
        where: { id: propertyId, organizationId },
        select: { id: true },
      });

      if (!property) {
        return NextResponse.json(
          { error: 'Bien introuvable' },
          { status: 404 }
        );
      }

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
      
      // Si aucun document n'est lié à ce bien, retourner des graphiques vides
      if (documentIdsForProperty.length === 0) {
        return NextResponse.json({
          monthly: [],
          byType: [],
          linksDistribution: {
            noLinks: 0,
            oneLink: 0,
            twoLinks: 0,
            threeOrMore: 0,
          },
        });
      }
    }

    // Construire les filtres Prisma
    const where: any = {
      deletedAt: null,
      organizationId,
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
        documentTypeId: true,
        ocrStatus: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Charger les types de documents pour le mapping des labels
    const documentTypes = await prisma.documentType.findMany({
      select: {
        id: true,
        code: true,
        label: true,
      },
    });

    // 1. Calculer l'évolution mensuelle (nombre de documents uploadés par mois)
    const monthlyMap = new Map<string, number>();

    // Générer tous les mois dans la période
    const months: string[] = [];
    if (periodStart && periodEnd) {
      const [startYear, startMonth] = periodStart.split('-').map(Number);
      const [endYear, endMonth] = periodEnd.split('-').map(Number);
      
      let currentDate = new Date(startYear, startMonth - 1, 1);
      const endDate = new Date(endYear, endMonth - 1, 1);

      while (currentDate <= endDate) {
        const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        months.push(month);
        monthlyMap.set(month, 0);
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    // Remplir les données mensuelles
    for (const doc of documents) {
      const createdDate = new Date(doc.createdAt);
      const month = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (monthlyMap.has(month)) {
        monthlyMap.set(month, (monthlyMap.get(month) || 0) + 1);
      }
    }

    const monthly = months.map((month) => ({
      month,
      count: monthlyMap.get(month) || 0,
    }));

    // 2. Calculer la répartition par type de document
    const typeCountMap = new Map<string, { label: string; code: string; count: number }>();
    
    for (const doc of documents) {
      // Utiliser documentTypeId pour trouver le type
      let typeLabel = 'Autre';
      let typeCode = 'AUTRE';
      
      if (doc.documentTypeId) {
        const docType = documentTypes.find(t => t.id === doc.documentTypeId);
        if (docType) {
          typeLabel = docType.label;
          typeCode = docType.code;
        }
      }
      
      const key = typeLabel;
      const existing = typeCountMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        typeCountMap.set(key, { label: typeLabel, code: typeCode, count: 1 });
      }
    }

    const byType = Array.from(typeCountMap.values())
      .map((item) => ({
        type: item.label,
        count: item.count,
        color: TYPE_COLORS[item.code] || TYPE_COLORS[item.label] || '#6b7280',
      }))
      .sort((a, b) => b.count - a.count);

    // 3. Calculer la répartition par nombre de liaisons
    const documentIds = documents.map(d => d.id);
    const documentLinks = await prisma.documentLink.findMany({
      where: {
        documentId: { in: documentIds }
      },
      select: {
        documentId: true
      }
    });

    // Compter le nombre de liens par document
    const linkCountMap = new Map<string, number>();
    for (const link of documentLinks) {
      linkCountMap.set(link.documentId, (linkCountMap.get(link.documentId) || 0) + 1);
    }

    // Répartir les documents par nombre de liens
    let noLinks = 0;
    let oneLink = 0;
    let twoLinks = 0;
    let threeOrMore = 0;

    for (const doc of documents) {
      const linkCount = linkCountMap.get(doc.id) || 0;
      
      if (linkCount === 0) {
        noLinks++;
      } else if (linkCount === 1) {
        oneLink++;
      } else if (linkCount === 2) {
        twoLinks++;
      } else {
        threeOrMore++;
      }
    }

    return NextResponse.json({
      monthly,
      byType,
      linksDistribution: {
        noLinks,
        oneLink,
        twoLinks,
        threeOrMore,
      },
    });
  } catch (error) {
    console.error('Erreur lors du calcul des graphiques documents:', error);
    return NextResponse.json(
      { error: 'Erreur lors du calcul des graphiques' },
      { status: 500 }
    );
  }
}

