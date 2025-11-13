import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const leaseId = searchParams.get('leaseId');
    const y = searchParams.get('y');
    const m = searchParams.get('m');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const q = searchParams.get('q');

    console.log('[GET /api/payments] Params:', { propertyId, leaseId, y, m, dateFrom, dateTo, q });

    // Construction du where
    const where: any = {};
    
    if (propertyId) where.propertyId = propertyId;
    if (leaseId) where.leaseId = leaseId;
    
    if (y && m) {
      where.periodYear = parseInt(y);
      where.periodMonth = parseInt(m);
    }
    
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }
    
    if (q) {
      where.OR = [
        { label: { contains: q, mode: 'insensitive' } },
        { reference: { contains: q, mode: 'insensitive' } }
      ];
    }

    // Si aucun filtre, limiter aux 100 dernières
    const hasFilters = propertyId || leaseId || y || m || dateFrom || dateTo || q;
    const take = hasFilters ? undefined : 100;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        Property: {
          select: { id: true, name: true }
        },
        Lease: {
          select: { 
            id: true, 
            Tenant: { 
              select: { firstName: true, lastName: true } 
            } 
          }
        },
        Category: {
          select: {
            id: true,
            slug: true,
            label: true,
            type: true,
            deductible: true,
            capitalizable: true,
          }
        },
        PaymentAttachment: true,
      },
      orderBy: [
        { date: 'desc' },
        { id: 'desc' }
      ],
      take,
    });

    console.log(`[GET /api/payments] Found ${payments.length} payments`);

    // Récupérer les documents liés aux paiements via metadata.paymentId
    const paymentsWithDocuments = await Promise.all(
      payments.map(async (payment) => {
        // Trouver les documents liés à ce paiement via metadata
        const paymentDocuments = await prisma.document.findMany({
          where: {
            metadata: {
              contains: `"paymentId":"${payment.id}"`
            }
          },
          select: {
            id: true,
            fileName: true,
            mime: true,
            size: true,
            url: true,
          DocumentType: {
            select: {
              code: true,
              label: true,
              icon: true,
            }
          },
            createdAt: true,
          }
        });

        return { ...payment, paymentDocuments };
      })
    );

    // Sérialiser les données
    const toDTO = (p: any) => ({
      id: p.id,
      propertyId: p.propertyId,
      leaseId: p.leaseId,
      periodYear: p.periodYear,
      periodMonth: p.periodMonth,
      date: p.date.toISOString(),
      amount: Number(p.amount),
      nature: p.nature,
      accountingCategoryId: p.categoryId,
      accountingCategory: p.accountingCategory,
      label: p.label,
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      Property: p.Property,
      lease: p.lease,
      attachments: [
        // Attachments du payment (ancien système)
        ...(p.attachments?.map((a: any) => ({
          id: a.id,
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
          url: a.url,
        })) ?? []),
        // Documents du paiement (nouveau système via metadata)
        ...(p.paymentDocuments?.map((d: any) => ({
          id: d.id,
          filename: d.fileName,
          mimeType: d.mime,
          size: d.size,
          url: d.url,
          documentType: d.DocumentType,
        })) ?? []),
      ],
    });

    const items = paymentsWithDocuments.map(toDTO);
    const total = items.reduce((sum, p) => sum + p.amount, 0);

    return NextResponse.json({ 
      items, 
      total,
      count: items.length 
    });
  } catch (error) {
    console.error('[GET /api/payments] Error:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la récupération des paiements',
      items: [],
      total: 0,
      count: 0
    }, { status: 500 });
  }
}
