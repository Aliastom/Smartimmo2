import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;

    const defaultCategory = await prisma.natureDefault.findUnique({
      where: {
        natureCode: code,
      },
      include: {
        Category: {
          select: {
            id: true,
            slug: true,
            label: true,
          },
        },
      },
    });

    if (!defaultCategory || !defaultCategory.Category) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      categoryId: defaultCategory.Category.id,
      slug: defaultCategory.Category.slug,
      label: defaultCategory.Category.label,
    });
  } catch (error) {
    console.error('Error fetching nature default:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nature default', details: error.message },
      { status: 500 }
    );
  }
}

