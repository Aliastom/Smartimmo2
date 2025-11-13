import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  // TODO: Ajouter protection authentification admin
  const body = await request.json();
  const { name, role } = body;
  const user = await prisma.user.update({ where: { id: params.id }, data: { name, role } });
  return NextResponse.json({ data: user });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  const guard = await requireAdmin(request as any);
  if (guard) return guard;
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}


