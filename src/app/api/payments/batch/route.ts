import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { validateNatureCategory } from '@/utils/transactionValidation';

export async function POST(request: NextRequest) {
  try {
    const { base, periods, attachments } = await request.json();
    
    console.log('[API /payments/batch] Request data:', {
      base: base ? Object.keys(base) : null,
      periodsCount: periods?.length,
      attachmentsCount: attachments?.length,
    });

    // Validation
    if (!base || !periods || periods.length === 0) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    const { propertyId, leaseId, date, method, reference, notes, nature, accountingCategoryId, label } = base;

    // Validation nature/catégorie + créer snapshot
    let categorySnapshot = null;
    if (accountingCategoryId) {
      // Valider la compatibilité nature/catégorie
      const validation = await validateNatureCategory(nature, accountingCategoryId);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      const category = await prisma.category.findUnique({
        where: { id: accountingCategoryId },
        select: { 
          label: true,
          type: true,
          deductible: true,
          capitalizable: true,
        },
      });

      if (!category) {
        return NextResponse.json({ error: 'Catégorie comptable introuvable' }, { status: 400 });
      }

      // Créer le snapshot pour figer l'historique
      categorySnapshot = JSON.stringify({
        name: category.label,
        type: category.type,
        deductible: category.deductible,
        capitalizable: category.capitalizable,
      });
    }

    // Créer les paiements pour chaque période
    const createdPayments = [];
    
    for (const period of periods) {
      const payment = await prisma.payment.create({
        data: {
          propertyId,
          leaseId: leaseId || null,
          periodYear: period.year,
          periodMonth: period.month,
          date: new Date(date),
          amount: period.amount,
          nature: nature || 'AUTRE',
          categoryId: accountingCategoryId || null,
          snapshotAccounting: categorySnapshot,
          label,
          method: method || null,
          reference: reference || null,
          notes: notes || null,
        },
      });
      
      createdPayments.push(payment);
    }

    // Traiter les pièces jointes si présentes
    if (attachments && attachments.length > 0 && createdPayments.length > 0) {
      console.log('[API /payments/batch] Processing attachments:', attachments.length);
      // Attacher aux paiements créés (pour simplifier, on attache au premier)
      const firstPayment = createdPayments[0];
      
      for (const att of attachments) {
        const { name, base64, mime, documentTypeId } = att;
        console.log('[API /payments/batch] Processing attachment:', { name, mime, documentTypeId });
        
        // Décoder le base64
        const buffer = Buffer.from(base64.split(',')[1] || base64, 'base64');
        
        // Créer le chemin de stockage
        const now = new Date();
        const yearDir = now.getFullYear();
        const monthDir = String(now.getMonth() + 1).padStart(2, '0');
        const timestamp = Date.now();
        const filename = `${timestamp}_${name}`;
        const uploadPath = join(process.cwd(), 'public', 'uploads', 'documents', String(yearDir), monthDir);
        const filePath = join(uploadPath, filename);
        const url = `/uploads/documents/${yearDir}/${monthDir}/${filename}`;

        // Créer le dossier si nécessaire
        await mkdir(uploadPath, { recursive: true });

        // Sauvegarder le fichier
        await writeFile(filePath, buffer);

        // Créer le document avec le type spécifié
        await prisma.document.create({
          data: {
            fileName: name,
            mime: mime,
            size: buffer.length,
            url,
            documentTypeId: documentTypeId && documentTypeId !== '' ? documentTypeId : null, // Utiliser le type fourni ou null
            propertyId: propertyId,
            leaseId: leaseId,
            // Pas de transactionId car on crée des Payment, pas des Transaction
            metadata: JSON.stringify({
              source: 'payment_upload',
              paymentId: firstPayment.id, // Lier au paiement via metadata
              uploadedAt: new Date().toISOString(),
            }),
          },
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      payments: createdPayments,
      count: createdPayments.length 
    });
  } catch (error: any) {
    console.error('Error creating payments:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la création des paiements',
      details: error.message 
    }, { status: 500 });
  }
}

