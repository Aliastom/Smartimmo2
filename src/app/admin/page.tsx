import AdminPageClient from './AdminPageClient';

export default async function AdminPage() {
  // La carte Base de Données est activée uniquement si ENABLE_PRISMA_STUDIO est explicitement défini à "true" dans .env.local
  const enablePrismaStudio = process.env.ENABLE_PRISMA_STUDIO === 'true';
  
  return <AdminPageClient enablePrismaStudio={enablePrismaStudio} />;
}
