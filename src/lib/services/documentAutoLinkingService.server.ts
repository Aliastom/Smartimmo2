import { PrismaClient } from '@prisma/client';
import { DocumentLinkRole, DocumentLinkTarget } from '@/types/document-link';
import { GLOBAL_ENTITY_ID } from '@/lib/constants';
import { prisma } from '@/lib/prisma';

/**
 * âš ï¸  CE SERVICE EST OBSOLÃˆTE - Utiliser documentLinkService.ts Ã  la place
 * 
 * Ce service Ã©tait utilisÃ© pour crÃ©er automatiquement des liens GLOBAL,
 * mais le nouveau systÃ¨me utilise createDocumentLinks() qui ne crÃ©e que
 * les liens nÃ©cessaires (transaction + property + lease).
 */



export interface AutoLinkingContext {
  leaseId?: string;
  propertyId?: string;
  tenantsIds?: string[];
}

export interface DocumentLinkRule {
  targetType: 'GLOBAL' | 'PROPERTY' | 'LEASE' | 'TENANT' | 'TRANSACTION';
  targetId?: string;
  role: 'PRIMARY' | 'DERIVED';
  entityName?: string;
}

export class DocumentAutoLinkingServiceServer {
  private static readonly LINKING_RULES: Record<string, Array<{ targetType: string; role: string }>> = {
    'BAIL_SIGNE': [
      { targetType: 'GLOBAL', role: 'DERIVED' },
      { targetType: 'LEASE', role: 'PRIMARY' },
      { targetType: 'PROPERTY', role: 'DERIVED' },
      { targetType: 'TENANT', role: 'DERIVED' }
    ],
    'ETAT_LIEUX_ENTRANT': [
      { targetType: 'GLOBAL', role: 'DERIVED' },
      { targetType: 'PROPERTY', role: 'PRIMARY' },
      { targetType: 'LEASE', role: 'DERIVED' },
      { targetType: 'TENANT', role: 'DERIVED' }
    ],
    'ETAT_LIEUX_SORTANT': [
      { targetType: 'GLOBAL', role: 'DERIVED' },
      { targetType: 'PROPERTY', role: 'PRIMARY' },
      { targetType: 'LEASE', role: 'DERIVED' },
      { targetType: 'TENANT', role: 'DERIVED' }
    ],
    'ASSURANCE_LOCATAIRE': [
      { targetType: 'GLOBAL', role: 'DERIVED' },
      { targetType: 'TENANT', role: 'PRIMARY' },
      { targetType: 'PROPERTY', role: 'DERIVED' },
      { targetType: 'LEASE', role: 'DERIVED' }
    ],
    'DEPOT_GARANTIE': [
      { targetType: 'GLOBAL', role: 'DERIVED' },
      { targetType: 'TENANT', role: 'PRIMARY' },
      { targetType: 'PROPERTY', role: 'DERIVED' },
      { targetType: 'LEASE', role: 'DERIVED' }
    ],
    'QUITTANCE_LOYER': [
      { targetType: 'GLOBAL', role: 'DERIVED' },
      { targetType: 'PROPERTY', role: 'PRIMARY' },
      { targetType: 'LEASE', role: 'DERIVED' },
      { targetType: 'TENANT', role: 'DERIVED' }
    ],
    'QUITTANCE': [
      { targetType: 'GLOBAL', role: 'DERIVED' },
      { targetType: 'PROPERTY', role: 'PRIMARY' },
      { targetType: 'LEASE', role: 'DERIVED' },
      { targetType: 'TENANT', role: 'DERIVED' }
    ]
  };

  /**
   * GÃ©nÃ¨re les liaisons automatiques pour un type de document donnÃ©
   */
  static async generateAutoLinks(
    documentTypeCode: string, 
    context: AutoLinkingContext
  ): Promise<DocumentLinkRule[]> {
    const rules = this.LINKING_RULES[documentTypeCode];
    if (!rules) {
      // Par dÃ©faut, crÃ©er seulement un lien GLOBAL
      return [{ targetType: 'GLOBAL', role: 'DERIVED', entityName: 'Global' }];
    }

    const links: DocumentLinkRule[] = [];

    for (const rule of rules) {
      let targetId: string | undefined;
      let entityName: string | undefined;

      switch (rule.targetType) {
        case 'GLOBAL':
          targetId = undefined;
          entityName = 'Global';
          break;
        case 'LEASE':
          if (context.leaseId) {
            targetId = context.leaseId;
            entityName = await this.getLeaseName(context.leaseId);
          } else {
            // Ne pas crÃ©er de liaison si pas de leaseId
            continue;
          }
          break;
        case 'PROPERTY':
          if (context.propertyId) {
            targetId = context.propertyId;
            entityName = await this.getPropertyName(context.propertyId);
          } else {
            // Ne pas crÃ©er de liaison si pas de propertyId
            continue;
          }
          break;
        case 'TENANT':
          // VÃ©rifier si on a des locataires disponibles
          if (!context.tenantsIds || context.tenantsIds.length === 0) {
            // Ne pas crÃ©er de liaison si pas de tenantsIds
            continue;
          }
          
          // Pour les types avec TENANT PRIMARY, utiliser le premier locataire
          // Pour les autres, crÃ©er un lien pour chaque locataire
          if (rule.role === 'PRIMARY' && context.tenantsIds && context.tenantsIds.length > 0) {
            targetId = context.tenantsIds[0];
            entityName = await this.getTenantName(context.tenantsIds[0]);
          } else {
            // CrÃ©er un lien pour chaque locataire
            for (const tenantId of context.tenantsIds || []) {
              links.push({
                ...rule,
                targetId: tenantId,
                entityName: await this.getTenantName(tenantId)
              });
            }
            continue; // Skip the main link creation
          }
          break;
      }

      links.push({
        ...rule,
        targetId,
        entityName
      });
    }

    console.log(`[DocumentAutoLinkingServiceServer] generateAutoLinks pour ${documentTypeCode} avec contexte:`, context);
    console.log(`[DocumentAutoLinkingServiceServer] Liens gÃ©nÃ©rÃ©s:`, links.map(l => `${l.targetType}:${l.targetId || 'undefined'}`));
    return links;
  }

