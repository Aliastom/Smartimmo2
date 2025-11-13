'use client';

import React, { useState } from 'react';
import { 
  SmartLink, 
  NavLink, 
  CardLink, 
  ListLink, 
  ActionLink,
  useImmediateRouteProgress,
  useViewTransitionNav,
  useCardNavigation,
  useRouteProgressContext
} from '@/components/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Home, ArrowRight, Zap, MousePointer } from 'lucide-react';

/**
 * Composant de démonstration pour tester le feedback immédiat de navigation
 * et toutes les améliorations selon la règle de correction
 */
export function NavigationFeedbackExamples() {
  const [clickCount, setClickCount] = useState(0);
  
  // Hook pour feedback immédiat
  const { isActive, progress, onPointerDown } = useImmediateRouteProgress({
    delay: 50,
    maxDuration: 3000
  });

  // Hook pour navigation avec transitions
  const { navigate, supportsViewTransition } = useViewTransitionNav();
  const { navigate: cardNavigate } = useCardNavigation();

  // Contexte de progression global
  const routeProgress = useRouteProgressContext();

  const handleTestNavigation = async (href: string, useTransition = false) => {
    try {
      if (useTransition) {
        await cardNavigate(href);
      } else {
        await navigate(href);
      }
    } catch (error) {
      console.warn('Navigation test failed:', error);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Tests Navigation Instantanée - Smartimmo
        </h1>
        <p className="text-gray-600">
          Démonstration du feedback immédiat dès pointerdown et des transitions fluides
        </p>
        
        {/* État global */}
        <div className="mt-4 flex justify-center gap-4 text-sm">
          <span className={`px-3 py-1 rounded-full ${routeProgress.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
            {routeProgress.isActive ? 'Navigation active' : 'Navigation inactive'}
          </span>
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800">
            View Transitions: {supportsViewTransition ? 'Supportées' : 'Non supportées'}
          </span>
        </div>
      </div>

      {/* Section 1: SmartLinks variants */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          1. Composants SmartLink
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* SmartLink standard */}
          <Card className="card-tactile">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">SmartLink Standard</CardTitle>
            </CardHeader>
            <CardContent>
              <SmartLink 
                href="/dashboard" 
                className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <Home className="w-4 h-4" />
                Vers Dashboard
                <ArrowRight className="w-4 h-4 ml-auto" />
              </SmartLink>
            </CardContent>
          </Card>

          {/* NavLink */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">NavLink</CardTitle>
            </CardHeader>
            <CardContent>
              <NavLink 
                href="/transactions" 
                className="nav-tactile flex items-center gap-2 p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors"
              >
                Transactions
                <ArrowRight className="w-4 h-4 ml-auto" />
              </NavLink>
            </CardContent>
          </Card>

          {/* CardLink */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">CardLink</CardTitle>
            </CardHeader>
            <CardContent>
              <CardLink 
                href="/documents" 
                className="card-tactile block p-4 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors text-center"
              >
                <div className="font-medium">Documents</div>
                <div className="text-sm text-gray-600 mt-1">Prefetch rapide</div>
              </CardLink>
            </CardContent>
          </Card>

          {/* ActionLink */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">ActionLink</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionLink 
                href="/baux" 
                className="btn-tactile flex items-center gap-2 p-3 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors"
              >
                <MousePointer className="w-4 h-4" />
                Baux (Action)
              </ActionLink>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Section 2: Tests interactifs */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold">2. Tests Interactifs</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hook de feedback immédiat */}
          <Card>
            <CardHeader>
              <CardTitle>Hook useImmediateRouteProgress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span>État :</span>
                <span className={`px-2 py-1 text-xs rounded ${isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                  {isActive ? 'Actif' : 'Inactif'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span>Progression :</span>
                <span className="text-sm font-mono">{Math.round(progress)}%</span>
              </div>

              {isActive && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              <button
                className="btn btn-primary w-full"
                onPointerDown={onPointerDown}
                onClick={() => setClickCount(c => c + 1)}
              >
                Test Feedback (Clics: {clickCount})
              </button>
            </CardContent>
          </Card>

          {/* Navigation avec transitions */}
          <Card>
            <CardHeader>
              <CardTitle>Navigation avec Transitions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                {supportsViewTransition 
                  ? 'Votre navigateur supporte les View Transitions!'
                  : 'View Transitions non supportées, fallback actif.'
                }
              </p>

              <div className="space-y-2">
                <button
                  className="btn btn-outline w-full"
                  onClick={() => handleTestNavigation('/dashboard')}
                >
                  Navigation Standard
                </button>
                
                <button
                  className="btn btn-primary w-full"
                  onClick={() => handleTestNavigation('/biens', true)}
                >
                  Navigation avec Transition Card
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Section 3: Liste de liens pour tests */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold">3. Liste de Test</h2>
        
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { href: '/dashboard', label: 'Dashboard', color: 'blue' },
                { href: '/biens', label: 'Biens', color: 'green' },
                { href: '/transactions', label: 'Transactions', color: 'purple' },
                { href: '/documents', label: 'Documents', color: 'orange' },
                { href: '/baux', label: 'Baux', color: 'red' },
                { href: '/settings', label: 'Paramètres', color: 'gray' }
              ].map(({ href, label, color }) => (
                <ListLink
                  key={href}
                  href={href}
                  className={`flex items-center justify-between p-4 rounded-lg bg-${color}-50 hover:bg-${color}-100 transition-colors`}
                >
                  <span className="font-medium">{label}</span>
                  <ArrowRight className="w-4 h-4" />
                </ListLink>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 4: Informations techniques */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">4. Informations Techniques</h2>
        
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <h3 className="font-medium mb-2">Feedback Timing</h3>
                <ul className="space-y-1 text-gray-600">
                  <li>• 0-80ms : Feedback visuel immédiat</li>
                  <li>• 80-300ms : Barre top + prefetch</li>
                  <li>• 300-2s : Skeletons locaux</li>
                  <li>• >2s : RouteProgress + micro-texte</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Features Actives</h3>
                <ul className="space-y-1 text-gray-600">
                  <li>• ✅ Prefetch proactif au hover</li>
                  <li>• ✅ Vibration tactile (mobile)</li>
                  <li>• ✅ View Transitions API</li>
                  <li>• ✅ Micro-interactions CSS</li>
                  <li>• ✅ Support prefers-reduced-motion</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
