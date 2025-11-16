import ProfilClient from './ProfilClient';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';

// Force dynamic rendering - cette page nécessite un accès à la base de données
export const dynamic = 'force-dynamic';

export default async function ProfilPage() {
  // Récupérer l'utilisateur connecté pour filtrer par organisation
  const user = await getCurrentUser();
  if (!user) {
    return <div>Non authentifié</div>;
  }

  // Récupérer le profil de l'organisation de l'utilisateur
  const profile = await prisma.userProfile.findFirst({
    where: {
      organizationId: user.organizationId,
    },
  });
  
  return <ProfilClient initialData={profile} />;
}