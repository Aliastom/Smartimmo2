import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderToBuffer } from '@react-pdf/renderer';
import LeasePdf from '@/pdf/LeasePdf';
import { getProfileData } from '@/lib/services/profileService';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { getStorageService } from '@/services/storage.service';
import { buildLeaseSignatureEmail } from './emailTemplate';
import { getLogoPdfUrl } from '@/lib/branding';
import React from 'react';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

/** Statuts depuis lesquels on peut générer PDF + EML (premier envoi ou réessai). */
const SEND_FOR_SIGNATURE_ALLOWED_STATUSES = new Set<string>([
  'BROUILLON',
  'DRAFT',
  'À_ENVOYER',
  'A_ENVOYER',
  'TO_SEND',
  /** Canonique workflow UI (leaseWorkflowStatus) */
  'A_SIGNER',
  /** Réessai : PDF/EML déjà générés une fois, l’utilisateur retélécharge ou renvoie */
  'ENVOYÉ',
  'ENVOYE',
  'SENT',
]);

function canSendLeaseForSignature(status: string | null | undefined): boolean {
  if (status == null || status === '') return false;
  return SEND_FOR_SIGNATURE_ALLOWED_STATUSES.has(status);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leaseId = params.id;
    const body = await request.json();
    const { email, message } = body;

    // Authentification
    const user = await requireAuth();
    const organizationId = user.organizationId;

    // Vérifier que le bail existe
    const lease = await prisma.lease.findUnique({
      where: { id: leaseId },
      include: { 
        Tenant: true, 
        Property: true 
      }
    });

    if (!lease) {
      return NextResponse.json({ error: 'Bail non trouvé' }, { status: 404 });
    }

    // Vérifier que le bail appartient à l'organisation
    if (lease.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    if (!canSendLeaseForSignature(lease.status)) {
      return NextResponse.json(
        {
          error:
            'Le bail doit être en brouillon, à envoyer ou déjà envoyé (réessai) pour générer le PDF et l’EML.',
          code: 'LEASE_SEND_FOR_SIGNATURE_INVALID_STATUS',
          currentStatus: lease.status,
        },
        { status: 400 }
      );
    }

    // Vérifier que Property et Tenant existent
    if (!lease.Property) {
      return NextResponse.json({ 
        error: 'Le bien associé au bail est introuvable' 
      }, { status: 400 });
    }

    if (!lease.Tenant) {
      return NextResponse.json({ 
        error: 'Le locataire associé au bail est introuvable' 
      }, { status: 400 });
    }

    // Mettre à jour le statut du bail à ENVOYÉ
    const updatedLease = await prisma.lease.update({
      where: { id: leaseId },
      data: {
        status: 'ENVOYÉ',
        updatedAt: new Date()
      },
      include: {
        Tenant: true,
        Property: true
      }
    });

    // Récupérer les données du profil pour la signature
    const profileData = await getProfileData(organizationId);
    
    // Générer le PDF côté serveur avec les données du profil
    const pdfBuffer = await renderToBuffer(
      React.createElement(LeasePdf, {
        lease,
        property: lease.Property,
        tenant: lease.Tenant,
        profile: profileData,
        branding: { logoUrl: profileData?.logo || getLogoPdfUrl() },
        generatedAt: new Date().toISOString(),
      })
    );
    
    // Utiliser Supabase Storage pour stocker les fichiers
    const storageService = getStorageService();
    
    // Générer les noms de fichiers
    const propertyName = lease.Property.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'bien';
    const tenantName = `${lease.Tenant.firstName}_${lease.Tenant.lastName}`.replace(/[^a-zA-Z0-9_]/g, '_');
    const pdfFileName = `Bail_${propertyName}_${tenantName}_${new Date(lease.startDate).getFullYear()}.pdf`;
    const emlFileName = `bail-signature-${leaseId}-${Date.now()}.eml`;
    
    // Clés de stockage dans Supabase
    const pdfKey = `leases/${leaseId}/${pdfFileName}`;
    const emlKey = `leases/${leaseId}/${emlFileName}`;
    
    // Upload du PDF vers Supabase Storage
    await storageService.uploadWithKey(pdfBuffer, pdfKey, 'application/pdf');
    
    // Obtenir l'URL publique du PDF (CTA email)
    const pdfUrl = await storageService.getDocumentUrl(pdfKey);

    // Créer l'EML avec le PDF en pièce jointe
    const pdfBase64 = pdfBuffer.toString('base64');

    const propertyAddress = [lease.Property.address, lease.Property.postalCode, lease.Property.city]
      .filter(Boolean)
      .join(' ');
    const emailTemplate = buildLeaseSignatureEmail({
      tenantFirstName: lease.Tenant.firstName,
      tenantLastName: lease.Tenant.lastName,
      propertyAddress: propertyAddress || lease.Property.name || 'Adresse non renseignée',
      rentAmount: Number(lease.rentAmount || 0),
      chargesAmount: Number(lease.chargesRecupMensuelles || 0),
      startDate: lease.startDate?.toString(),
      endDate: lease.endDate?.toString(),
      depositAmount: Number(lease.deposit || 0),
      downloadUrl: pdfUrl,
      supportEmail: profileData.email || 'support@smartimmo.fr',
    });

    const emlContent = `From: noreply@smartimmo.fr
To: ${email || lease.Tenant.email || 'tenant@example.com'}
Subject: =?UTF-8?B?${Buffer.from(emailTemplate.subject).toString('base64')}?=
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: multipart/alternative; boundary="boundary456"

--boundary456
Content-Type: text/plain; charset=UTF-8

${emailTemplate.text}

--boundary456
Content-Type: text/html; charset=UTF-8

${emailTemplate.html}

--boundary456--

--boundary123
Content-Type: application/pdf; name="${pdfFileName}"
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename="${pdfFileName}"

${pdfBase64}

--boundary123--
`;
    
    // Upload de l'EML vers Supabase Storage
    const emlBuffer = Buffer.from(emlContent, 'utf-8');
    await storageService.uploadWithKey(emlBuffer, emlKey, 'message/rfc822');

    console.log('Bail envoyé pour signature:', {
      leaseId,
      to: email || lease.Tenant.email,
      Property: lease.Property.name,
      tenant: `${lease.Tenant.firstName} ${lease.Tenant.lastName}`,
      status: 'SENT'
    });

    // Obtenir l'URL publique de l'EML depuis Supabase Storage
    const emlUrl = await storageService.getDocumentUrl(emlKey);
    
    return NextResponse.json({
      message: 'Bail envoyé pour signature avec succès',
      lease: updatedLease,
      files: {
        pdf: pdfUrl,
        eml: emlUrl
      },
      downloadUrl: emlUrl
    });

  } catch (error) {
    console.error('Error sending lease for signature:', error);
    
    // Log détaillé pour le débogage
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    
    // Retourner un message d'erreur plus détaillé en développement
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `Erreur lors de l'envoi pour signature: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      : 'Erreur lors de l\'envoi pour signature';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' && error instanceof Error 
          ? error.stack 
          : undefined
      },
      { status: 500 }
    );
  }
}
