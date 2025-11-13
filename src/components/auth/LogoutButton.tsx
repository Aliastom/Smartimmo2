'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

interface LogoutButtonProps {
  className?: string;
  showIcon?: boolean;
  variant?: 'default' | 'ghost' | 'outline';
}

export function LogoutButton({ 
  className = '', 
  showIcon = true,
  variant = 'ghost' 
}: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setLoading(true);
    
    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
      
      // Rediriger vers la page de login
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={`btn btn-${variant} ${loading ? 'loading' : ''} ${className}`}
    >
      {!loading && showIcon && <LogOut className="h-4 w-4" />}
      <span>Déconnexion</span>
    </button>
  );
}

