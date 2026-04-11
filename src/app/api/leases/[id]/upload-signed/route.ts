import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { getStorageService } from '@/services/storage.service';
import { createHash } from 'crypto';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const leaseId = params.id;
    const formData = await request.formData();
    const file = formData.get('signedPdf') as File;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Le fichier doit être un PDF' }, { status: 400 });
    }

    // Vérifier que le bail existe
    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, organizationId },
      include: { Tenant: true, Property: true }
    });

    if (!lease) {
      return NextResponse.json({ error: 'Bail non trouvé ou non autorisé' }, { status: 404 });
    }

    // Lire le fichier
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileSha256 = createHash('sha256').update(buffer).digest('hex');

    // Trouver le type de document BAIL_SIGNE
    const documentType = await prisma.documentType.findUnique({
      where: { code: 'BAIL_SIGNE' }
    });

    if (!documentType) {
      throw new Error('Type de document BAIL_SIGNE non trouvé');
    }

    // Remplacement métier: un seul BAIL_SIGNE actif par bail
    // On archive les anciens documents signés avant d'enregistrer le nouveau.
    await prisma.document.updateMany({
      where: {
        organizationId,
        leaseId,
        documentTypeId: documentType.id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        status: 'archived',
      },
    });

    // Idempotence: si le même fichier existe déjà (même SHA), on le réutilise
    // au lieu de créer une nouvelle ligne qui casserait sur la contrainte unique.
    let document = await prisma.document.findUnique({
      where: { fileSha256 },
    });

    if (document && document.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Ce document existe déjà dans une autre organisation' },
        { status: 409 }
      );
    }

    if (!document) {
      try {
        document = await prisma.document.create({
          data: {
            organizationId,
            ownerId: user.id,
            documentTypeId: documentType.id,
            filenameOriginal: file.name,
            fileName: file.name,
            mime: file.type,
            size: file.size,
            fileSha256,
            bucketKey: '',
            url: '',
            leaseId: leaseId,
            tenantId: lease.tenantId,
            propertyId: lease.propertyId,
            status: 'active',
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
      } catch (createError: any) {
        // Course concurrente possible: un autre process a créé le même SHA entre-temps.
        if (createError?.code === 'P2002') {
          document = await prisma.document.findUnique({ where: { fileSha256 } });
        } else {
          throw createError;
        }
      }
    }

    if (!document) {
      throw new Error("Impossible d'initialiser le document signé");
    }

    let finalUrl = document.url;
    if (!document.bucketKey || !document.url) {
      // Upload vers le stockage (local ou Supabase selon STORAGE_TYPE)
      const storageService = getStorageService();
      const timestamp = Date.now();
      const fileName = `bail-signe-${leaseId}-${timestamp}.pdf`;
      const { key: bucketKey } = await storageService.uploadDocument(
        buffer,
        document.id,
        fileName,
        file.type
      );

      finalUrl = `/api/documents/${document.id}/file`;
      document = await prisma.document.update({
        where: { id: document.id },
        data: {
          bucketKey,
          url: finalUrl,
        },
      });
    } else {
      // Normaliser l'URL de lecture locale pour cohérence API.
      finalUrl = `/api/documents/${document.id}/file`;
      document = await prisma.document.update({
        where: { id: document.id },
        data: {
          url: finalUrl,
        },
      });
    }

    // Réassocier le document au bail courant (cas "fichier déjà connu").
    document = await prisma.document.update({
      where: { id: document.id },
      data: {
        organizationId,
        ownerId: user.id,
        documentTypeId: documentType.id,
        filenameOriginal: file.name,
        fileName: file.name,
        mime: file.type,
        size: file.size,
        leaseId,
        tenantId: lease.tenantId,
        propertyId: lease.propertyId,
        status: 'active',
        deletedAt: null,
        source: 'upload',
        uploadedBy: user.id,
        uploadedAt: new Date(),
        metadata: JSON.stringify({
          originalName: file.name,
          uploadType: 'lease_signed',
          leaseStatus: 'SIGNÉ'
        }),
      },
    });

    // Mettre à jour le bail avec l'URL du PDF signé et le statut
    const updatedLease = await prisma.lease.update({
      where: { id: leaseId },
      data: {
        signedPdfUrl: finalUrl,
        status: 'SIGNÉ',
        updatedAt: new Date()
      },
      include: {
        Tenant: true,
        Property: true
      }
    });

    // Créer les liens DocumentLink pour le bail signé
    // Un bail signé doit être lié à : lease, property, et global
    try {
      const linksToCreate = [
        { documentId: document.id, linkedType: 'lease', linkedId: leaseId },
        { documentId: document.id, linkedType: 'property', linkedId: lease.propertyId },
        { documentId: document.id, linkedType: 'tenant', linkedId: lease.tenantId }, // ✅ Lien vers le locataire
        { documentId: document.id, linkedType: 'global', linkedId: 'global' } // ✅ Global pour visibilité sur page Documents
      ];

      // Créer les liens avec entityName (skip duplicates si jamais ils existent déjà)
      for (const link of linksToCreate) {
        try {
          let entityName: string | undefined;
          
          // Enrichir avec le nom de l'entité
          if (link.linkedType === 'lease') {
            entityName = `Bail - ${lease.Property.name}`;
          } else if (link.linkedType === 'property') {
            entityName = lease.Property.name;
          } else if (link.linkedType === 'tenant') {
            entityName = `${lease.Tenant.firstName} ${lease.Tenant.lastName}`;
          } else if (link.linkedType === 'global') {
            entityName = 'Global';
          }
          
          await prisma.documentLink.create({ 
            data: {
              ...link,
              entityName
            }
          });
          console.log(`[BAIL_SIGNE] Lien créé: ${link.linkedType} → ${link.linkedId} (${entityName})`);
        } catch (error: any) {
          // Ignorer les erreurs de duplicate (si le lien existe déjà)
          if (!error.message?.includes('Unique constraint')) {
            console.error(`[BAIL_SIGNE] Erreur création lien ${link.linkedType}:`, error);
          }
        }
      }
      
      console.log(`[BAIL_SIGNE] ${linksToCreate.length} liens créés pour document ${document.id}`);
    } catch (linkError) {
      console.error('[BAIL_SIGNE] Erreur lors de la création des liaisons:', linkError);
      // Ne pas faire échouer l'upload pour une erreur de liaison
    }

    return NextResponse.json({
      message: 'Bail signé uploadé avec succès',
      lease: updatedLease
    });

  } catch (error) {
    console.error('Error uploading signed lease:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'upload du bail signé' },
      { status: 500 }
    );
  }
}