'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Search, Bell, Menu, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { LogoutButton } from '@/components/auth/LogoutButton';

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

  return (
    <header className={cn(
      "sticky top-0 z-40 h-16 px-4 lg:px-6",
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

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-primary-500 rounded-xl">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="font-bold text-lg text-gray-900 hidden sm:block">
            SmartImmo
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
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-danger-500 rounded-full"></span>
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
