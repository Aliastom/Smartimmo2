import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  // TODO: Ajouter protection authentification admin
  const body = await request.json();
  const { name, role } = body;
  const user = await prisma.user.update({ where: { id: params.id }, data: { name, role } });
  return NextResponse.json({ data: user });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(request as any);
  if (guard) return guard;
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}


