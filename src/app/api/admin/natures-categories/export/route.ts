import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    console.log('[EXPORT API] Début de l\'export...');
    
    // Récupérer les données directement depuis Prisma avec toutes les relations
    const [natures, categories] = await Promise.all([
      prisma.natureEntity.findMany({
        include: {
          NatureRule: {
            select: {
              allowedType: true
            }
          },
          NatureDefault: {
            include: {
              Category: {
                select: {
                  slug: true,
                  label: true,
                  type: true
                }
              }
            }
          }
        },
        orderBy: { code: 'asc' }
      }),
      prisma.category.findMany({
        orderBy: { slug: 'asc' }
      })
    ]);

    console.log(`[EXPORT API] Données récupérées: ${natures.length} natures, ${categories.length} catégories`);

    // Transformer les données pour l'export (format cohérent avec l'import)
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      natures: natures.map(nature => ({
        key: nature.code,
        label: nature.label,
        flow: nature.flow || (nature.code.startsWith('RECETTE') ? 'INCOME' : 'EXPENSE'),
        active: true,
        compatibleTypes: nature.NatureRule.map(rule => rule.allowedType)
      })),
      categories: categories.map(category => ({
        key: category.slug,
        label: category.label,
        type: category.type,
        active: category.actif
      })),
      mappings: natures.map(nature => ({
        nature: nature.code,
        types: nature.NatureRule.map(rule => rule.allowedType),
        defaultCategory: nature.NatureDefault?.Category?.slug || undefined
      }))
    };

    console.log('[EXPORT API] Données transformées pour l\'export');

    // Créer le fichier JSON
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="natures-categories-config-${new Date().toISOString().split('T')[0]}.json"`
      }
    });
  } catch (error) {
    console.error('Error exporting natures-categories:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'export' },
      { status: 500 }
    );
  }
}
