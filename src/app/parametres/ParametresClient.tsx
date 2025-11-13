'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Palette, 
  User, 
  Settings2, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function ParametresClient() {
  const parametresSections = [
    {
      id: 'gestion-societes',
      title: 'Gestion des Sociétés',
      description: 'Ajoutez et gérez vos sociétés de gestion déléguée',
      icon: Building2,
      href: '/gestion-deleguee',
      color: 'emerald' as const
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
      href: '/profil',
      color: 'blue' as const,
      external: true
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

  return (
    <div className="space-y-6">
      {/* Header avec ligne d'accent - même style que les pages de biens */}
      <div className="grid grid-cols-3 items-center mb-6 gap-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 border-b-4 border-indigo-400 pb-2 inline-block">Paramètres</h1>
          <p className="text-gray-600 mt-2">Configuration et préférences de votre compte</p>
        </div>
        
        <div className="flex justify-center">
          {/* Espace pour éventuellement ajouter le menu glassmorphism plus tard */}
        </div>
        
        <div className="flex items-center gap-3 justify-end">
          {/* Espace pour éventuels boutons d'action */}
        </div>
      </div>

      {/* Sections de paramètres */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {parametresSections.map((section) => (
          <Card 
            key={section.id} 
            className="hover:shadow-lg transition-all duration-200 group cursor-pointer relative"
            onClick={() => {
              if (section.soon) return;
              if (section.external) {
                window.open(section.href, '_blank');
              } else {
                window.location.href = section.href;
              }
            }}
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
