'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, Bell, Menu } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { useAuth } from '@/hooks/useAuth';
import { LogoWithSyncStatus } from '@/components/offline/LogoWithSyncStatus';
import { BRANDING } from '@/lib/branding';

interface TopbarProps {
  onMenuClick?: () => void;
  showSearch?: boolean;
  className?: string;
}

export function Topbar({ 
  onMenuClick, 
  showSearch = true, 
  className 
}: TopbarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Utiliser le hook centralisé React Query (plus performant)
  const { isAuthenticated: authIsAuthenticated } = useAuth();
  
  useEffect(() => {
    setIsAuthenticated(authIsAuthenticated);
  }, [authIsAuthenticated]);

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-40 h-16 px-4 lg:px-6",
      "bg-white/80 backdrop-blur-md border-b border-gray-200",
      "flex items-center justify-between",
      className
    )}>
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo + Sync */}
        <div className="flex items-center gap-3">
          <Link href="/app" className="flex items-center gap-3 shrink-0">
            <Image
              src={BRANDING.logoUrl}
              alt={BRANDING.name}
              width={140}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>
          <LogoWithSyncStatus size="sm" bgColor="bg-primary-500" className="rounded-lg shrink-0" />
          <span className="font-bold text-lg text-gray-900 hidden sm:block">
            {BRANDING.name}
          </span>
        </div>
      </div>

      {/* Center section - Search */}
      {showSearch && (
        <div className="hidden md:block flex-1 max-w-md mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-2xl text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Notifications - Badge retiré, maintenant dans la sidebar en bas */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </Button>

        {/* Déconnexion */}
        <LogoutButton 
          showIcon={true}
          variant="ghost"
          className="gap-2"
        />
      </div>
    </header>
  );
}
