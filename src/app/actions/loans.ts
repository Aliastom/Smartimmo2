'use server';

import { revalidatePath } from 'next/cache';
import { loanRepository } from '../../infra/repositories/loanRepository';
import { calculateMonthlyPayment } from '../../domain/use-cases/calculateLoanAmortization';
import { z } from 'zod';

const loanSchema = z.object({
  propertyId: z.string().min(1, 'L\'ID de la propriété est requis'),
  bankName: z.string().min(1, 'Le nom de la banque est requis'),
  loanAmount: z.number().positive('Le montant du prêt doit être positif'),
  interestRate: z.number().min(0, 'Le taux d\'intérêt doit être positif ou nul'),
  insuranceRate: z.number().min(0, 'Le taux d\'assurance doit être positif ou nul'),
  durationMonths: z.number().int().positive('La durée doit être un nombre de mois positif'),
  startDate: z.string().min(1, 'La date de début est requise'),
  status: z.enum(['active', 'paid_off', 'refinanced']),
});

export async function createLoan(formData: FormData) {
  try {
    const data = {
      propertyId: formData.get('propertyId') as string,
      bankName: formData.get('bankName') as string,
      loanAmount: parseFloat(formData.get('loanAmount') as string),
      interestRate: parseFloat(formData.get('interestRate') as string),
      insuranceRate: parseFloat(formData.get('insuranceRate') as string),
      durationMonths: parseInt(formData.get('durationMonths') as string),
      startDate: formData.get('startDate') as string,
      status: formData.get('status') as 'active' | 'paid_off' | 'refinanced',
    };

    const validatedData = loanSchema.parse(data);
    
    // Calculer la mensualité
    const monthlyPayment = calculateMonthlyPayment(
      validatedData.loanAmount,
      validatedData.interestRate + validatedData.insuranceRate,
      validatedData.durationMonths
    );

    const loan = await loanRepository.create({
      ...validatedData,
      startDate: new Date(validatedData.startDate),
      monthlyPayment,
      remainingCapital: validatedData.loanAmount,
    });

    revalidatePath('/loans');
    revalidatePath('/dashboard');
    revalidatePath(`/properties/${validatedData.propertyId}`);
    return { success: true, loan };
  } catch (error) {
    console.error('Error creating loan:', error);
    return { success: false, error: 'Erreur lors de la création du prêt' };
  }
}

export async function updateLoan(id: string, formData: FormData) {
  try {
    const data = {
      propertyId: formData.get('propertyId') as string,
      bankName: formData.get('bankName') as string,
      loanAmount: parseFloat(formData.get('loanAmount') as string),
      interestRate: parseFloat(formData.get('interestRate') as string),
      insuranceRate: parseFloat(formData.get('insuranceRate') as string),
      durationMonths: parseInt(formData.get('durationMonths') as string),
      startDate: formData.get('startDate') as string,
      status: formData.get('status') as 'active' | 'paid_off' | 'refinanced',
    };

    const validatedData = loanSchema.parse(data);
    
    // Calculer la mensualité
    const monthlyPayment = calculateMonthlyPayment(
      validatedData.loanAmount,
      validatedData.interestRate + validatedData.insuranceRate,
      validatedData.durationMonths
    );

    const loan = await loanRepository.update(id, {
      ...validatedData,
      startDate: new Date(validatedData.startDate),
      monthlyPayment,
      remainingCapital: validatedData.loanAmount, // À recalculer selon l'historique
    });

    revalidatePath('/loans');
    revalidatePath('/dashboard');
    revalidatePath(`/properties/${validatedData.propertyId}`);
    return { success: true, loan };
  } catch (error) {
    console.error('Error updating loan:', error);
    return { success: false, error: 'Erreur lors de la mise à jour du prêt' };
  }
}

export async function deleteLoan(id: string) {
  try {
    await loanRepository.delete(id);
    revalidatePath('/loans');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Error deleting loan:', error);
    return { success: false, error: 'Erreur lors de la suppression du prêt' };
  }
}
