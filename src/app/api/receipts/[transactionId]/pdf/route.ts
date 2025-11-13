import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  try {
    const { transactionId } = params;

    // Récupérer la transaction avec ses relations
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        Lease_Transaction_leaseIdToLease: {
          include: {
            Property: true,
            Tenant: true,
          }
        }
      }
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction non trouvée' }, { status: 404 });
    }

    // Récupérer les métadonnées du document quittance
    const receiptDocument = await prisma.document.findFirst({
      where: {
        transactionId,
        type: 'RENT_RECEIPT'
      }
    });

    let rentAmount = transaction.Lease_Transaction_leaseIdToLease?.rentAmount || 0;
    let chargesAmount = transaction.Lease_Transaction_leaseIdToLease?.chargesRecupMensuelles || 0;

    // Si le document a des métadonnées, utiliser les montants personnalisés
    if (receiptDocument?.tagsJson) {
      try {
        const metadata = JSON.parse(receiptDocument.tagsJson);
        if (metadata.rentAmount !== undefined) rentAmount = metadata.rentAmount;
        if (metadata.chargesAmount !== undefined) chargesAmount = metadata.chargesAmount;
      } catch (error) {
        console.warn('Erreur parsing métadonnées du document:', error);
      }
    }

    // Pour l'instant, retourner les données JSON au lieu du PDF
    // TODO: Implémenter la génération PDF côté serveur
    return NextResponse.json({
      message: 'PDF généré avec succès (données JSON)',
      transactionId,
      receiptData: {
        month: new Date(transaction.date).toLocaleDateString('fr-FR', { month: 'long' }),
        year: new Date(transaction.date).getFullYear(),
        propertyAddress: transaction.Lease_Transaction_leaseIdToLease?.Property?.address || 'Adresse non renseignée',
        tenantName: `${transaction.Lease_Transaction_leaseIdToLease?.Tenant?.firstName || ''} ${transaction.Lease_Transaction_leaseIdToLease?.Tenant?.lastName || ''}`.trim(),
        rent: rentAmount,
        charges: chargesAmount,
        total: rentAmount + chargesAmount,
        paymentDate: transaction.date.toISOString(),
      },
      document: receiptDocument ? {
        id: receiptDocument.id,
        fileName: receiptDocument.fileName,
        url: receiptDocument.url,
        tagsJson: receiptDocument.tagsJson,
      } : null,
    });

  } catch (error) {
    console.error('Error getting receipt data:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des données' }, { status: 500 });
  }
}
