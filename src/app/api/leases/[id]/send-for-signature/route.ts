import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderToBuffer } from '@react-pdf/renderer';
import LeasePdf from '@/pdf/LeasePdf';
import { getProfileData } from '@/lib/services/profileService';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { getStorageService } from '@/services/storage.service';
import React from 'react';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

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

    // Vérifier que le bail est en statut BROUILLON ou À_ENVOYER (pour réessayer un envoi)
    if (lease.status !== 'BROUILLON' && lease.status !== 'À_ENVOYER' && lease.status !== 'A_ENVOYER' && lease.status !== 'TO_SEND') {
      return NextResponse.json({ 
        error: 'Le bail doit être en statut BROUILLON ou À_ENVOYER pour être envoyé pour signature' 
      }, { status: 400 });
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
    const pdfBuffer = await renderToBuffer(React.createElement(LeasePdf, { 
      lease, 
      property: lease.Property, 
      tenant: lease.Tenant,
      profile: profileData
    }));
    
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
    
    // Créer l'EML avec le PDF en pièce jointe
    const pdfBase64 = pdfBuffer.toString('base64');
    
    const emlContent = `From: noreply@smartimmo.fr
To: ${email || lease.Tenant.email || 'tenant@example.com'}
Subject: =?UTF-8?B?${Buffer.from(`Bail à signer - ${lease.Property.name}`).toString('base64')}?=
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: multipart/alternative; boundary="boundary456"

--boundary456
Content-Type: text/plain; charset=UTF-8

Bonjour ${lease.Tenant.firstName} ${lease.Tenant.lastName},

Veuillez trouver ci-joint votre bail à signer pour le bien ${lease.Property.name}.

Adresse : ${lease.Property.address || 'Non renseignée'}
Loyer : ${lease.rentAmount}€/mois
Charges : ${lease.chargesRecupMensuelles || 0}€/mois
Début du bail : ${new Date(lease.startDate).toLocaleDateString('fr-FR')}
${lease.endDate ? `Fin du bail : ${new Date(lease.endDate).toLocaleDateString('fr-FR')}` : ''}
Caution : ${lease.deposit || 0}€

Merci de signer le document PDF ci-joint et de nous le retourner.

Cordialement,
L'équipe Smartimmo

--boundary456
Content-Type: text/html; charset=UTF-8

<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #2563eb;">Bail à signer - ${lease.Property.name}</h2>
  <p>Bonjour <strong>${lease.Tenant.firstName} ${lease.Tenant.lastName}</strong>,</p>
  <p>Veuillez trouver ci-joint votre bail à signer pour le bien :</p>
  <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
    <p><strong>Adresse :</strong> ${lease.Property.address || 'Non renseignée'}</p>
    <p><strong>Loyer :</strong> ${lease.rentAmount}€/mois</p>
    <p><strong>Charges :</strong> ${lease.chargesRecupMensuelles || 0}€/mois</p>
    <p><strong>Début du bail :</strong> ${new Date(lease.startDate).toLocaleDateString('fr-FR')}</p>
    ${lease.endDate ? `<p><strong>Fin du bail :</strong> ${new Date(lease.endDate).toLocaleDateString('fr-FR')}</p>` : ''}
    <p><strong>Caution :</strong> ${lease.deposit || 0}€</p>
  </div>
  <p><strong>📎 Pièce jointe :</strong> Le bail à signer est disponible en pièce jointe (PDF)</p>
  <p>Merci de signer le document et de nous le retourner.</p>
  <br>
  <p>Cordialement,<br><strong>L'équipe Smartimmo</strong></p>
</div>

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

    // Obtenir les URLs publiques depuis Supabase Storage
    const pdfUrl = await storageService.getDocumentUrl(pdfKey);
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
