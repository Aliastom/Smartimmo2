/**
 * Service de gestion des commissions pour les sociétés de gestion
 */

import { prisma } from '@/lib/prisma';
import { calcCommission, type ModeCalcul } from '@/lib/gestion';
import { isGestionDelegueEnabled, getGestionCodes } from '@/lib/settings/appSettings';

interface Facture {
  date?: string;
  numero?: string;
  fournisseur?: string;
  dateService?: string;
  description?: string;
  montant: number;
}

interface CreateCommissionParams {
  transactionId: string;
  propertyId: string;
  organizationId: string;
  montantLoyer: number;
  chargesRecup?: number;
  date: Date;
  accountingMonth: string;
  leaseId?: string;
  bailId?: string;
  // Champs à copier de la transaction parent
  reference?: string;
  paidAt?: Date | null;
  method?: string | null;
  notes?: string | null;
  rapprochementStatus?: string;
  bankRef?: string | null;
  // Factures de la section DÉPENSES ET AUTRES RECETTES
  factures?: Facture[];
}

interface CommissionResult {
  commissionTransaction?: any;
  warning?: string;
}

/**
 * Crée automatiquement une transaction de commission de gestion
 * si le bien est lié à une société de gestion active
 */
export async function createManagementCommission(
  params: CreateCommissionParams,
  tx?: any // Transaction Prisma optionnelle
): Promise<CommissionResult> {
  const prismaClient = tx || prisma;

  try {
    // Feature flag check (via settings)
    const enabled = await isGestionDelegueEnabled();
    if (!enabled) {
      console.log('[Commission] Gestion déléguée désactivée — skip création commission');
      return {};
    }

    // Récupérer les codes système configurés
    const codes = await getGestionCodes();

    // Récupérer la propriété et sa société de gestion
    const property = await prismaClient.property.findFirst({
      where: { id: params.propertyId, organizationId: params.organizationId },
      include: {
        ManagementCompany: true,
      },
    });

    if (!property || !property.managementCompanyId || !property.ManagementCompany) {
      // Pas de société de gestion liée, on ne fait rien
      return {};
    }

    const company = property.ManagementCompany;

    // Vérifier que la société est active
    if (!company.actif) {
      return {};
    }

    // Calculer la commission de base
    const { commissionTTC: commissionBase } = calcCommission({
      montantLoyer: params.montantLoyer,
      chargesRecup: params.chargesRecup || 0,
      modeCalcul: company.modeCalcul as ModeCalcul,
      taux: company.taux,
      fraisMin: company.fraisMin ?? undefined,
      tvaApplicable: company.tvaApplicable,
      tauxTva: company.tauxTva ?? undefined,
    });

    // Ajouter le montant des factures à la commission
    const montantFactures = params.factures?.reduce((sum, f) => sum + f.montant, 0) || 0;
    const commissionTTC = commissionBase + montantFactures;

    // Si la commission est nulle ou négative, ne rien créer
    if (commissionTTC <= 0) {
      return {};
    }

    // Récupérer la catégorie de commission configurée (par slug)
    const fraisGestionCategory = await prismaClient.category.findFirst({
      where: {
        slug: codes.mgmtCategory,
        actif: true,
      },
    });

    if (!fraisGestionCategory) {
      console.warn(`[Commission] Catégorie "${codes.mgmtCategory}" introuvable, commission non créée`);
      return {
        warning: `Catégorie "${codes.mgmtCategory}" introuvable`,
      };
    }

    // Construire le libellé avec les factures si présentes
    let label = `Commission de gestion`;
    let notes = params.notes || '';
    
    if (params.factures && params.factures.length > 0) {
      // Option 1 : Libellé court avec "dont facture"
      label = `Commission de gestion dont facture - ${company.nom}`;
      
      // Option 2 : Ajouter les détails dans les notes
      const facturesDetails = params.factures.map(f => {
        const parts: string[] = [];
        if (f.numero) parts.push(`Facture ${f.numero}`);
        if (f.fournisseur) parts.push(f.fournisseur);
        if (f.dateService) parts.push(`du ${f.dateService}`);
        if (f.description) parts.push(f.description);
        return parts.join(' ');
      }).join(' ; ');
      
      if (notes) {
        notes = `${notes}\n\nComprend la ${facturesDetails}`;
      } else {
        notes = `Comprend la ${facturesDetails}`;
      }
    } else {
      label = `Commission de gestion - ${company.nom}`;
    }

    // Créer la transaction de commission (montant négatif = dépense)
    const commissionTransaction = await prismaClient.transaction.create({
      data: {
        organizationId: params.organizationId,
        propertyId: params.propertyId,
        leaseId: params.leaseId || null,
        bailId: params.bailId || null,
        categoryId: fraisGestionCategory.id,
        label: label,
        amount: -commissionTTC, // Négatif car c'est une dépense
        date: params.date,
        accounting_month: params.accountingMonth, // Prisma utilise snake_case
        nature: codes.mgmtNature, // Nature configurée via settings
        parentTransactionId: params.transactionId, // Lien vers la transaction de loyer parente
        managementCompanyId: company.id,
        isAuto: true,
        autoSource: 'gestion',
        isAutoAmount: false, // Les commissions ne calculent pas leur montant depuis un breakdown
        // Copier les champs de la transaction parent
        reference: params.reference || null,
        paidAt: params.paidAt || null,
        method: params.method || null,
        notes: notes,
        rapprochementStatus: params.rapprochementStatus || 'non_rapprochee',
        bankRef: params.bankRef || null,
        source: 'MANUAL', // Ou 'AUTO' si vous avez ce type
      },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
          },
        },
        Category: true,
      },
    });

    console.log(
      `[Commission] Commission créée: ${commissionTTC}€ pour la transaction ${params.transactionId}`
    );

    return { commissionTransaction };
  } catch (error) {
    console.error('[Commission] Erreur lors de la création de la commission:', error);
    throw error;
  }
}

