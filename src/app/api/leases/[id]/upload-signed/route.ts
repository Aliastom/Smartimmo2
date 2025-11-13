import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    const lease = await prisma.lease.findUnique({
      where: { id: leaseId },
      include: { Tenant: true, Property: true }
    });

    if (!lease) {
      return NextResponse.json({ error: 'Bail non trouvé' }, { status: 404 });
    }

    // Créer le dossier uploads s'il n'existe pas
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'leases');
    await mkdir(uploadsDir, { recursive: true });

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const fileName = `bail-signe-${leaseId}-${timestamp}.pdf`;
    const filePath = join(uploadsDir, fileName);

    // Sauvegarder le fichier
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Mettre à jour le bail avec l'URL du PDF signé et le statut
    const updatedLease = await prisma.lease.update({
      where: { id: leaseId },
      data: {
        signedPdfUrl: `/uploads/leases/${fileName}`,
        status: 'SIGNÉ',
        updatedAt: new Date()
      },
      include: {
        Tenant: true,
        Property: true
      }
    });

    // Trouver le type de document BAIL_SIGNE
    const documentType = await prisma.documentType.findUnique({
      where: { code: 'BAIL_SIGNE' }
    });

    if (!documentType) {
      throw new Error('Type de document BAIL_SIGNE non trouvé');
    }

    // Créer un document de type BAIL_SIGNE
    const document = await prisma.document.create({
      data: {
        documentTypeId: documentType.id,
        filenameOriginal: file.name,
        fileName: fileName,
        url: `/uploads/leases/${fileName}`,
        size: file.size,
        mime: file.type,
        fileSha256: '', // Sera calculé si nécessaire
        bucketKey: `/uploads/leases/${fileName}`,
        leaseId: leaseId,
        tenantId: lease.tenantId,
        propertyId: lease.propertyId,
        status: 'active', // ✅ Active directement (pas de staging pour bail signé)
        source: 'upload',
        uploadedBy: 'lease-signed-upload',
        uploadedAt: new Date(),
        metadata: JSON.stringify({
          originalName: file.name,
          uploadType: 'lease_signed',
          leaseStatus: 'SIGNÉ'
        })
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