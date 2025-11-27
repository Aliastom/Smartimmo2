'use client';

import React, { useState, useEffect } from 'react';
import { Home, TrendingUp, Building2, FileText, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';

interface FiscalLoadingOverlayProps {
  isLoading: boolean;
  totalBiens?: number;
  biensProcessed?: number;
  currentBien?: string;
  estimatedTime?: number; // en secondes
}

export function FiscalLoadingOverlay({
  isLoading,
  totalBiens = 0,
  biensProcessed = 0,
  currentBien,
  estimatedTime,
}: FiscalLoadingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [animatedBiens, setAnimatedBiens] = useState<string[]>([]);

  // Calculer la progression
  useEffect(() => {
    if (isLoading && totalBiens > 0) {
      const calculatedProgress = Math.min((biensProcessed / totalBiens) * 100, 100);
      setProgress(calculatedProgress);
    } else if (!isLoading) {
      // ✅ Mettre à 100 seulement si on vient de terminer (pas si déjà à 100)
      setProgress((prev) => prev < 100 ? 100 : prev);
    }
  }, [isLoading, totalBiens, biensProcessed]);

  // Animer les biens traités
  useEffect(() => {
    if (currentBien && !animatedBiens.includes(currentBien)) {
      setAnimatedBiens((prev) => [...prev, currentBien]);
    }
  }, [currentBien, animatedBiens]);

  // Réinitialiser quand le chargement commence
  useEffect(() => {
    if (isLoading) {
      setAnimatedBiens([]);
      // ✅ Ne réinitialiser la progression que si on commence un nouveau chargement
      // (pas si isLoading passe de false à true rapidement)
      setProgress((prev) => prev > 0 ? 0 : prev);
    }
  }, [isLoading]);

  if (!isLoading) return null;

  const progressPercent = Math.round(progress);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop avec blur */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/40 via-slate-800/50 to-slate-900/40 backdrop-blur-md" />
      
      {/* Contenu centré */}
      <div className="relative z-10 w-full max-w-2xl px-4">
        <div className="relative overflow-hidden rounded-2xl bg-white/95 shadow-2xl backdrop-blur-xl border border-white/20">
          {/* Effet de brillance animé en haut */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse" />
          
          {/* Contenu principal */}
          <div className="relative p-8">
            {/* Header avec icône */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="relative">
                {/* Icône maison avec animation */}
                <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-xl animate-ping" />
                <div className="relative bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-2xl shadow-lg transform transition-transform duration-300 hover:scale-110">
                  <Home className="h-8 w-8 text-white" />
                </div>
                {/* Particules animées autour */}
                <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-yellow-400 animate-spin" style={{ animationDuration: '3s' }} />
                <Sparkles className="absolute -bottom-1 -left-1 h-3 w-3 text-blue-400 animate-pulse" style={{ animationDelay: '1s' }} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  Chargement des données SmartImmo
                  <Building2 className="h-5 w-5 text-blue-500" />
                </h3>
                <p className="text-sm text-gray-600 mt-1">Analyse de vos biens immobiliers...</p>
              </div>
            </div>

            {/* Barre de progression */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progression</span>
                <span className="text-sm font-bold text-blue-600">{progressPercent}%</span>
              </div>
              <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                {/* Fond avec gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-gray-200" />
                {/* Barre de progression animée */}
                <div
                  className={cn(
                    'absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 rounded-full transition-all duration-500 ease-out',
                    'shadow-lg shadow-blue-500/50'
                  )}
                  style={{ width: `${progress}%` }}
                >
                  {/* Effet de brillance qui bouge */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </div>
              </div>
            </div>

            {/* Statistiques */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span className="text-2xl font-bold text-blue-600">{biensProcessed}</span>
                </div>
                <p className="text-xs text-gray-600">Bien(s) analysé(s)</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="text-2xl font-bold text-green-600">{totalBiens}</span>
                </div>
                <p className="text-xs text-gray-600">Total à traiter</p>
              </div>
              {estimatedTime && (
                <div className="text-center p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="text-2xl font-bold text-purple-600">{Math.ceil(estimatedTime)}</span>
                  </div>
                  <p className="text-xs text-gray-600">Secondes restantes</p>
                </div>
              )}
            </div>

            {/* Liste des biens en cours de traitement */}
            {currentBien && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Traitement en cours :</p>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-sm text-gray-800 font-medium">{currentBien}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Liste des biens déjà traités */}
            {animatedBiens.length > 0 && (
              <div className="max-h-32 overflow-y-auto">
                <p className="text-sm font-medium text-gray-700 mb-2">Bien(s) traité(s) :</p>
                <div className="space-y-1">
                  {animatedBiens.slice(-5).map((bien, index) => (
                    <div
                      key={bien}
                      className="flex items-center gap-2 text-sm text-gray-600 bg-green-50 rounded-lg p-2 border border-green-100 animate-fadeIn"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="h-1.5 w-1.5 bg-green-500 rounded-full" />
                      <span>{bien}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Message d'encouragement */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500 italic">
                {progressPercent < 30 && "Récupération des données de vos biens..."}
                {progressPercent >= 30 && progressPercent < 60 && "Analyse des transactions..."}
                {progressPercent >= 60 && progressPercent < 90 && "Calcul des charges et loyers..."}
                {progressPercent >= 90 && "Finalisation en cours..."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

