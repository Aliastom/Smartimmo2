import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { getStorageService } from '@/services/storage.service';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
    }

    // Vérifier que le bail existe et récupérer les infos nécessaires
    const lease = await prisma.lease.findFirst({
      where: { id: params.id, organizationId },
      include: { Tenant: true, Property: true }
    });

    if (!lease) {
      return NextResponse.json({ error: 'Bail non trouvé ou non autorisé' }, { status: 404 });
    }

    // Convertir le fichier en buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Créer une nouvelle version
    await prisma.leaseVersion.create({
      data: {
        leaseId: params.id,
        url: '', // Sera mis à jour après création du document
        kind: 'SIGNED',
      },
    });

    // Créer un document de type BAIL_SIGNE dans la table Document
    try {
      const documentType = await prisma.documentType.findUnique({
        where: { code: 'BAIL_SIGNE' }
      });

      if (documentType) {
        // Créer le document en base d'abord pour obtenir l'ID
        const timestamp = Date.now();
        const fileName = `signed-lease-${params.id}-${timestamp}.pdf`;
        
        const tempDocument = await prisma.document.create({
          data: {
            organizationId,
            ownerId: user.id,
            documentTypeId: documentType.id,
            filenameOriginal: file.name,
            fileName: fileName,
            size: file.size,
            mime: file.type,
            fileSha256: '', // Sera calculé si nécessaire
            bucketKey: '', // Sera mis à jour après upload
            url: '', // Sera mis à jour après upload
            leaseId: params.id,
            tenantId: lease.tenantId,
            propertyId: lease.propertyId,
            status: 'active', // ✅ Active directement
            source: 'upload',
            uploadedBy: user.id,
            uploadedAt: new Date(),
            metadata: JSON.stringify({
              originalName: file.name,
              uploadType: 'lease_signed',
              leaseStatus: 'SIGNÉ'
            })
          }
        });

        // Upload vers le stockage (local ou Supabase selon STORAGE_TYPE)
        const storageService = getStorageService();
        const { key: bucketKey, url: storageUrl } = await storageService.uploadDocument(
          buffer,
          tempDocument.id,
          fileName,
          file.type
        );

        // Mettre à jour le document avec les infos de stockage
        const finalUrl = `/api/documents/${tempDocument.id}/file`;
        const document = await prisma.document.update({
          where: { id: tempDocument.id },
          data: {
            bucketKey,
            url: finalUrl,
          },
        });

        // Mettre à jour le bail avec le PDF signé et changer le statut
        await prisma.lease.update({
          where: { id: params.id },
          data: { 
            signedPdfUrl: finalUrl,
            status: 'SIGNÉ' // Changer le statut en SIGNÉ quand le PDF est uploadé
          },
        });

        // Créer les liens DocumentLink pour le bail signé
        const linksToCreate = [
          { documentId: document.id, linkedType: 'lease', linkedId: params.id },
          { documentId: document.id, linkedType: 'property', linkedId: lease.propertyId },
          { documentId: document.id, linkedType: 'tenant', linkedId: lease.tenantId }, // ✅ Lien vers le locataire
          { documentId: document.id, linkedType: 'global', linkedId: 'global' } // ✅ Global pour visibilité sur page Documents
        ];

        for (const link of linksToCreate) {
          try {
            await prisma.documentLink.create({ data: link });
            console.log(`[BAIL_SIGNE] Lien créé: ${link.linkedType} → ${link.linkedId}`);
          } catch (error: any) {
            // Ignorer les erreurs de duplicate
            if (!error.message?.includes('Unique constraint')) {
              console.error(`[BAIL_SIGNE] Erreur création lien ${link.linkedType}:`, error);
            }
          }
        }
        
        console.log(`[BAIL_SIGNE] Document ${document.id} créé avec ${linksToCreate.length} liens`);
      }
    } catch (docError) {
      console.error('[BAIL_SIGNE] Erreur lors de la création du document:', docError);
      // Ne pas faire échouer l'upload pour une erreur de document
    }

    return NextResponse.json({ 
      success: true, 
      url: finalUrl,
      message: 'PDF signé enregistré avec succès'
    });
  } catch (error) {
    console.error('Error uploading signed PDF:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de l\'upload du PDF signé',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 });
  }
}

