import { prisma } from '@/lib/prisma';

/**
 * Service pour gÃ©rer les liaisons spÃ©cifiques aux documents BAIL_SIGNE
 * 
 * âš ï¸  CE SERVICE EST OBSOLÃˆTE - Utiliser documentLinkService.ts Ã  la place
 * 
 * Lors de l'upload d'un document BAIL_SIGNE, utiliser createDocumentLinks() qui crÃ©e automatiquement :
 * - LEASE â†’ leaseId (obligatoire)
 * - PROPERTY â†’ propertyId du bail
 */
export class BailSigneLinksService {
  
  /**
   * CrÃ©e les liaisons pour un document BAIL_SIGNE
   * 
   * @param documentId - ID du document crÃ©Ã©
   * @param leaseId - ID du bail (obligatoire)
   * @param propertyId - ID du bien (cohÃ©rent avec le bail)
   * @param tenantsIds - Liste des IDs des locataires actifs
   */
  static async createBailSigneLinks(
    documentId: string,
    leaseId: string,
    propertyId: string,
    tenantsIds: string[]
  ): Promise<void> {
    console.log(`[BailSigneLinks] CrÃ©ation des liaisons pour document ${documentId}, bail ${leaseId}`);
    
    try {
      // VÃ©rifier que le document existe
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: { id: true, DocumentType: { select: { code: true } } }
      });
      
      if (!document) {
        throw new Error(`Document ${documentId} non trouvÃ©`);
      }
      
      // VÃ©rifier que c'est bien un document BAIL_SIGNE
      if (document.DocumentType?.code !== 'BAIL_SIGNE') {
        console.warn(`[BailSigneLinks] Document ${documentId} n'est pas de type BAIL_SIGNE (${document.DocumentType?.code}), liaisons non crÃ©Ã©es`);
        return;
      }
      
      // VÃ©rifier que le bail existe et rÃ©cupÃ©rer les informations
      const lease = await prisma.lease.findUnique({
        where: { id: leaseId },
        select: { 
          id: true, 
          propertyId: true,
          Tenant: { select: { id: true, firstName: true, lastName: true } }
        }
      });
      
      if (!lease) {
        throw new Error(`Bail ${leaseId} non trouvÃ©`);
      }
      
      // VÃ©rifier la cohÃ©rence propertyId
      if (lease.propertyId !== propertyId) {
        console.warn(`[BailSigneLinks] IncohÃ©rence propertyId: bail ${leaseId} a propertyId ${lease.propertyId}, fourni ${propertyId}`);
      }
      
      // VÃ©rifier que le bien existe
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true, name: true }
      });
      
      if (!property) {
        throw new Error(`Bien ${propertyId} non trouvÃ©`);
      }
      
      // VÃ©rifier que les locataires existent
      const tenants = await prisma.tenant.findMany({
        where: { 
          id: { in: tenantsIds },
          status: 'ACTIVE' // Seulement les locataires actifs
        },
        select: { id: true, firstName: true, lastName: true }
      });
      
      if (tenants.length !== tenantsIds.length) {
        const foundIds = tenants.map(t => t.id);
        const missingIds = tenantsIds.filter(id => !foundIds.includes(id));
        console.warn(`[BailSigneLinks] Certains locataires non trouvÃ©s ou inactifs: ${missingIds.join(', ')}`);
      }
      
      // CrÃ©er les liaisons en transaction
      await prisma.$transaction(async (tx) => {
        // 1. Liaison PRIMARY vers LEASE
        await this.upsertDocumentLink(tx, {
          documentId,
          targetType: 'LEASE',
          targetId: leaseId,
          role: 'PRIMARY',
          entityName: `Bail ${lease.Tenant.firstName} ${lease.Tenant.lastName}`
        });
        
        // 2. Liaison DERIVED vers PROPERTY
        await this.upsertDocumentLink(tx, {
          documentId,
          targetType: 'PROPERTY',
          targetId: propertyId,
          role: 'DERIVED',
          entityName: property.name
        });
        
        // 3. Liaisons DERIVED vers chaque TENANT actif
        for (const tenant of tenants) {
          await this.upsertDocumentLink(tx, {
            documentId,
            targetType: 'TENANT',
            targetId: tenant.id,
            role: 'DERIVED',
            entityName: `${tenant.firstName} ${tenant.lastName}`
          });
        }
        
        // Note: La liaison GLOBAL est maintenant gÃ©rÃ©e par DocumentAutoLinkingServiceServer
        // pour Ã©viter les doublons
      });
      
      console.log(`[BailSigneLinks] âœ… Liaisons crÃ©Ã©es pour document ${documentId}:`);
      console.log(`   - LEASE (PRIMARY): ${leaseId}`);
      console.log(`   - PROPERTY (DERIVED): ${propertyId}`);
      console.log(`   - TENANT (DERIVED): ${tenants.length} locataire(s)`);
      console.log(`   - GLOBAL (DERIVED): automatique`);
      
    } catch (error) {
      console.error(`[BailSigneLinks] âŒ Erreur lors de la crÃ©ation des liaisons:`, error);
      throw error;
    }
  }
  
  /**
   * Upsert d'une liaison de document (Ã©vite les doublons)
   */
  private static async upsertDocumentLink(
    tx: any,
    data: {
      documentId: string;
      targetType: string;
      targetId: string | null;
      role: string;
      entityName: string;
    }
  ): Promise<void> {
    // VÃ©rifier si la liaison existe dÃ©jÃ 
    const existingLink = await tx.DocumentLink.findFirst({
      where: {
        documentId: data.documentId,
        targetType: data.targetType,
        targetId: data.targetId,
      }
    });
    
    if (existingLink) {
      // Mettre Ã  jour le role et entityName si nÃ©cessaire
      if (existingLink.role !== data.role || existingLink.entityName !== data.entityName) {
        await tx.DocumentLink.update({
          where: { id: existingLink.id },
          data: {
            role: data.role,
            entityName: data.entityName,
            updatedAt: new Date()
          }
        });
        console.log(`[BailSigneLinks] Liaison mise Ã  jour: ${data.targetType}/${data.targetId} (${data.role})`);
      } else {
        console.log(`[BailSigneLinks] Liaison dÃ©jÃ  existante: ${data.targetType}/${data.targetId} (${data.role})`);
      }
    } else {
      // CrÃ©er la nouvelle liaison
      await tx.DocumentLink.create({
        data: {
          documentId: data.documentId,
          targetType: data.targetType,
          targetId: data.targetId,
          role: data.role,
          entityName: data.entityName,
        }
      });
      console.log(`[BailSigneLinks] Nouvelle liaison crÃ©Ã©e: ${data.targetType}/${data.targetId} (${data.role})`);
    }
  }
  
  /**
   * RÃ©cupÃ¨re les informations nÃ©cessaires pour crÃ©er les liaisons
   * Ã  partir d'un leaseId
   */
  static async getLeaseInfoForLinks(leaseId: string): Promise<{
    leaseId: string;
    propertyId: string;
    tenantsIds: string[];
  }> {
    const lease = await prisma.lease.findUnique({
      where: { id: leaseId },
      select: { 
        id: true, 
        propertyId: true,
        Tenant: { select: { id: true } }
      }
    });
    
    if (!lease) {
      throw new Error(`Bail ${leaseId} non trouvÃ©`);
    }
    
    return {
      leaseId: lease.id,
      propertyId: lease.propertyId,
      tenantsIds: [lease.Tenant.id] // Pour l'instant, un bail = un locataire
    };
  }
}