  /**
   * CrÃ©e automatiquement les liaisons pour un document
   */
  static async createAutoLinks(
    documentId: string,
    documentTypeCode: string,
    context: AutoLinkingContext
  ): Promise<void> {
    try {
      const links = await this.generateAutoLinks(documentTypeCode, context);
      
      // CrÃ©er les liaisons en base (Ã©viter les doublons)
      for (const link of links) {
        // Pour GLOBAL, utiliser 'global' en minuscules pour Ãªtre cohÃ©rent avec le systÃ¨me manuel
        let linkedType: string;
        let linkedId: string;
        
        if (link.targetType === 'GLOBAL') {
          linkedType = 'global';  // Minuscules pour cohÃ©rence avec le systÃ¨me manuel
          linkedId = 'global';    // Minuscules pour cohÃ©rence avec le systÃ¨me manuel
        } else {
          linkedType = link.targetType.toLowerCase(); // Minuscules pour cohÃ©rence
          linkedId = link.targetId || '';
        }
        
        // RÃ©cupÃ©rer le nom de l'entitÃ© si pas dÃ©jÃ  fourni
        let entityName = link.entityName;
        if (!entityName) {
          if (link.targetType === 'LEASE' && link.targetId) {
            entityName = await this.getLeaseName(link.targetId);
          } else if (link.targetType === 'PROPERTY' && link.targetId) {
            entityName = await this.getPropertyName(link.targetId);
          } else if (link.targetType === 'TENANT' && link.targetId) {
            entityName = await this.getTenantName(link.targetId);
          }
        }
        
        await prisma.documentLink.upsert({
          where: {
            documentId_linkedType_linkedId: {
              documentId,
              linkedType: linkedType as DocumentLinkTarget,
              linkedId: linkedId
            }
          },
          update: {
            // Mettre Ã  jour entityName si vide
            entityName: entityName || undefined
          },
          create: {
            documentId,
            linkedType: linkedType as DocumentLinkTarget,
            linkedId: linkedId,
            entityName: entityName || undefined
          }
        });
      }

      console.log(`âœ… Liaisons automatiques crÃ©Ã©es pour le document ${documentId} (type: ${documentTypeCode})`);
      console.log(`[DocumentAutoLinkingServiceServer] Liens gÃ©nÃ©rÃ©s:`, links.map(l => `${l.targetType}:${l.targetId || 'undefined'}`));
    } catch (error) {
      console.error('Erreur lors de la crÃ©ation des liaisons automatiques:', error);
      throw error;
    }
  }

  /**
   * RÃ©cupÃ¨re le nom d'un bail via Prisma
   */
  private static async getLeaseName(leaseId?: string): Promise<string> {
    if (!leaseId) return 'Bail';
    try {
      const lease = await prisma.lease.findUnique({
        where: { id: leaseId },
        include: { Property: true }
      });
      return lease?.Property ? `${lease.Property.name} - Bail` : `Bail ${leaseId.slice(-8)}`;
    } catch (error) {
      console.error('Erreur lors de la rÃ©cupÃ©ration du nom du bail:', error);
      return 'Bail';
    }
  }

  /**
   * RÃ©cupÃ¨re le nom d'une propriÃ©tÃ© via Prisma
   */
  private static async getPropertyName(propertyId?: string): Promise<string> {
    if (!propertyId) return 'PropriÃ©tÃ©';
    try {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { name: true }
      });
      return property?.name || `PropriÃ©tÃ© ${propertyId.slice(-8)}`;
    } catch (error) {
      console.error('Erreur lors de la rÃ©cupÃ©ration du nom de la propriÃ©tÃ©:', error);
      return 'PropriÃ©tÃ©';
    }
  }

  /**
   * RÃ©cupÃ¨re le nom d'un locataire via Prisma
   */
  private static async getTenantName(tenantId?: string): Promise<string> {
    if (!tenantId) return 'Locataire';
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { firstName: true, lastName: true }
      });
      return tenant ? `${tenant.firstName} ${tenant.lastName}` : `Locataire ${tenantId.slice(-8)}`;
    } catch (error) {
      console.error('Erreur lors de la rÃ©cupÃ©ration du nom du locataire:', error);
      return 'Locataire';
    }
  }

  /**
   * VÃ©rifie si un type de document a des rÃ¨gles de liaison automatique
   */
  static hasAutoLinkingRules(documentTypeCode: string): boolean {
    return documentTypeCode in this.LINKING_RULES;
  }
}
