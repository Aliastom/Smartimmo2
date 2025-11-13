import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// TODO: Ajouter protection authentification admin


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, role: true, createdAt: true }
  });
  return NextResponse.json({ data: users });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request as any);
  if (guard) return guard;
  const body = await request.json();
  const { email, name, role = 'USER' } = body;
  if (!email) return NextResponse.json({ error: 'email requis' }, { status: 400 });
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role },
    create: { email, name, role }
  });
  return NextResponse.json({ data: user }, { status: 201 });
}


