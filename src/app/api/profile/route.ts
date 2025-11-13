import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    let profile = await prisma.userProfile.findFirst();
    
    if (!profile) {
      // Créer un profil par défaut s'il n'existe pas
      profile = await prisma.userProfile.create({
        data: {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          address: '',
          postalCode: '',
          city: '',
          company: '',
          siret: '',
        },
      });
    }
    
    // Formater les données pour la compatibilité avec l'ancien format landlord
    const formattedProfile = {
      id: 1,
      fullName: `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
      firstName: profile.firstName,
      lastName: profile.lastName,
      address1: profile.address || '',
      address2: null,
      postalCode: profile.postalCode || '',
      city: profile.city || '',
      email: profile.email || '',
      phone: profile.phone || null,
      siret: profile.siret || null,
      signatureUrl: profile.signature || null,
      logoUrl: profile.logo || null,
      company: profile.company || null,
    };
    
    return NextResponse.json(formattedProfile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération du profil' }, { status: 500 });
  }
}

