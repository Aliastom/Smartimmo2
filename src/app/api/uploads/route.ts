import { NextRequest, NextResponse } from 'next/server';
import { documentRepository } from '../../../infra/repositories/documentRepository';
import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const uploadSchema = z.object({
  docType: z.enum(['invoice', 'receipt', 'lease', 'loan', 'tax', 'photo', 'other']).default('other'),
  tagsJson: z.string().optional(),
  propertyId: z.string().optional(),
  transactionId: z.string().optional(),
  leaseId: z.string().optional(),
  loanId: z.string().optional(),
});

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp'
];

function generateSlug(fileName: string): string {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    // Validation du fichier
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 10MB)' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Type de fichier non autorisé' }, { status: 400 });
    }

    // Validation des champs
    const fields = {
      docType: formData.get('docType') as string || 'other',
      tagsJson: formData.get('tagsJson') as string || undefined,
      propertyId: formData.get('propertyId') as string || undefined,
      transactionId: formData.get('transactionId') as string || undefined,
      leaseId: formData.get('leaseId') as string || undefined,
      loanId: formData.get('loanId') as string || undefined,
    };

    const validatedFields = uploadSchema.parse(fields);

    // Vérifier que les entités liées appartiennent à l'organisation
    if (validatedFields.propertyId) {
      const property = await prisma.property.findFirst({
        where: { id: validatedFields.propertyId, organizationId },
        select: { id: true },
      });
      if (!property) {
        return NextResponse.json({ error: 'Bien non trouvé ou inaccessible' }, { status: 403 });
      }
    }
    if (validatedFields.transactionId) {
      const transaction = await prisma.transaction.findFirst({
        where: { id: validatedFields.transactionId, organizationId },
        select: { id: true },
      });
      if (!transaction) {
        return NextResponse.json({ error: 'Transaction non trouvée ou inaccessible' }, { status: 403 });
      }
    }
    if (validatedFields.leaseId) {
      const lease = await prisma.lease.findFirst({
        where: { id: validatedFields.leaseId, organizationId },
        select: { id: true },
      });
      if (!lease) {
        return NextResponse.json({ error: 'Bail non trouvé ou inaccessible' }, { status: 403 });
      }
    }
    if (validatedFields.loanId) {
      const loan = await prisma.loan.findFirst({
        where: { id: validatedFields.loanId, organizationId },
        select: { id: true },
      });
      if (!loan) {
        return NextResponse.json({ error: 'Prêt non trouvé ou inaccessible' }, { status: 403 });
      }
    }

    // Lecture du fichier
    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = generateHash(buffer);
    const slug = generateSlug(file.name);
    const extension = file.name.split('.').pop() || '';
    
    // Création du chemin de stockage
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const fileName = `${slug}-${hash.substring(0, 8)}.${extension}`;
    const uploadPath = join(process.cwd(), 'public', 'uploads', String(year), month);
    const filePath = join(uploadPath, fileName);
    const url = `/uploads/${year}/${month}/${fileName}`;

    // Création du dossier si nécessaire
    await mkdir(uploadPath, { recursive: true });

    // Sauvegarde du fichier
    await writeFile(filePath, buffer);

    // Création du document en base
    const document = await documentRepository.create({
      fileName: file.name,
      mime: file.type,
      size: file.size,
      url,
      fileSha256: hash,
      docType: validatedFields.docType,
      tagsJson: validatedFields.tagsJson,
      propertyId: validatedFields.propertyId,
      transactionId: validatedFields.transactionId,
      leaseId: validatedFields.leaseId,
      loanId: validatedFields.loanId,
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('Error uploading file:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Erreur lors de l\'upload' }, { status: 500 });
  }
}
