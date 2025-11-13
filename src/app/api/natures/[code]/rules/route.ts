import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;

    const rules = await prisma.natureRule.findMany({
      where: {
        natureCode: code,
      },
      select: {
        allowedType: true,
      },
    });

    const allowedTypes = rules.map(rule => rule.allowedType);

    return NextResponse.json({ allowedTypes });
  } catch (error) {
    console.error('Error fetching nature rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nature rules', details: error.message },
      { status: 500 }
    );
  }
}

