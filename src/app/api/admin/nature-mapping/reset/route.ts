import { NextResponse } from 'next/server';
import { resetNatureMapping, seedNatureMapping } from '@/lib/seed/nature-mapping-seed';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

// POST /api/admin/nature-mapping/reset

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST() {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    console.log('🔄 Réinitialisation du mapping Nature ↔ Catégorie via API...');
    
    // Réinitialiser et re-seeder
    await resetNatureMapping();
    await seedNatureMapping();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mapping:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la réinitialisation du mapping' },
      { status: 500 }
    );
  }
}
