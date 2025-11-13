import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Schéma de validation pour la création en bulk
const createBulkTransactionsSchema = z.object({
  base: z.object({
    propertyId: z.string().min(1, 'L\'ID du bien est requis'),
    leaseId: z.string().optional().or(z.literal('')),
    tenantId: z.string().optional().or(z.literal('')),
    nature: z.string().min(1, 'La nature est requise'),
    categoryId: z.string().min(1, 'La catégorie est requise'),
    label: z.string().min(1, 'Le libellé est requis'),
    reference: z.string().optional().or(z.literal('')),
    paidAt: z.string().optional().or(z.literal('')),
    method: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
    sendEmail: z.boolean().default(false),
  }),
  schedule: z.object({
    startMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Format invalide (attendu: YYYY-MM)'),
    months: z.number().min(1, 'Le nombre de mois doit être supérieur à 0'),
    autoSplit: z.boolean().default(false),
    amount: z.number().positive('Le montant doit être positif'),
  })
});

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Validation Zod
    const validatedData = createBulkTransactionsSchema.parse(data);
    const { base, schedule } = validatedData;

    // Vérifier que la nature et la catégorie sont compatibles
    const nature = await prisma.natureEntity.findUnique({
      where: { code: base.nature },
      include: {
        NatureRule: {
          select: { allowedType: true }
        }
      }
    });

    if (!nature) {
      return NextResponse.json(
        { error: 'Nature non trouvée' },
        { status: 404 }
      );
    }

    const category = await prisma.category.findUnique({
      where: { id: base.categoryId },
      select: { type: true }
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Catégorie non trouvée' },
        { status: 404 }
      );
    }

    const allowedTypes = nature.DocumentExtractionRule.map(rule => rule.allowedType);
    if (!allowedTypes.includes(category.type)) {
      return NextResponse.json(
        { error: 'La catégorie sélectionnée n\'est pas compatible avec cette nature' },
        { status: 400 }
      );
    }

    // Générer les transactions selon le mode
    const transactions = [];
    const [year, month] = schedule.startMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1); // Premier jour du mois

    if (schedule.autoSplit) {
      // Mode répartition : montant total réparti sur N mois
      const totalAmount = schedule.amount;
      const amountPerMonth = Math.floor(totalAmount / schedule.months * 100) / 100;
      const remainder = Math.round((totalAmount - amountPerMonth * schedule.months) * 100) / 100;

      for (let i = 0; i < schedule.months; i++) {
        const currentDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        const amount = i === schedule.months - 1 ? amountPerMonth + remainder : amountPerMonth;
        
        transactions.push({
          propertyId: base.propertyId,
          leaseId: base.leaseId || null,
          categoryId: base.categoryId,
          label: `${base.label} - ${currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
          amount: amount,
          date: currentDate,
          nature: base.nature,
          paidAt: base.paidAt ? new Date(base.paidAt) : null,
          method: base.method || null,
          notes: base.notes || null,
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
        });
      }
    } else {
      // Mode mensuel : même montant pour chaque mois
      for (let i = 0; i < schedule.months; i++) {
        const currentDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        
        transactions.push({
          propertyId: base.propertyId,
          leaseId: base.leaseId || null,
          categoryId: base.categoryId,
          label: `${base.label} - ${currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
          amount: schedule.amount,
          date: currentDate,
          nature: base.nature,
          paidAt: base.paidAt ? new Date(base.paidAt) : null,
          method: base.method || null,
          notes: base.notes || null,
          month: currentDate.getMonth() + 1,
          year: currentDate.getFullYear(),
        });
      }
    }

    // Créer toutes les transactions en une seule transaction Prisma
    const result = await prisma.$transaction(async (tx) => {
      const createdTransactions = [];
      
      for (const transactionData of transactions) {
        const transaction = await tx.transaction.create({
          data: transactionData
        });
        createdTransactions.push(transaction);
      }

      // TODO: Gérer l'envoi d'emails si sendEmail = true
      // TODO: Gérer l'upload de documents

      return createdTransactions;
    });

    return NextResponse.json({
      transactions: result,
      count: result.length,
      total: transactions.reduce((sum, tx) => sum + tx.amount, 0)
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating bulk transactions:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur lors de la création des transactions', details: error.message },
      { status: 500 }
    );
  }
}
