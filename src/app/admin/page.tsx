import { Suspense } from 'react';
import { AdminPageCore } from '@/features/admin/AdminPageCore';

export default async function AdminPage() {
  // Protection ADMIN gérée par le layout /admin/layout.tsx
  
  // La carte Base de Données est activée uniquement si ENABLE_PRISMA_STUDIO est explicitement défini à "true" dans .env.local
  const enablePrismaStudio = process.env.ENABLE_PRISMA_STUDIO === 'true';
  
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <AdminPageCore mode="normal" enablePrismaStudio={enablePrismaStudio} />
    </Suspense>
  );
}
