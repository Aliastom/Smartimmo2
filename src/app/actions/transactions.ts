'use server';

import { revalidatePath } from 'next/cache';
import { transactionRepository } from '../../infra/repositories/transactionRepository';
import { z } from 'zod';

const transactionSchema = z.object({
  propertyId: z.string().min(1, 'L\'ID de la propriété est requis'),
  leaseId: z.string().optional(),
  type: z.enum(['rent', 'expense', 'loan_payment', 'tax']),
  label: z.string().min(1, 'Le libellé est requis'),
  amount: z.number().positive('Le montant doit être positif'),
  date: z.string().min(1, 'La date est requise'),
  category: z.string().optional(),
  isRecurring: z.boolean().optional(),
});

export async function createTransaction(formData: FormData) {
  try {
    const data = {
      propertyId: formData.get('propertyId') as string,
      leaseId: formData.get('leaseId') as string || undefined,
      type: formData.get('type') as 'rent' | 'expense' | 'loan_payment' | 'tax',
      label: formData.get('label') as string,
      amount: parseFloat(formData.get('amount') as string),
      date: formData.get('date') as string,
      category: formData.get('category') as string || undefined,
      isRecurring: formData.get('isRecurring') === 'on',
    };

    const validatedData = transactionSchema.parse(data);
    const transaction = await transactionRepository.create({
      ...validatedData,
      date: new Date(validatedData.date),
    });

    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    return { success: true, transaction };
  } catch (error) {
    console.error('Error creating transaction:', error);
    return { success: false, error: 'Erreur lors de la création de la transaction' };
  }
}

export async function updateTransaction(id: string, formData: FormData) {
  try {
    const data = {
      propertyId: formData.get('propertyId') as string,
      leaseId: formData.get('leaseId') as string || undefined,
      type: formData.get('type') as 'rent' | 'expense' | 'loan_payment' | 'tax',
      label: formData.get('label') as string,
      amount: parseFloat(formData.get('amount') as string),
      date: formData.get('date') as string,
      category: formData.get('category') as string || undefined,
      isRecurring: formData.get('isRecurring') === 'on',
    };

    const validatedData = transactionSchema.parse(data);
    const transaction = await transactionRepository.update(id, {
      ...validatedData,
      date: new Date(validatedData.date),
    });

    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    return { success: true, transaction };
  } catch (error) {
    console.error('Error updating transaction:', error);
    return { success: false, error: 'Erreur lors de la mise à jour de la transaction' };
  }
}

export async function deleteTransaction(id: string) {
  try {
    await transactionRepository.delete(id);
    revalidatePath('/transactions');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return { success: false, error: 'Erreur lors de la suppression de la transaction' };
  }
}
