'use client';

import { useEffect, useState, useRef } from 'react';
import { Shield, LogOut, Settings, User, ChevronUp } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

interface UserInfo {
  name: string | null;
  email: string;
  role: string;
}

/**
 * Affiche les informations de l'utilisateur connecté avec menu popup
 * Récupère les données depuis l'API /api/auth/me
 */
export function UserDisplay({ className }: { className?: string }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          // Si l'utilisateur n'est pas authentifié, réinitialiser
          setUser(null);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération du profil:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
    
    // Vérifier périodiquement l'authentification (toutes les 5 secondes)
    const interval = setInterval(fetchUser, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fermer le menu au clic extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
      setIsMenuOpen(false);
      await fetch('/auth/logout', { method: 'POST' }).catch(() => {});
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      setIsLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center gap-3 p-3", className)}>
        <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3" />
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
    <div className={cn("relative", className)} ref={menuRef}>
      {/* Menu Popup */}
      {isMenuOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Header du menu */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {user.name || 'Utilisateur'}
            </p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
            {user.role === 'ADMIN' && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium">
                <Shield className="w-3 h-3" />
                Administrateur
              </div>
            )}
          </div>

          {/* Options du menu */}
          <div className="py-1">
            <button
              onClick={() => {
                setIsMenuOpen(false);
                router.push('/profil');
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <User className="w-4 h-4 text-gray-400" />
              Mon Profil
            </button>

            <button
              onClick={() => {
                setIsMenuOpen(false);
                router.push('/parametres');
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-4 h-4 text-gray-400" />
              Paramètres
            </button>
          </div>

          {/* Déconnexion */}
          <div className="border-t border-gray-100 pt-1">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut className="w-4 h-4" />
              {isLoggingOut ? 'Déconnexion...' : 'Se déconnecter'}
            </button>
          </div>
        </div>
      )}

      {/* Bouton utilisateur */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className={cn(
          "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200",
          "hover:bg-gray-100 active:scale-98",
          isMenuOpen && "bg-gray-100"
        )}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center font-semibold text-sm">
            {initials}
          </div>
          {/* Badge Administrateur - toujours visible en bas du menu */}
          {user && user.role === 'ADMIN' && (
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white">
              <Shield className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-gray-900 truncate">
            {user.name || 'Utilisateur'}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {user.email}
          </p>
        </div>

        {/* Icône chevron */}
        <ChevronUp 
          className={cn(
            "w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0",
            isMenuOpen && "rotate-180"
          )} 
        />
      </button>
    </div>
  );
}

