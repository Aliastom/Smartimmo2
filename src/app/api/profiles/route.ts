import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const profileSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide'),
  phone: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  company: z.string().optional(),
  siret: z.string().optional(),
  signature: z.string().optional(), // Base64 de la signature
  logo: z.string().optional(), // URL du logo
});

import { requireAuth } from '@/lib/auth/getCurrentUser';

export async function GET() {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    
    const profile = await prisma.userProfile.findFirst({
      where: {
        organizationId,
      },
    });
    return NextResponse.json({ data: profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch profile', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    
    const body = await request.json();
    const validatedData = profileSchema.parse(body);

    const existingProfile = await prisma.userProfile.findFirst({
      where: {
        organizationId,
      },
    });

    let profile;
    if (existingProfile) {
      profile = await prisma.userProfile.update({
        where: { id: existingProfile.id },
        data: validatedData,
      });
    } else {
      profile = await prisma.userProfile.create({
        data: {
          ...validatedData,
          organizationId, // ✅ Associer à l'organisation de l'utilisateur
        },
      });
    }

    return NextResponse.json({ 
      message: 'Profil enregistré avec succès',
      data: profile 
    });
  } catch (error) {
    console.error('Error saving profile:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
  }
}
