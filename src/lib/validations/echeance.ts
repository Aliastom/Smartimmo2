/**
 * Schéma de validation Zod pour le formulaire d'échéance (côté client)
 */

import { z } from 'zod';
import { EcheanceType, Periodicite, SensEcheance } from '@prisma/client';

export const echeanceFormSchema = z.object({
  label: z.string().min(1, 'Le libellé est requis'),
  type: z.nativeEnum(EcheanceType, { required_error: 'Le type est requis' }),
  periodicite: z.nativeEnum(Periodicite, { required_error: 'La périodicité est requise' }),
  montant: z.coerce.number().positive('Le montant doit être positif'),
  recuperable: z.boolean().default(false),
  sens: z.nativeEnum(SensEcheance, { required_error: 'Le sens est requis' }),
  propertyId: z.string().nullable().optional(),
  leaseId: z.string().nullable().optional(),
  startAt: z.string().min(1, 'La date de début est requise'), // Format YYYY-MM-DD
  endAt: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
}).refine(
  (data) => {
    // Si endAt est fourni et non vide, il doit être >= startAt
    if (data.endAt && data.endAt.trim() !== '') {
      const start = new Date(data.startAt);
      const end = new Date(data.endAt);
      return end >= start;
    }
    return true;
  },
  { 
    message: "La date de fin doit être supérieure ou égale à la date de début",
    path: ['endAt'],
  }
);

export type EcheanceFormSchema = z.infer<typeof echeanceFormSchema>;

