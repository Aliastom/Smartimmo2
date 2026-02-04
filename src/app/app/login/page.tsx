'use client';

/**
 * Page de connexion pour le mode App Shell
 * Utilise LoginPageCore avec mode='app-shell'
 */

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoginPageCore } from '@/features/auth/LoginPageCore';
import { useAppAuth } from '@/features/auth/useAppAuth';

export default function AppLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAppAuth();

  // Rediriger si déjà connecté
  useEffect(() => {
    if (!loading && user) {
      const redirect = searchParams.get('redirect') || '/app?view=dashboard';
      router.push(redirect);
    }
  }, [user, loading, router, searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#E3EEFA]">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-sky-500 mb-4"></div>
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (user) {
    // Redirection en cours
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#E3EEFA]">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-sky-500 mb-4"></div>
          <p className="text-slate-600">Redirection...</p>
        </div>
      </div>
    );
  }

  const redirect = searchParams.get('redirect') || '/app?view=dashboard';

  return (
    <LoginPageCore
      mode="app-shell"
      redirectPath={redirect}
    />
  );
}
