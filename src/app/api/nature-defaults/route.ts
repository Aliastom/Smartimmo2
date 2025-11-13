import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const defaults = await prisma.natureDefault.findMany({
      include: {
        nature: {
          select: {
            code: true,
            label: true,
          },
        },
        Category: {
          select: {
            id: true,
            slug: true,
            label: true,
            type: true,
          },
        },
      },
      orderBy: {
        natureCode: 'asc',
      },
    });

    return NextResponse.json(defaults);
  } catch (error) {
    console.error('Error fetching nature defaults:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nature defaults', details: error.message },
      { status: 500 }
    );
  }
}

