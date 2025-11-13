import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { redirect } from 'next/navigation';

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

