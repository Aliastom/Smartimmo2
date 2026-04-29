/**
 * Core Component pour la page Paramètres
 * 
 * Une seule source de vérité graphique utilisable en mode "normal" et "app-shell"
 * Toute la logique UI est centralisée ici.
 * 
 * Réplique EXACTEMENT le comportement de ParametresClient.tsx
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Palette, 
  User, 
  Settings2, 
  FileSpreadsheet,
  ExternalLink,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { navigateToView } from '@/utils/appShellNavigation';
import { useSidebarOptional } from '@/contexts/SidebarContext';

export interface ParametresPageCoreProps {
  mode: 'normal' | 'app-shell';
}

export function ParametresPageCore({
  mode,
}: ParametresPageCoreProps) {
  const sidebarContext = useSidebarOptional();
  const parametresSections = [
    {
      id: 'gestion-societes',
      title: 'Gestion des Sociétés',
      description: 'Ajoutez et gérez vos sociétés de gestion déléguée',
      icon: Building2,
      href: mode === 'app-shell' ? '/app?view=gestion-deleguee' : '/gestion-deleguee',
      color: 'emerald' as const
    },
    {
      id: 'lmnp-activities',
      title: 'LMNP',
      description: 'Gérez vos activités LMNP, analysez vos biens et générez votre dossier comptable.',
      icon: FileSpreadsheet,
      href: '/app?view=lmnp-activities',
      color: 'blue' as const,
      external: false
    },
    {
      id: 'preferences',
      title: 'Préférences d\'affichage',
      description: 'Thème, devises, notifications et paramètres d\'interface',
      icon: Palette,
      href: '/parametres/preferences',
      color: 'purple' as const,
      soon: true
    },
    {
      id: 'profil',
      title: 'Mon Profil',
      description: 'Coordonnées, signature et informations personnelles',
      icon: User,
      href: mode === 'app-shell' ? '/app?view=profil' : '/profil',
      color: 'blue' as const,
      external: false
    },
    {
      id: 'advanced',
      title: 'Paramètres Avancés',
      description: 'Configuration technique et préférences système',
      icon: Settings2,
      href: '/parametres/avances',
      color: 'gray' as const,
      soon: true
    }
  ];

  const colorClasses = {
    emerald: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    purple: 'bg-purple-100 text-purple-600 border-purple-200', 
    blue: 'bg-blue-100 text-blue-600 border-blue-200',
    gray: 'bg-gray-100 text-gray-600 border-gray-200'
  };

  const handleSectionClick = (section: typeof parametresSections[0]) => {
    if (section.soon) return;
    
    if (mode === 'app-shell') {
      // En mode app-shell, utiliser navigateToView pour la navigation interne (pas de rechargement)
      if (section.external) {
        window.open(section.href, '_blank');
      } else {
        // Pour les routes app-shell, utiliser navigateToView (pas de rechargement de page)
        if (section.id === 'profil') {
          navigateToView('profil');
        } else if (section.id === 'gestion-societes') {
          // Navigation vers gestion-deleguee en app-shell
          navigateToView('gestion-deleguee');
        } else if (section.id === 'lmnp-activities') {
          navigateToView('lmnp-activities');
        } else if (section.href.startsWith('/app?')) {
          // Extraire la vue depuis l'URL
          const url = new URL(section.href, window.location.origin);
          const view = url.searchParams.get('view') as any;
          if (view) {
            navigateToView(view);
          }
        } else {
          // Pour les autres routes, utiliser window.location (fallback)
          window.location.href = section.href;
        }
      }
    } else {
      // En mode normal, utiliser window.location
      if (section.external) {
        window.open(section.href, '_blank');
      } else {
        window.location.href = section.href;
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header avec Hamburger + Titre */}
      <div className="mb-4 sm:mb-6 space-y-3">
        {/* Ligne 1 : Hamburger + Titre */}
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Bouton hamburger mobile - Discret, aligné à gauche du titre */}
            {sidebarContext && (
              <button
                onClick={sidebarContext.toggleSidebar}
                className="lg:hidden flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] flex-shrink-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                aria-label={sidebarContext.sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
              >
                {sidebarContext.sidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            )}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 border-b-4 border-indigo-400 pb-2 inline-block">Paramètres</h1>
          </div>
        </div>
        
        {/* Ligne 2 : Description */}
        <p className="text-sm sm:text-base text-gray-600">Configuration et préférences de votre compte</p>
      </div>

      {/* Sections de paramètres */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {parametresSections.map((section) => (
          <Card 
            key={section.id} 
            className="hover:shadow-lg transition-all duration-200 group cursor-pointer relative"
            onClick={() => handleSectionClick(section)}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[section.color]}`}>
                  <section.icon className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-2">
                  {section.soon && (
                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                      Bientôt
                    </span>
                  )}
                  {section.external ? (
                    <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-lg mb-2 group-hover:text-indigo-600 transition-colors">
                {section.title}
              </CardTitle>
              <CardDescription className="text-sm">
                {section.description}
              </CardDescription>
            </CardContent>
            
            {section.soon && (
              <div className="absolute inset-0 bg-gray-50 bg-opacity-50 rounded-lg cursor-not-allowed" />
            )}
          </Card>
        ))}
      </div>

      {/* Informations supplémentaires */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Besoin d'aide ?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-blue-800 mb-4">
            Si vous ne trouvez pas le paramètre que vous cherchez, consultez la documentation ou contactez l'assistance.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-100">
              Documentation
            </Button>
            <Button variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-100">
              Contactez-nous
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
