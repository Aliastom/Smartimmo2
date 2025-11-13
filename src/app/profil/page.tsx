import ProfilClient from './ProfilClient';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering - cette page nécessite un accès à la base de données
export const dynamic = 'force-dynamic';

export default async function ProfilPage() {
  // Récupérer les données du profil depuis la base de données
  const profile = await prisma.userProfile.findFirst();
  
  return <ProfilClient initialData={profile} />;
}