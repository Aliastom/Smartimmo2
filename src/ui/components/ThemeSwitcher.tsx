'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun, Palette, ChevronDown, Flame, Snowflake } from 'lucide-react';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Éviter l'hydratation mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const themes = [
    { 
      id: 'smartimmo', 
      label: 'SmartImmo', 
      icon: Palette,
      description: 'Thème principal'
    },
    { 
      id: 'smartimmo-warm', 
      label: 'SmartImmo Warm', 
      icon: Flame,
      description: 'Tons chauds'
    },
    { 
      id: 'smartimmo-cool', 
      label: 'SmartImmo Cool', 
      icon: Snowflake,
      description: 'Tons froids'
    },
    { 
      id: 'light', 
      label: 'Clair', 
      icon: Sun,
      description: 'Thème clair'
    },
    { 
      id: 'dark', 
      label: 'Sombre', 
      icon: Moon,
      description: 'Thème sombre'
    },
    { 
      id: 'corporate', 
      label: 'Corporate', 
      icon: Monitor,
      description: 'Thème corporate'
    },
  ];

  // Trouver le thème actuel
  const currentTheme = themes.find(t => t.id === theme) || themes[0];

  if (!mounted) {
    return (
      <div className="dropdown dropdown-end">
        <div tabIndex={0} role="button" className="btn btn-ghost btn-sm">
          <Palette className="h-4 w-4" />
          <span className="hidden sm:inline">SmartImmo</span>
          <ChevronDown className="h-3 w-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="dropdown dropdown-end">
      <div 
        tabIndex={0} 
        role="button" 
        className="btn btn-ghost btn-sm flex items-center gap-2"
        aria-label="Changer de thème"
      >
        <currentTheme.icon className="h-4 w-4" />
        <span className="hidden sm:inline">{currentTheme.label}</span>
        <ChevronDown className="h-3 w-3" />
      </div>
      
      <ul 
        tabIndex={0} 
        className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow-lg border border-base-300"
        role="menu"
        aria-label="Menu des thèmes"
      >
        <li className="menu-title">
          <span>Choisir un thème</span>
        </li>
        
        {themes.map(({ id, label, icon: Icon, description }) => (
          <li key={id}>
            <button
              onClick={() => setTheme(id)}
              className={`flex items-center gap-3 ${
                theme === id ? 'active' : ''
              }`}
              role="menuitem"
              aria-label={`Changer vers le thème ${label}`}
              aria-current={theme === id ? 'true' : 'false'}
            >
              <Icon className="h-4 w-4" />
              <div className="flex flex-col items-start">
                <span className="font-medium">{label}</span>
                <span className="text-xs opacity-70">{description}</span>
              </div>
              {theme === id && (
                <div className="ml-auto">
                  <div className="badge badge-primary badge-sm">Actuel</div>
                </div>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
