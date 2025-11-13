import { z } from 'zod';

// Schéma de base commun aux deux modes
const baseTransactionSchema = {
  propertyId: z.string().min(1, 'Le bien est obligatoire'),
  leaseId: z.string().optional(),
  tenantId: z.string().optional(),
  date: z.string().min(1, 'La date est obligatoire'),
  nature: z.string().min(1, 'La nature est obligatoire'),
  categoryId: z.string().min(1, 'La catégorie est obligatoire'),
  label: z.string().optional(),
  amount: z.number().min(0.01, 'Le montant doit être supérieur à 0'),
  reference: z.string().optional(),
  // Champs de paiement (compatibilité avec les deux formats)
  paymentDate: z.string().optional(),
  paymentMethod: z.string().optional(),
  paidAt: z.string().optional(),
  method: z.string().optional(),
  // Champs de période
  notes: z.string().optional(),
  periodStart: z.string().optional(),
  periodMonth: z.string().optional(),
  periodYear: z.number().optional(),
  accountingMonth: z.string().optional(),
  autoDistribution: z.boolean().optional(),
  // Champs de rapprochement
  rapprochementStatus: z.enum(['non_rapprochee', 'rapprochee']).optional(),
  bankRef: z.string().optional(),
  // Gestion déléguée - granularité loyers
  montantLoyer: z.number().min(0).optional(),
  chargesRecup: z.number().min(0).optional(),
  chargesNonRecup: z.number().min(0).optional()
};

// Schéma pour la création (avec monthsCovered)
export const createTransactionSchema = z.object({
  ...baseTransactionSchema,
  monthsCovered: z.number().int().min(1, 'Au moins 1 mois doit être couvert').default(1)
});

// Schéma pour l'édition (sans monthsCovered, champs série non modifiables)
export const updateTransactionSchema = z.object({
  ...baseTransactionSchema,
  // monthsCovered n'est PAS inclus dans le schéma d'édition
  // Les champs parentTransactionId, moisIndex, moisTotal ne sont jamais modifiables
});

// Schéma par défaut (pour compatibilité)
export const transactionFormSchema = z.object({
  ...baseTransactionSchema,
  monthsCovered: z.number().min(1, 'Au moins 1 mois doit être couvert')
});

export type TransactionFormData = z.infer<typeof transactionFormSchema>;
export type CreateTransactionData = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionData = z.infer<typeof updateTransactionSchema>;
