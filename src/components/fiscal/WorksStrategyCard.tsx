/**
 * WorksStrategyCard - Carte de stratégie travaux (Phase 1 & 2)
 * 
 * Affiche les deux phases d'optimisation des travaux
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Wrench, Target, AlertCircle, TrendingUp } from 'lucide-react';
import type { WorksStrategy } from '@/types/fiscal';
import { cn } from '@/lib/utils';

interface WorksStrategyCardProps {
  strategy: WorksStrategy;
  className?: string;
}

export function WorksStrategyCard({
  strategy,
  className,
}: WorksStrategyCardProps) {
  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  
  const formatPercent = (ratio: number) => `${(ratio * 100).toFixed(0)}%`;
  
  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-orange-600" />
          Stratégie d'optimisation par les travaux
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* ========== PHASE 1 ========== */}
        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-green-900 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Phase 1
            </h4>
            <Badge variant="default" className="bg-green-600">
              Prioritaire
            </Badge>
          </div>
          
          <p className="text-sm text-green-800 mb-4 font-medium">
            {strategy.phase1.objectif}
          </p>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-green-700">Montant de travaux :</span>
              <span className="font-bold text-green-900">
                {formatEuro(strategy.phase1.montantCible)}
              </span>
            </div>
            
            <div className="bg-white/60 p-3 rounded space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Économie IR :</span>
                <span className="font-semibold text-green-600">
                  {formatEuro(strategy.phase1.economieIR)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Économie PS :</span>
                <span className="font-semibold text-green-600">
                  {formatEuro(strategy.phase1.economiePS)}
                </span>
              </div>
              <div className="flex justify-between font-bold border-t pt-1 mt-1">
                <span className="text-gray-900">Total économisé :</span>
                <span className="text-green-600">
                  {formatEuro(strategy.phase1.economieTotal)}
                </span>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-green-700">Ratio € économisé / € investi :</span>
                <span className="font-bold text-green-900">
                  {formatPercent(strategy.phase1.ratioEconomieSurInvest)}
                </span>
              </div>
              <Progress
                value={Math.min(strategy.phase1.ratioEconomieSurInvest * 100, 100)}
                className="h-3"
              />
              <p className="text-xs text-green-700 mt-1">
                Pour chaque 100€ investis, vous économisez{' '}
                {formatEuro(strategy.phase1.ratioEconomieSurInvest * 100)} d'impôts
              </p>
            </div>
          </div>
        </div>
        
        {/* ========== PHASE 2 ========== */}
        <div className="p-4 bg-gradient-to-br from-blue-50 to-sky-50 rounded-lg border-2 border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-blue-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Phase 2
            </h4>
            <Badge variant="secondary">
              Optionnelle
            </Badge>
          </div>
          
          <p className="text-sm text-blue-800 mb-4 font-medium">
            {strategy.phase2.objectif}
          </p>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-blue-700">Montant de travaux :</span>
              <span className="font-bold text-blue-900">
                {formatEuro(strategy.phase2.montantCible)}
              </span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-blue-700">Déficit créé :</span>
              <span className="font-bold text-blue-900">
                {formatEuro(strategy.phase2.deficitCree)}
              </span>
            </div>
            
            <div className="bg-white/60 p-3 rounded space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Économie IR :</span>
                <span className="font-semibold text-green-600">
                  {formatEuro(strategy.phase2.economieIR)}
                </span>
              </div>
              <div className="flex justify-between font-bold border-t pt-1 mt-1">
                <span className="text-gray-900">Total économisé :</span>
                <span className="text-green-600">
                  {formatEuro(strategy.phase2.economieTotal)}
                </span>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-blue-700">Ratio € économisé / € investi :</span>
                <span className="font-bold text-blue-900">
                  {formatPercent(strategy.phase2.ratioEconomieSurInvest)}
                </span>
              </div>
              <Progress
                value={Math.min(strategy.phase2.ratioEconomieSurInvest * 100, 100)}
                className="h-3"
              />
            </div>
            
            <Alert variant="default" className="bg-orange-50 border-orange-200">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-xs text-orange-800">
                {strategy.phase2.avertissement}
              </AlertDescription>
            </Alert>
          </div>
        </div>
        
        {/* ========== RECOMMANDATION GLOBALE ========== */}
        <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
          <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Recommandation
          </h4>
          <p className="text-sm text-purple-800 mb-3">{strategy.recommandation}</p>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white/60 p-2 rounded">
              <p className="text-gray-600 text-xs">Total investissement</p>
              <p className="font-bold text-gray-900">
                {formatEuro(strategy.totalInvestissement)}
              </p>
            </div>
            <div className="bg-white/60 p-2 rounded">
              <p className="text-gray-600 text-xs">Total économie</p>
              <p className="font-bold text-green-600">
                {formatEuro(strategy.totalEconomie)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

