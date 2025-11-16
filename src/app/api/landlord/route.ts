import { NextRequest, NextResponse } from 'next/server';
import { landlordRepository } from '../../../infra/repositories/landlordRepository';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const landlordSchema = z.object({
  fullName: z.string().min(1, 'Le nom complet est requis'),
  address1: z.string().min(1, 'L\'adresse est requise'),
  address2: z.string().nullable().optional(),
  postalCode: z.string().min(1, 'Le code postal est requis'),
  city: z.string().min(1, 'La ville est requise'),
  email: z.string().email('Email invalide'),
  phone: z.string().nullable().optional(),
  siret: z.string().nullable().optional(),
  iban: z.string().nullable().optional(),
  bic: z.string().nullable().optional(),
  signatureUrl: z.string().nullable().optional(),
});

export async function GET() {
  try {
    await requireAuth();
    const landlord = await landlordRepository.get();
    return NextResponse.json(landlord);
  } catch (error) {
    console.error('Error fetching landlord:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération du profil' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    
    // Nettoyer les strings
    const cleanedData = Object.keys(body).reduce((acc, key) => {
      const value = body[key];
      acc[key] = typeof value === 'string' ? value.trim() : value;
      return acc;
    }, {} as any);
    
    const validatedData = landlordSchema.parse(cleanedData);
    
    const updatedLandlord = await landlordRepository.update(validatedData);
    return NextResponse.json(updatedLandlord);
  } catch (error) {
    console.error('Error updating landlord:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du profil' }, { status: 500 });
  }
}

