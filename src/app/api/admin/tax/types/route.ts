/**
 * API Routes - Admin - Types fiscaux
 * GET  /api/admin/tax/types  - Liste tous les types fiscaux
 * POST /api/admin/tax/types  - Créer un nouveau type fiscal
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/tax/types
 * Liste tous les types fiscaux
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const active = searchParams.get('active');
    const category = searchParams.get('category');

    const where: any = {};
    
    if (active !== null) {
      where.isActive = active === 'true';
    }
    
    if (category) {
      where.category = category;
    }

    const types = await prisma.fiscalType.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { label: 'asc' },
      ],
    });

    return NextResponse.json(types);
  } catch (error: any) {
    console.error('Error fetching fiscal types:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des types fiscaux', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tax/types
 * Créer un nouveau type fiscal
 * 
 * Body: {
 *   id: string,           // ex: "NU", "MEUBLE", "SCI_IS"
 *   label: string,
 *   category: string,     // "FONCIER" | "BIC" | "IS"
 *   description?: string,
 *   isActive?: boolean
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, label, category, description, isActive } = body;

    // Validation
    if (!id || !label || !category) {
      return NextResponse.json(
        { error: 'Champs requis manquants: id, label, category' },
        { status: 400 }
      );
    }

    // Vérifier si l'ID existe déjà
    const existing = await prisma.fiscalType.findUnique({
      where: { id },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Un type fiscal avec l'ID "${id}" existe déjà` },
        { status: 409 }
      );
    }

    // Créer le type fiscal
    const fiscalType = await prisma.fiscalType.create({
      data: {
        id,
        label,
        category,
        description: description || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json(fiscalType, { status: 201 });
  } catch (error: any) {
    console.error('Error creating fiscal type:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du type fiscal', details: error.message },
      { status: 500 }
    );
  }
}

