import ProfilClient from './ProfilClient';
import { prisma } from '@/lib/prisma';

export default async function ProfilPage() {
  // Récupérer les données du profil depuis la base de données
  const profile = await prisma.userProfile.findFirst();
  
  return <ProfilClient initialData={profile} />;
}