'use client';

import { useEffect, useState } from 'react';
import { User, Shield } from 'lucide-react';
import { cn } from '@/utils/cn';

interface UserInfo {
  name: string | null;
  email: string;
  role: string;
}

/**
 * Affiche les informations de l'utilisateur connecté
 * Récupère les données depuis l'API /api/profile
 */
export function UserDisplay({ className }: { className?: string }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du profil:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  if (loading) {
    return (
      <div className={cn("flex items-center gap-3 p-3", className)}>
        <div className="w-10 h-10 rounded-full bg-base-300 animate-pulse" />
        <div className="flex-1">
          <div className="h-4 bg-base-300 rounded animate-pulse mb-2" />
          <div className="h-3 bg-base-300 rounded animate-pulse w-2/3" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const initials = user.name 
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email[0].toUpperCase();

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg hover:bg-base-200 transition-colors",
      className
    )}>
      {/* Avatar */}
      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-primary text-primary-content flex items-center justify-center font-semibold">
          {initials}
        </div>
        {user.role === 'ADMIN' && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-warning rounded-full flex items-center justify-center border-2 border-base-100">
            <Shield className="w-3 h-3 text-warning-content" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-base-content truncate">
          {user.name || 'Utilisateur'}
        </p>
        <p className="text-xs text-base-content/60 truncate">
          {user.email}
        </p>
      </div>
    </div>
  );
}

