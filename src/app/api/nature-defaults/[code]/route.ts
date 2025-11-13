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
    });

    return NextResponse.json(defaultCategory);
  } catch (error) {
    console.error('Error fetching nature default:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nature default', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const { defaultCategoryId } = await request.json();

    // Vérifier que la catégorie est compatible avec la nature
    if (defaultCategoryId) {
      const category = await prisma.category.findUnique({
        where: { id: defaultCategoryId },
        select: { type: true },
      });

      if (!category) {
        return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 400 });
      }

      // Vérifier que le type de catégorie est autorisé pour cette nature
      const rule = await prisma.natureRule.findFirst({
        where: {
          natureCode: code,
          allowedType: category.type,
        },
      });

      if (!rule) {
        return NextResponse.json(
          { error: `Le type "${category.type}" n'est pas autorisé pour la nature "${code}"` },
          { status: 400 }
        );
      }
    }

    const updatedDefault = await prisma.natureDefault.upsert({
      where: {
        natureCode: code,
      },
      update: {
        defaultCategoryId,
      },
      create: {
        natureCode: code,
        defaultCategoryId,
      },
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
    });

    return NextResponse.json(updatedDefault);
  } catch (error) {
    console.error('Error updating nature default:', error);
    return NextResponse.json(
      { error: 'Failed to update nature default', details: error.message },
      { status: 500 }
    );
  }
}

