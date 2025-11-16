import { NextRequest, NextResponse } from 'next/server';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { deleteUserSafely } from '@/lib/services/userDeletionService';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, role } = body;
    const user = await prisma.user.update({ where: { id: params.id }, data: { name, role } });
    return NextResponse.json({ data: user });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'utilisateur' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const currentAdmin = await getCurrentUser();
    if (!currentAdmin) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const result = await deleteUserSafely(params.id, currentAdmin.id);

    return NextResponse.json({ 
      ok: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[Delete User] Erreur:', error);
    
    // Gestion des erreurs de contrainte de clé étrangère
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Impossible de supprimer : des éléments sont encore liés à cet utilisateur' },
        { status: 409 }
      );
    }

    // Gestion des erreurs métier
    if (error.message) {
      const status = error.message.includes('ne peut pas supprimer') ? 400 : 
                    error.message.includes('non trouvé') ? 404 : 500;
      return NextResponse.json(
        { error: error.message },
        { status }
      );
    }

    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'utilisateur' },
      { status: 500 }
    );
  }
}


