import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rules = await prisma.natureRule.findMany({
      include: {
        nature: {
          select: {
            code: true,
            label: true,
          },
        },
      },
      orderBy: [
        { natureCode: 'asc' },
        { allowedType: 'asc' },
      ],
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error('Error fetching nature rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nature rules', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { natureCode, allowedType } = await request.json();

    if (!natureCode || !allowedType) {
      return NextResponse.json({ error: 'natureCode and allowedType are required' }, { status: 400 });
    }

    const rule = await prisma.natureRule.create({
      data: {
        natureCode,
        allowedType,
      },
      include: {
        nature: {
          select: {
            code: true,
            label: true,
          },
        },
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error creating nature rule:', error);
    return NextResponse.json(
      { error: 'Failed to create nature rule', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await prisma.natureRule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting nature rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete nature rule', details: error.message },
      { status: 500 }
    );
  }
}

