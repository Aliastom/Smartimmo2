import { NextRequest, NextResponse } from 'next/server';
import { leaseRepository } from '../../../../../infra/repositories/leaseRepository';
import { documentRepository } from '../../../../../infra/repositories/documentRepository';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { renderToStream } from '@react-pdf/renderer';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import React from 'react';
import LeasePdf from '../../../../../pdf/LeasePdf';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

function generateHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function generateSlug(fileName: string): string {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    // Récupérer le bail avec les données associées
    const lease = await leaseRepository.findById(params.id, organizationId);
    
    if (!lease) {
      return NextResponse.json({ error: 'Bail non trouvé' }, { status: 404 });
    }

    if (!lease.Property) {
      return NextResponse.json({ error: 'Propriété non trouvée pour ce bail' }, { status: 404 });
    }

    if (!lease.Tenant) {
      return NextResponse.json({ error: 'Locataire non trouvé pour ce bail' }, { status: 404 });
    }

    // Préparer les données pour le PDF
    const generatedAt = new Date().toISOString();
    const pdfData = {
      lease: {
        id: lease.id,
        type: lease.type,
        startDate: lease.startDate.toISOString(),
        endDate: lease.endDate ? lease.endDate.toISOString() : null,
        rentAmount: Number(lease.rentAmount),
        charges: Number(lease.chargesRecupMensuelles || 0) + Number(lease.chargesNonRecupMensuelles || 0), // Total des charges pour compatibilité PDF
        chargesRecupMensuelles: Number(lease.chargesRecupMensuelles || 0),
        chargesNonRecupMensuelles: Number(lease.chargesNonRecupMensuelles || 0),
        deposit: lease.deposit ? Number(lease.deposit) : null,
        paymentDay: lease.paymentDay || null,
        status: lease.status,
        notes: lease.notes,
        furnishedType: lease.furnishedType,
      },
      Property: {
        name: lease.Property.name,
        address: lease.Property.address,
        city: lease.Property.city || '',
        postalCode: lease.Property.postalCode || '',
        surface: lease.Property.surface ? Number(lease.Property.surface) : undefined,
        rooms: lease.Property.rooms || undefined,
      },
      Tenant: {
        firstName: lease.Tenant.firstName,
        lastName: lease.Tenant.lastName,
        email: lease.Tenant.email,
        phone: lease.Tenant.phone || null,
        birthDate: lease.Tenant.birthDate ? lease.Tenant.birthDate.toISOString() : null,
      },
      generatedAt,
    };

    // Générer le PDF avec react-pdf
    const pdfStream = await renderToStream(React.createElement(LeasePdf, pdfData));
    
    // Convertir le stream en buffer
    const chunks: Buffer[] = [];
    for await (const chunk of pdfStream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    // Calculer le hash
    const hash = generateHash(buffer);

    // Créer le nom de fichier
    const dateStr = new Date().toISOString().split('T')[0];
    const baseFileName = `Bail-${lease.Property.name}-${dateStr}.pdf`;
    const slug = generateSlug(baseFileName);
    const fileName = `${slug.replace('.pdf', '')}-${hash.substring(0, 8)}.pdf`;

    // Créer le chemin de stockage
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uploadPath = join(process.cwd(), 'public', 'uploads', String(year), month);
    const filePath = join(uploadPath, fileName);
    const url = `/uploads/${year}/${month}/${fileName}`;

    // Créer le dossier si nécessaire
    await mkdir(uploadPath, { recursive: true });

    // Sauvegarder le fichier
    await writeFile(filePath, buffer);

    // Créer le document en base de données
    const document = await documentRepository.create({
      fileName: baseFileName,
      mime: 'application/pdf',
      size: buffer.length,
      url,
      fileSha256: hash,
      docType: 'lease',
      propertyId: lease.propertyId,
      leaseId: lease.id,
    });

    return NextResponse.json({
      documentId: document.id,
      downloadUrl: url,
      fileName: baseFileName,
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de la génération du PDF', 
      details: error instanceof Error ? error.message : 'Erreur inconnue' 
    }, { status: 500 });
  }
}

