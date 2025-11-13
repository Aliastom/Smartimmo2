/**
 * OptimizationComparisonCard - Carte de comparaison des stratégies d'optimisation
 * 
 * Compare PER, Travaux, et stratégie combinée
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Wrench, PiggyBank, Sparkles } from 'lucide-react';
import type { OptimizationComparison } from '@/types/fiscal';
import { cn } from '@/lib/utils';

interface OptimizationComparisonCardProps {
  comparison: OptimizationComparison;
  className?: string;
}

export function OptimizationComparisonCard({
  comparison,
  className,
}: OptimizationComparisonCardProps) {
  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  
  const formatPercent = (ratio: number) => `${(ratio * 100).toFixed(0)}%`;
  
  const maxRatio = Math.max(
    comparison.per.ratio,
    comparison.travaux.ratio,
    comparison.combine.ratio
  );
  
  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-600" />
          Comparaison des stratégies
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* ========== STRATÉGIE PER ========== */}
        <div className={cn(
          'p-4 rounded-lg border-2 transition-all',
          comparison.strategyRecommendation === 'per'
            ? 'border-green-500 bg-green-50'
            : 'border-gray-200 bg-gray-50'
        )}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold">Plan Épargne Retraite</h4>
            </div>
            {comparison.strategyRecommendation === 'per' && (
              <Badge variant="success" className="bg-green-600">
                Recommandé
              </Badge>
            )}
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Investissement :</span>
              <span className="font-medium">{formatEuro(comparison.per.investissement)}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Économie fiscale :</span>
              <span className="font-semibold text-green-600">
                {formatEuro(comparison.per.economie)}
              </span>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Ratio € économisé / € investi :</span>
                <span className="font-bold">{formatPercent(comparison.per.ratio)}</span>
              </div>
              <Progress
                value={(comparison.per.ratio / maxRatio) * 100}
                className="h-2"
              />
            </div>
            
            <p className="text-xs text-gray-500 italic mt-2">
              {comparison.per.disponibilite}
            </p>
          </div>
        </div>
        
        {/* ========== STRATÉGIE TRAVAUX ========== */}
        <div className={cn(
          'p-4 rounded-lg border-2 transition-all',
          comparison.strategyRecommendation === 'travaux'
            ? 'border-green-500 bg-green-50'
            : 'border-gray-200 bg-gray-50'
        )}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-orange-600" />
              <h4 className="font-semibold">Travaux déductibles</h4>
            </div>
            {comparison.strategyRecommendation === 'travaux' && (
              <Badge variant="success" className="bg-green-600">
                Recommandé
              </Badge>
            )}
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Investissement :</span>
              <span className="font-medium">{formatEuro(comparison.travaux.investissement)}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Économie fiscale :</span>
              <span className="font-semibold text-green-600">
                {formatEuro(comparison.travaux.economie)}
              </span>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Ratio € économisé / € investi :</span>
                <span className="font-bold">{formatPercent(comparison.travaux.ratio)}</span>
              </div>
              <Progress
                value={(comparison.travaux.ratio / maxRatio) * 100}
                className="h-2"
              />
            </div>
            
            <p className="text-xs text-gray-500 italic mt-2">
              {comparison.travaux.disponibilite}
            </p>
          </div>
        </div>
        
        {/* ========== STRATÉGIE COMBINÉE ========== */}
        <div className={cn(
          'p-4 rounded-lg border-2 transition-all',
          comparison.strategyRecommendation === 'combine'
            ? 'border-green-500 bg-green-50'
            : 'border-gray-200 bg-gray-50'
        )}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <h4 className="font-semibold">Stratégie combinée</h4>
            </div>
            {comparison.strategyRecommendation === 'combine' && (
              <Badge variant="success" className="bg-green-600">
                Recommandé
              </Badge>
            )}
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Investissement total :</span>
              <span className="font-medium">{formatEuro(comparison.combine.investissement)}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Économie fiscale totale :</span>
              <span className="font-semibold text-green-600">
                {formatEuro(comparison.combine.economie)}
              </span>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Ratio global :</span>
                <span className="font-bold">{formatPercent(comparison.combine.ratio)}</span>
              </div>
              <Progress
                value={(comparison.combine.ratio / maxRatio) * 100}
                className="h-2"
              />
            </div>
          </div>
        </div>
        
        {/* ========== RECOMMANDATION ========== */}
        <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Recommandation
          </h4>
          <p className="text-sm text-blue-800">{comparison.reasoning}</p>
        </div>
      </CardContent>
    </Card>
  );
}

