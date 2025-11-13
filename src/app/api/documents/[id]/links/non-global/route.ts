import { NextRequest, NextResponse } from 'next/server';
import { listNonGlobalLinks, getLinkDisplayInfo } from '@/lib/docsSimple';

/**
 * GET /api/documents/[id]/links/non-global
 * Récupère toutes les liaisons non-globales d'un document avec leurs informations lisibles
 * Utilisé pour afficher la liste dans la modal d'alerte avant suppression
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;

    if (!documentId) {
      return NextResponse.json(
        { error: 'ID de document manquant' },
        { status: 400 }
      );
    }

    // Récupérer les liens bruts
    const rawLinks = await listNonGlobalLinks(documentId);

    // Enrichir avec les informations lisibles
    const linksWithInfo = await Promise.all(
      rawLinks.map(link => getLinkDisplayInfo(link.linkedType, link.linkedId))
    );

    return NextResponse.json({ 
      links: linksWithInfo,
      count: linksWithInfo.length
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des liens non-globaux:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des liens' },
      { status: 500 }
    );
  }
}

