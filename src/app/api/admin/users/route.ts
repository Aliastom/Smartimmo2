import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users - Liste tous les utilisateurs (ADMIN uniquement)
 */
export async function GET() {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { 
      id: true, 
      name: true, 
      email: true, 
      role: true, 
      supabaseId: true,
      emailVerified: true,
      createdAt: true 
    }
  });
  
  return NextResponse.json({ data: users });
}

/**
 * POST /api/admin/users - Créer ou mettre à jour un utilisateur (ADMIN uniquement)
 */
export async function POST(request: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  const body = await request.json();
  const { email, name, role = 'USER' } = body;
  
  if (!email) {
    return NextResponse.json({ error: 'email requis' }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: { email, name, role }
  });
  
  return NextResponse.json({ data: user }, { status: 201 });
}


