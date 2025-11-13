'use server';

import { revalidatePath } from 'next/cache';
import { propertyRepository } from '../../infra/repositories/propertyRepository';
import { z } from 'zod';

const propertySchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  type: z.enum(['house', 'apartment', 'garage', 'commercial', 'land']),
  address: z.string().min(1, 'L\'adresse est requise'),
  postalCode: z.string().min(1, 'Le code postal est requis'),
  city: z.string().min(1, 'La ville est requise'),
  surface: z.number().positive('La surface doit être positive'),
  rooms: z.number().int().min(0, 'Le nombre de pièces doit être positif ou nul'),
  acquisitionDate: z.string().min(1, 'La date d\'acquisition est requise'),
  acquisitionPrice: z.number().positive('Le prix d\'acquisition doit être positif'),
  notaryFees: z.number().min(0, 'Les frais de notaire doivent être positifs ou nuls'),
  currentValue: z.number().min(0, 'La valeur actuelle doit être positive ou nulle'),
  status: z.enum(['rented', 'vacant', 'under_works']),
  notes: z.string().optional(),
});

export async function createProperty(formData: FormData) {
  try {
    const occupation = formData.get('occupation') as string;
    const statusMode = formData.get('statusMode') as string;
    const exitFeesRateStr = formData.get('exitFeesRate') as string;

    const data = {
      name: formData.get('name') as string,
      type: formData.get('type') as 'house' | 'apartment' | 'garage' | 'commercial' | 'land',
      address: formData.get('address') as string,
      postalCode: formData.get('postalCode') as string,
      city: formData.get('city') as string,
      surface: parseFloat(formData.get('surface') as string),
      rooms: parseInt(formData.get('rooms') as string),
      acquisitionDate: formData.get('acquisitionDate') as string,
      acquisitionPrice: parseFloat(formData.get('acquisitionPrice') as string),
      notaryFees: parseFloat(formData.get('notaryFees') as string),
      currentValue: parseFloat(formData.get('currentValue') as string),
      occupation: occupation || 'VACANT',
      statusMode: statusMode || 'AUTO',
      exitFeesRate: exitFeesRateStr ? parseFloat(exitFeesRateStr) : null,
      status: 'vacant', // Défaut, sera calculé par l'API selon occupation
      notes: formData.get('notes') as string || undefined,
    };

    // Valider la cohérence occupation ↔ statut côté serveur
    const { validatePropertyOccupationStatus } = await import('@/domain/services/propertyValidationService');
    const validation = await validatePropertyOccupationStatus(
      null, // création
      data.occupation,
      data.statusMode,
      null,
      false // pas de vérification de baux actifs en création
    );

    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    // Appliquer les ajustements suggérés
    if (validation.adjustments) {
      if (validation.adjustments.statusMode) {
        data.statusMode = validation.adjustments.statusMode;
      }
      if (validation.adjustments.status) {
        data.status = validation.adjustments.status;
      }
    }

    // Créer le bien directement
    const property = await propertyRepository.create({
      ...data,
      acquisitionDate: new Date(data.acquisitionDate),
    });
    
    revalidatePath('/properties');
    revalidatePath('/dashboard');
    return { success: true, property, warnings: validation.warnings };
  } catch (error) {
    console.error('Error creating property:', error);
    return { success: false, error: 'Erreur lors de la création du bien' };
  }
}

export async function updateProperty(id: string, formData: FormData) {
  try {
    const data = {
      name: formData.get('name') as string,
      type: formData.get('type') as 'house' | 'apartment' | 'garage' | 'commercial' | 'land',
      address: formData.get('address') as string,
      postalCode: formData.get('postalCode') as string,
      city: formData.get('city') as string,
      surface: parseFloat(formData.get('surface') as string),
      rooms: parseInt(formData.get('rooms') as string),
      acquisitionDate: formData.get('acquisitionDate') as string,
      acquisitionPrice: parseFloat(formData.get('acquisitionPrice') as string),
      notaryFees: parseFloat(formData.get('notaryFees') as string),
      currentValue: parseFloat(formData.get('currentValue') as string),
      status: formData.get('status') as 'rented' | 'vacant' | 'under_works',
      notes: formData.get('notes') as string || undefined,
    };

    const validatedData = propertySchema.parse(data);
    const property = await propertyRepository.update(id, {
      ...validatedData,
      acquisitionDate: new Date(validatedData.acquisitionDate),
    });

    revalidatePath('/properties');
    revalidatePath('/dashboard');
    revalidatePath(`/properties/${id}`);
    return { success: true, property };
  } catch (error) {
    console.error('Error updating property:', error);
    return { success: false, error: 'Erreur lors de la mise à jour du bien' };
  }
}

export async function deleteProperty(id: string) {
  try {
    await propertyRepository.delete(id);
    revalidatePath('/properties');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Error deleting property:', error);
    return { success: false, error: 'Erreur lors de la suppression du bien' };
  }
}
