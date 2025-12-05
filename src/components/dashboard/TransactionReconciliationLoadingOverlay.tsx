'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, FileText, Check, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';

interface TransactionReconciliationLoadingOverlayProps {
  isReconciling: boolean;
  totalTransactions?: number;
  transactionsProcessed?: number;
  currentTransaction?: string;
}

export function TransactionReconciliationLoadingOverlay({
  isReconciling,
  totalTransactions = 0,
  transactionsProcessed = 0,
  currentTransaction,
}: TransactionReconciliationLoadingOverlayProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  // Calculer la progression
  useEffect(() => {
    if (isReconciling && totalTransactions > 0) {
      const calculatedProgress = Math.min((transactionsProcessed / totalTransactions) * 100, 95);
      setAnimatedProgress((prev) => {
        if (calculatedProgress > prev) {
          return Math.min(prev + 2, calculatedProgress);
        }
        return prev;
      });
    } else if (!isReconciling) {
      setAnimatedProgress(100);
    }
  }, [isReconciling, totalTransactions, transactionsProcessed]);

  // Réinitialiser quand le rapprochement commence
  useEffect(() => {
    if (isReconciling) {
      setAnimatedProgress(0);
    }
  }, [isReconciling]);

  if (!isReconciling) return null;

  const progressPercent = Math.round(animatedProgress);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop avec blur */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-900/40 via-emerald-900/50 to-teal-900/40 backdrop-blur-md" />
      
      {/* Contenu centré */}
      <div className="relative z-10 w-full max-w-2xl px-4">
        <div className="relative overflow-hidden rounded-2xl bg-white/95 shadow-2xl backdrop-blur-xl border border-white/20">
          {/* Effet de brillance animé en haut */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-pulse" />
          
          {/* Contenu principal */}
          <div className="relative p-8">
            {/* Header avec icône */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="relative">
                {/* Icône check avec animation */}
                <div className="absolute inset-0 bg-green-400/20 rounded-full blur-xl animate-ping" />
                <div className="relative bg-gradient-to-br from-green-500 via-emerald-600 to-teal-600 p-4 rounded-2xl shadow-lg transform transition-transform duration-300 hover:scale-110">
                  <CheckCircle2 className="h-8 w-8 text-white animate-pulse" />
                </div>
                {/* Particules animées autour */}
                <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-yellow-400 animate-spin" style={{ animationDuration: '3s' }} />
                <FileText className="absolute -bottom-1 -left-1 h-3 w-3 text-green-400 animate-pulse" style={{ animationDelay: '1s' }} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  Rapprochement des transactions
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {totalTransactions > 0 
                    ? `Traitement de ${transactionsProcessed} sur ${totalTransactions} transaction${totalTransactions > 1 ? 's' : ''}...`
                    : 'Traitement en cours...'}
                </p>
              </div>
            </div>

            {/* Barre de progression */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progression</span>
                <span className="text-sm font-bold text-green-600">{progressPercent}%</span>
              </div>
              <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                {/* Fond avec gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-gray-200" />
                {/* Barre de progression animée */}
                <div
                  className={cn(
                    'absolute left-0 top-0 h-full bg-gradient-to-r from-green-500 via-emerald-600 to-teal-500 rounded-full transition-all duration-500 ease-out',
                    'shadow-lg shadow-green-500/50'
                  )}
                  style={{ width: `${animatedProgress}%` }}
                >
                  {/* Effet de brillance qui bouge */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </div>
              </div>
            </div>

            {/* Statistiques */}
            {totalTransactions > 0 && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center p-4 bg-green-50 rounded-xl border border-green-100">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-2xl font-bold text-green-600">{transactionsProcessed}</span>
                  </div>
                  <p className="text-xs text-gray-600">Transaction(s) rapprochée(s)</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span className="text-2xl font-bold text-blue-600">{totalTransactions}</span>
                  </div>
                  <p className="text-xs text-gray-600">Total à traiter</p>
                </div>
              </div>
            )}

            {/* Transaction en cours de traitement */}
            {currentTransaction && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Traitement en cours :</p>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm text-gray-800 font-medium">{currentTransaction}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Message d'encouragement */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500 italic">
                {progressPercent < 30 && "Début du rapprochement..."}
                {progressPercent >= 30 && progressPercent < 60 && "Rapprochement en cours..."}
                {progressPercent >= 60 && progressPercent < 90 && "Presque terminé..."}
                {progressPercent >= 90 && "Finalisation du rapprochement..."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}











