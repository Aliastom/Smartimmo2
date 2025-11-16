import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/getCurrentUser";


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAuth();
    const landlord = await prisma.landlord.findUnique({
      where: { id: 1 },
      select: { signatureUrl: true }
    });
    return NextResponse.json({ signature_url: landlord?.signatureUrl || null });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { dataUrl, landlordId = 1 } = await req.json();
    if (!dataUrl?.startsWith("data:image/")) {
      return NextResponse.json({ error: "invalid_image" }, { status: 400 });
    }
    await prisma.landlord.update({ where: { id: landlordId }, data: { signatureUrl: dataUrl } });
    return NextResponse.json({ signature_url: dataUrl });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await requireAuth();
    await prisma.landlord.update({ where: { id: 1 }, data: { signatureUrl: null } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
