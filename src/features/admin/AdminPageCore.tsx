/**
 * Core Component pour la page Administration
 * 
 * Une seule source de vérité graphique utilisable en mode "normal" et "app-shell"
 * Toute la logique UI est centralisée ici.
 * 
 * Réplique EXACTEMENT le comportement de AdminPageClient.tsx
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Settings, FileText, MapPin, Users, Database, Shield, BarChart3, Archive, Search, Calculator } from 'lucide-react';
import toast from 'react-hot-toast';
import BackupManagementCard from '@/components/admin/BackupManagementCard';

export interface AdminPageCoreProps {
  mode: 'normal' | 'app-shell';
  enablePrismaStudio?: boolean;
}

export function AdminPageCore({ 
  mode,
  enablePrismaStudio = false 
}: AdminPageCoreProps) {
  const [isLaunchingStudio, setIsLaunchingStudio] = useState(false);

  const handleLaunchPrismaStudio = async () => {
    setIsLaunchingStudio(true);
    
    try {
      const response = await fetch('/api/admin/database/studio', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Prisma Studio est en cours de démarrage...');
        
        // Attendre 3 secondes puis ouvrir Prisma Studio dans un nouvel onglet
        setTimeout(() => {
          window.open('http://localhost:5555', '_blank');
        }, 3000);
      } else {
        toast.error(data.error || 'Erreur lors du lancement de Prisma Studio');
      }
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors de la communication avec le serveur');
    } finally {
      setTimeout(() => setIsLaunchingStudio(false), 4000);
    }
  };

  const adminModules = [
    { id: 'mapping', title: 'Gestion des Natures & Catégories', description: "Configuration des natures de transaction, catégories comptables et leur correspondance", icon: MapPin, color: 'primary' as const, category: 'system' },
    { id: 'document-types', title: 'Types de Documents', description: "Gestion des types de documents, règles d'auto-suggestion et métadonnées", icon: FileText, color: 'success' as const, category: 'system' },
    { id: 'signals-catalog', title: 'Catalogue des Signaux', description: 'Gestion du catalogue global des signaux pour la classification de documents', icon: Search, color: 'info' as const, category: 'system' },
    { id: 'fiscal-params', title: 'Paramètres Fiscaux', description: 'Gestion des barèmes fiscaux (IR, PS, micro-foncier, LMNP, PER, etc.)', icon: Calculator, color: 'primary' as const, category: 'system' },
    { id: 'gestion-deleguee-system', title: 'Paramètres Gestion Déléguée', description: 'Configuration système de la gestion déléguée (codes comptables, activation)', icon: Settings, color: 'warning' as const, category: 'gestion' },
    { id: 'users', title: 'Gestion des Utilisateurs', description: 'Administration des comptes utilisateurs et permissions', icon: Users, color: 'warning' as const, category: 'admin' },
    { id: 'database', title: 'Base de Données', description: 'Sauvegardes, migrations et maintenance de la base de données', icon: Database, color: 'danger' as const, category: 'admin' },
    { id: 'security', title: 'Sécurité & Audit', description: "Logs d'audit, sessions actives et paramètres de sécurité", icon: Shield, color: 'gray' as const, category: 'admin' },
    { id: 'analytics', title: 'Analytics & Rapports', description: 'Configuration des rapports automatiques et métriques de performance', icon: BarChart3, color: 'primary' as const, category: 'admin' },
  ];

  const colorClasses = { 
    primary: 'bg-primary-100 text-primary-600', 
    success: 'bg-success-100 text-success-600', 
    warning: 'bg-warning-100 text-warning-600', 
    danger: 'bg-danger-100 text-danger-600', 
    gray: 'bg-gray-100 text-gray-600',
    info: 'bg-blue-100 text-blue-600'
  } as const;

  const handleModuleClick = (module: typeof adminModules[0]) => {
    if (mode === 'app-shell') {
      // En mode app-shell, utiliser window.location pour la navigation
      if (module.id === 'mapping') window.location.href = '/admin/natures-categories';
      else if (module.id === 'document-types') window.location.href = '/admin/documents/types';
      else if (module.id === 'signals-catalog') window.location.href = '/admin/signals';
      else if (module.id === 'fiscal-params') window.location.href = '/admin/impots/parametres';
      else if (module.id === 'gestion-deleguee-system') window.location.href = '/parametres/gestion-deleguee';
      else if (module.id === 'users') window.location.href = '/admin/users';
    } else {
      // En mode normal, le onClick du Card gère la navigation
      if (module.id === 'mapping') window.location.href = '/admin/natures-categories';
      else if (module.id === 'document-types') window.location.href = '/admin/documents/types';
      else if (module.id === 'signals-catalog') window.location.href = '/admin/signals';
      else if (module.id === 'fiscal-params') window.location.href = '/admin/impots/parametres';
      else if (module.id === 'gestion-deleguee-system') window.location.href = '/parametres/gestion-deleguee';
      else if (module.id === 'users') window.location.href = '/admin/users';
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 items-center mb-6 gap-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 border-b-4 border-red-400 pb-2 inline-block">Administration</h1>
          <p className="text-gray-600 mt-2">Configuration et maintenance de l'application</p>
        </div>
        <div className="flex justify-center">
          <div className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-full border border-red-200">🔐 Accès Administrateur</div>
        </div>
        <div className="flex items-center gap-3 justify-end" />
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2"><Archive className="h-5 w-5 text-purple-600" />Sauvegarde & Restauration</h2>
        <div className="grid grid-cols-1 gap-6">
          <BackupManagementCard />
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2"><Settings className="h-5 w-5 text-blue-600" />Configuration Système</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminModules.filter(m => m.category === 'system').map((module) => (
            <Card key={module.id} className="hover:shadow-lg transition-all duration-200 cursor-pointer group" onClick={() => handleModuleClick(module)}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[module.color]}`}>
                    <module.icon className="h-6 w-6" />
                  </div>
                  <div className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-lg mb-2 group-hover:text-blue-600 transition-colors">{module.title}</CardTitle>
                <CardDescription className="text-sm">{module.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2"><Archive className="h-5 w-5 text-orange-600" />Gestion Déléguée Système</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminModules.filter(m => m.category === 'gestion').map((module) => (
            <Card key={module.id} className="hover:shadow-lg transition-all duration-200 cursor-pointer group" onClick={() => handleModuleClick(module)}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[module.color]}`}><module.icon className="h-6 w-6" /></div>
                  <div className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></div>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-lg mb-2 group-hover:text-orange-600 transition-colors">{module.title}</CardTitle>
                <CardDescription className="text-sm">{module.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2"><Shield className="h-5 w-5 text-red-600" />Administration Système</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminModules.filter(m => m.category === 'admin').map((module) => {
            // Carte Utilisateurs - toujours active
            if (module.id === 'users') {
              return (
                <Card key={module.id} className="hover:shadow-lg transition-all duration-200 cursor-pointer group" onClick={() => handleModuleClick(module)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[module.color]}`}><module.icon className="h-6 w-6" /></div>
                      <div className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-lg mb-2">{module.title}</CardTitle>
                    <CardDescription className="text-sm">{module.description}</CardDescription>
                  </CardContent>
                </Card>
              );
            }
            
            // Carte Base de Données - active uniquement si ENABLE_PRISMA_STUDIO=true dans .env.local
            if (module.id === 'database' && enablePrismaStudio) {
              return (
                <Card 
                  key={module.id} 
                  className={`hover:shadow-lg transition-all duration-200 cursor-pointer group ${isLaunchingStudio ? 'opacity-50' : ''}`} 
                  onClick={!isLaunchingStudio ? handleLaunchPrismaStudio : undefined}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[module.color]}`}>
                        <module.icon className="h-6 w-6" />
                      </div>
                      <div className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                        {isLaunchingStudio ? (
                          <>
                            <span className="animate-spin h-3 w-3 border-2 border-green-700 border-t-transparent rounded-full inline-block"></span>
                            Lancement...
                          </>
                        ) : (
                          '🚀 Dev'
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-lg mb-2 group-hover:text-red-600 transition-colors">{module.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {isLaunchingStudio ? 'Démarrage de Prisma Studio...' : 'Cliquez pour ouvrir Prisma Studio'}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            }
            
            // Autres cartes - inactives
            return (
              <Card key={module.id} className="hover:shadow-lg transition-all duration-200 cursor-not-allowed group relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClasses[module.color]}`}><module.icon className="h-6 w-6" /></div>
                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Bientôt</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-lg mb-2">{module.title}</CardTitle>
                  <CardDescription className="text-sm">{module.description}</CardDescription>
                </CardContent>
                <div className="absolute inset-0 bg-gray-50/50 rounded-lg" />
              </Card>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actions Rapides</CardTitle>
          <CardDescription>Opérations courantes d'administration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2"><Database className="h-6 w-6" /><span className="text-sm">Sauvegarde</span></Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2"><BarChart3 className="h-6 w-6" /><span className="text-sm">Rapport</span></Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2"><Archive className="h-6 w-6" /><span className="text-sm">Archives</span></Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2"><Settings className="h-6 w-6" /><span className="text-sm">Paramètres</span></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
