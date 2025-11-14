import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Layout pour toutes les pages d'administration
 * Vérifie automatiquement que l'utilisateur est ADMIN
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Protection ADMIN
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login?redirect=/admin');
  }
  
  if (user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return <>{children}</>;
}