/**
 * Met à jour une commission existante suite à la modification de la transaction parent
 */
export async function updateManagementCommission(
  parentTransactionId: string,
  newMontantLoyer: number,
  newChargesRecup?: number,
  tx?: any
): Promise<CommissionResult> {
  const prismaClient = tx || prisma;

  try {
    // Feature flag check (via settings)
    const enabled = await isGestionDelegueEnabled();
    if (!enabled) {
      console.log('[Commission] Gestion déléguée désactivée — skip mise à jour commission');
      return {};
    }

    // Récupérer la transaction parent
    const parentTransaction = await prismaClient.transaction.findUnique({
      where: { id: parentTransactionId },
      include: {
        Property: {
          include: {
            ManagementCompany: true,
          },
        },
      },
    });

    if (!parentTransaction || !parentTransaction.Property.ManagementCompany) {
      return {};
    }

    // Chercher la commission liée (isAuto = true)
    const existingCommission = await prismaClient.transaction.findFirst({
      where: {
        parentTransactionId,
        isAuto: true,
        autoSource: 'gestion',
      },
    });

    if (!existingCommission) {
      // Pas de commission auto, peut-être créée manuellement ou supprimée
      return {};
    }

    const company = parentTransaction.Property.ManagementCompany;

    // Recalculer la commission
    const { commissionTTC } = calcCommission({
      montantLoyer: newMontantLoyer,
      chargesRecup: newChargesRecup || 0,
      modeCalcul: company.modeCalcul as ModeCalcul,
      taux: company.taux,
      fraisMin: company.fraisMin ?? undefined,
      tvaApplicable: company.tvaApplicable,
      tauxTva: company.tauxTva ?? undefined,
    });

    // Mettre à jour la commission
    const updatedCommission = await prismaClient.transaction.update({
      where: { id: existingCommission.id },
      data: {
        amount: -commissionTTC,
      },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
          },
        },
        Category: true,
      },
    });

    console.log(
      `[Commission] Commission mise à jour: ${commissionTTC}€ pour la transaction ${parentTransactionId}`
    );

    return { commissionTransaction: updatedCommission };
  } catch (error) {
    console.error('[Commission] Erreur lors de la mise à jour de la commission:', error);
    throw error;
  }
}

/**
 * Supprime une commission liée à une transaction parent
 */
export async function deleteManagementCommission(
  parentTransactionId: string,
  tx?: any
): Promise<void> {
  const prismaClient = tx || prisma;

  try {
    // Feature flag check (via settings)
    const enabled = await isGestionDelegueEnabled();
    if (!enabled) {
      console.log('[Commission] Gestion déléguée désactivée — skip suppression commission');
      return;
    }

    // Chercher la commission liée (isAuto = true)
    const existingCommission = await prismaClient.transaction.findFirst({
      where: {
        parentTransactionId,
        isAuto: true,
        autoSource: 'gestion',
      },
    });

    if (existingCommission) {
      await prismaClient.transaction.delete({
        where: { id: existingCommission.id },
      });

      console.log(
        `[Commission] Commission supprimée pour la transaction ${parentTransactionId}`
      );
    }
  } catch (error) {
    console.error('[Commission] Erreur lors de la suppression de la commission:', error);
    throw error;
  }
}

/**
 * Vérifie si une transaction de type loyer doit générer une commission
 */
export async function shouldCreateCommission(
  nature?: string,
  montantLoyer?: number
): Promise<boolean> {
  const enabled = await isGestionDelegueEnabled();
  if (!enabled) {
    return false;
  }

  // Récupérer les codes système pour vérifier la nature
  const codes = await getGestionCodes();

  // Vérifier que c'est une transaction de type loyer (comparaison avec le code configuré)
  const isRentNature =
    nature === codes.rentNature ||
    nature?.includes('LOYER') ||
    nature?.includes('RENT') ||
    nature?.includes('RECETTE_LOYER');

  // Vérifier qu'il y a un montant de loyer positif
  const hasValidAmount = montantLoyer && montantLoyer > 0;

  return !!(isRentNature && hasValidAmount);
}

