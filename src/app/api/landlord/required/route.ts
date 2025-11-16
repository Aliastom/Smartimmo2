import { NextResponse } from 'next/server';
import { landlordRepository } from '../../../../infra/repositories/landlordRepository';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAuth();
    const requiredFields = await landlordRepository.getRequiredFields();
    const allFilled = requiredFields.every(f => f.filled);
    
    return NextResponse.json({
      requiredFields,
      allFilled,
      missingCount: requiredFields.filter(f => !f.filled).length,
    });
  } catch (error) {
    console.error('Error checking required fields:', error);
    return NextResponse.json({ error: 'Erreur lors de la vérification des champs requis' }, { status: 500 });
  }
}

