import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateProfileForLeaseSignature, ProfileData } from '@/lib/services/profileService';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Récupérer le profil utilisateur
    const profile = await prisma.userProfile.findFirst();
    
    if (!profile) {
      return NextResponse.json({
        isValid: false,
        missingFields: ['Profil complet'],
        message: 'Aucun profil trouvé. Veuillez créer votre profil avant d\'envoyer le bail pour signature.'
      });
    }

    // Convertir en ProfileData
    const profileData: ProfileData = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone || undefined,
      address: profile.address || undefined,
      city: profile.city || undefined,
      postalCode: profile.postalCode || undefined,
      company: profile.company || undefined,
      siret: profile.siret || undefined,
      signature: profile.signature || undefined,
      logo: profile.logo || undefined
    };

    // Valider le profil
    const validation = validateProfileForLeaseSignature(profileData);

    return NextResponse.json(validation);

  } catch (error) {
    console.error('Error validating profile:', error);
    return NextResponse.json(
      { 
        isValid: false,
        missingFields: ['Erreur de validation'],
        message: 'Erreur lors de la validation du profil'
      },
      { status: 500 }
    );
  }
}
