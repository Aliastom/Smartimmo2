/**
 * ProjectionsTab - Projections annuelles (copie EXACTE de ProjectionDetailModal)
 * 
 * Adapté depuis ProjectionDetailModal pour affichage inline
 */

'use client';

import { useState } from 'react';
import { BlockCard } from '../BlockCard';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Calendar, Building, TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';

interface ProjectionsTabProps {
  biens: any[];
  year: number;
}

export function ProjectionsTab({ biens, year }: ProjectionsTabProps) {
  const today = new Date();
  const currentMonth = today.getMonth(); // 0-11
  const currentYear = today.getFullYear();
  
  const [selectedYear, setSelectedYear] = useState(year);
  
  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  
  // ✅ Calculer les données pour l'année sélectionnée (SIMPLE)
  const calculateDataForYear = () => {
    // Si on est sur l'année en cours
    if (selectedYear === currentYear) {
      const passeMois = currentMonth + 1; // Mois écoulés (0-11 → 1-12)
      const projectionMois = 12 - passeMois; // Mois restants
      
      return {
        passeMois,
        projectionMois,
        isHistorical: false,
        label: `Année ${selectedYear} (${passeMois} mois réalisés + ${projectionMois} mois projetés)`,
      };
    } 
    // Si on est sur une année future
    else if (selectedYear > currentYear) {
      return {
        passeMois: 0,
        projectionMois: 12, // Toute l'année en projection
        isHistorical: false,
        label: `Année ${selectedYear} (100% projection)`,
      };
    }
    // Si on est sur une année passée
    else {
      return {
        passeMois: 12,
        projectionMois: 0,
        isHistorical: true,
        label: `Année ${selectedYear} (100% réalisé)`,
      };
    }
  };
  
  const { passeMois, projectionMois, isHistorical, label } = calculateDataForYear();
  
  // ✅ Recalculer les données pour l'année sélectionnée (IDENTIQUE À LA MODAL)
  const recalculateDataForYear = (bien: any) => {
    if (!bien.breakdown) {
      return {
        passe: { recettes: 0, charges: 0, interets: 0 },
        projection: { recettes: 0, charges: 0, interets: 0 },
        total: { recettes: 0, charges: 0, interets: 0 },
      };
    }
    
    const bd = bien.breakdown;
    
    // ✅ ANNÉE EN COURS : données réelles + projection
    if (selectedYear === currentYear) {
      return {
        passe: {
          recettes: bd.passe.recettes,
          charges: bd.passe.chargesDeductibles,
          interets: bd.passe.interetsEmprunt,
        },
        projection: {
          recettes: bd.projection.loyersFuturs,
          charges: bd.projection.chargesFutures,
          interets: bd.projection.interetsEmpruntFuturs,
        },
        total: {
          recettes: bd.total.recettes,
          charges: bd.total.chargesDeductibles,
          interets: bd.total.interetsEmprunt,
        },
      };
    }
    // ✅ ANNÉE FUTURE : TOUT EN PROJECTION (multiplier par 12)
    else if (selectedYear > currentYear) {
      const moisRestantsInitiaux = bd.projection.moisRestants || 1;
      
      // Loyers mensuels → annualiser
      const loyerMensuel = bd.projection.loyersFuturs / moisRestantsInitiaux;
      const recettesAnnee = loyerMensuel * 12;
      
      // Intérêts mensuels → annualiser
      const interetsMensuels = bd.projection.interetsEmpruntFuturs / moisRestantsInitiaux;
      const interetsAnnee = interetsMensuels * 12;
      
      // Charges : séparer mensuelles et annuelles
      const chargesMensuelles = bd.projection.chargesMensuelles || 0;
      const chargesAnnuelles = bd.projection.chargesAnnuelles || 0;
      const chargesMensuellesAnnee = (chargesMensuelles / moisRestantsInitiaux) * 12;
      const chargesAnnee = chargesMensuellesAnnee + chargesAnnuelles;
      
      return {
        passe: { recettes: 0, charges: 0, interets: 0 },
        projection: {
          recettes: recettesAnnee,
          charges: chargesAnnee,
          interets: interetsAnnee,
        },
        total: {
          recettes: recettesAnnee,
          charges: chargesAnnee,
          interets: interetsAnnee,
        },
      };
    }
    // ✅ ANNÉE PASSÉE : Tout en historique
    else {
      return {
        passe: {
          recettes: bd.total.recettes,
          charges: bd.total.chargesDeductibles,
          interets: bd.total.interetsEmprunt,
        },
        projection: { recettes: 0, charges: 0, interets: 0 },
        total: {
          recettes: bd.total.recettes,
          charges: bd.total.chargesDeductibles,
          interets: bd.total.interetsEmprunt,
        },
      };
    }
  };
  
  // ✅ Calculer les totaux globaux
  const totaux = biens.reduce(
    (acc, bien) => {
      const data = recalculateDataForYear(bien);
      
      acc.passe.recettes += data.passe.recettes;
      acc.passe.charges += data.passe.charges;
      acc.passe.interets += data.passe.interets;
      
      acc.projection.recettes += data.projection.recettes;
      acc.projection.charges += data.projection.charges;
      acc.projection.interets += data.projection.interets;
      
      acc.total.recettes += data.total.recettes;
      acc.total.charges += data.total.charges;
      acc.total.interets += data.total.interets;
      
      return acc;
    },
    {
      passe: { recettes: 0, charges: 0, interets: 0 },
      projection: { recettes: 0, charges: 0, interets: 0 },
      total: { recettes: 0, charges: 0, interets: 0 },
    }
  );
  
  const totalPasse = totaux.passe.recettes - totaux.passe.charges - totaux.passe.interets;
  const totalProjection = totaux.projection.recettes - totaux.projection.charges - totaux.projection.interets;
  const totalAnnuel = totaux.total.recettes - totaux.total.charges - totaux.total.interets;
  
  return (
    <div className="space-y-6 p-6">
      {/* Titre et sous-titre */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Projections annuelles
        </h2>
        <p className="text-gray-600">
          Visualisez vos données réalisées et projetées pour anticiper votre fiscalité
        </p>
      </div>

      {/* Sélecteur d'année */}
      <Card 
        className="border-indigo-200 rounded-xl"
        style={{ 
          background: 'linear-gradient(135deg, #EFF6FF 0%, #E0E7FF 100%)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
        }}
      >
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-600" />
                Année fiscale
              </h3>
              <p className="text-xs text-indigo-700 mt-0.5">{label}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-4 py-2 border border-indigo-300 rounded-lg text-sm font-medium text-indigo-900 bg-white hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
              >
                <option value={currentYear}>{currentYear} (en cours)</option>
                <option value={currentYear + 1}>{currentYear + 1} (projection)</option>
              </select>
              
              <Badge 
                className={selectedYear === currentYear 
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300' 
                  : 'bg-indigo-100 text-indigo-700 border-indigo-300'
                }
              >
                {selectedYear === currentYear ? '📊 Réalisé + Projeté' : '🔮 100% Simulé'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Résumé global */}
      <Card 
        className="border-purple-200 rounded-xl"
        style={{ 
          background: 'linear-gradient(135deg, #F6F8FF 0%, #F3EFFF 100%)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
        }}
      >
        <CardContent className="p-5">
          <h3 className="text-base font-semibold text-purple-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            Résumé global
          </h3>
          <div className="grid grid-cols-3 gap-6">
            {passeMois > 0 && (
              <div>
                <p className="text-xs font-medium text-emerald-700 mb-2">Passé (réalisé)</p>
                <p className={`text-xl font-bold ${totalPasse >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>
                  {formatEuro(totalPasse)}
                </p>
                <p className="text-xs text-emerald-600 mt-2">
                  {formatEuro(totaux.passe.recettes)} - {formatEuro(totaux.passe.charges + totaux.passe.interets)}
                </p>
              </div>
            )}
            
            {projectionMois > 0 && (
              <div>
                <p className="text-xs font-medium text-purple-700 mb-2">
                  Projection ({projectionMois} mois)
                </p>
                <p className={`text-xl font-bold ${totalProjection >= 0 ? 'text-purple-900' : 'text-red-900'}`}>
                  {formatEuro(totalProjection)}
                </p>
                <p className="text-xs text-purple-600 mt-2">
                  {formatEuro(totaux.projection.recettes)} - {formatEuro(totaux.projection.charges + totaux.projection.interets)}
                </p>
              </div>
            )}
            
            <div>
              <p className="text-xs font-medium text-indigo-700 mb-2">Total annuel</p>
              <p className={`text-xl font-bold ${totalAnnuel >= 0 ? 'text-indigo-900' : 'text-red-900'}`}>
                {formatEuro(totalAnnuel)}
              </p>
              <p className="text-xs text-indigo-600 mt-2">
                {formatEuro(totaux.total.recettes)} - {formatEuro(totaux.total.charges + totaux.total.interets)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Détail par bien */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Building className="h-4 w-4 text-gray-600" />
          Détail par bien
        </h3>
        
        {biens.map((bien, i) => {
          if (!bien.breakdown) return null;
          
          const data = recalculateDataForYear(bien);
          const totalBien = data.total.recettes - data.total.charges - data.total.interets;
          
          return (
            <Card
              key={i}
              className={`border-l-4 rounded-xl ${totalBien >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}
              style={{
                backgroundColor: totalBien >= 0 ? '#E8F6EE' : '#FFEBEB',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Building className={`h-5 w-5 ${totalBien >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} />
                    <h4 className="font-semibold text-gray-900">{bien.nom}</h4>
                  </div>
                  <Badge
                    className={`${totalBien >= 0 ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}`}
                  >
                    {formatEuro(totalBien)} {bien.type}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Passé */}
                  {passeMois > 0 && (
                    <Card className="bg-white/50 border-gray-200">
                      <CardContent className="p-3">
                        <p className="text-xs text-emerald-700 font-medium mb-2">Passé (réalisé)</p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Recettes</span>
                            <span className="font-semibold text-emerald-700">{formatEuro(data.passe.recettes)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Charges</span>
                            <span className="font-semibold text-rose-700">-{formatEuro(data.passe.charges)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Intérêts</span>
                            <span className="font-semibold text-orange-700">-{formatEuro(data.passe.interets)}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-gray-200 font-semibold">
                            <span>Sous-total</span>
                            <span className={data.passe.recettes - data.passe.charges - data.passe.interets >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                              {formatEuro(data.passe.recettes - data.passe.charges - data.passe.interets)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Projection */}
                  {projectionMois > 0 && (
                    <Card className="bg-white/50 border-gray-200">
                      <CardContent className="p-3">
                        <p className="text-xs text-purple-700 font-medium mb-2">
                          Projection ({projectionMois} mois)
                        </p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Loyers futurs</span>
                            <span className="font-semibold text-purple-700">{formatEuro(data.projection.recettes)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Charges</span>
                            <span className="font-semibold text-rose-700">-{formatEuro(data.projection.charges)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Intérêts</span>
                            <span className="font-semibold text-orange-700">-{formatEuro(data.projection.interets)}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-gray-200 font-semibold">
                            <span>Sous-total</span>
                            <span className={data.projection.recettes - data.projection.charges - data.projection.interets >= 0 ? 'text-purple-700' : 'text-rose-700'}>
                              {formatEuro(data.projection.recettes - data.projection.charges - data.projection.interets)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Total */}
                  <Card className="bg-white/50 border-gray-200">
                    <CardContent className="p-3">
                      <p className="text-xs text-indigo-700 font-medium mb-2">Total annuel</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Recettes</span>
                          <span className="font-semibold text-indigo-700">{formatEuro(data.total.recettes)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Charges</span>
                          <span className="font-semibold text-rose-700">-{formatEuro(data.total.charges)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Intérêts</span>
                          <span className="font-semibold text-orange-700">-{formatEuro(data.total.interets)}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-gray-200 font-semibold">
                          <span>TOTAL</span>
                          <span className={totalBien >= 0 ? 'text-indigo-700' : 'text-rose-700'}>
                            {formatEuro(totalBien)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Méthodologie */}
      <BlockCard
        title="📘 Méthodologie"
        icon={<HelpCircle className="h-5 w-5 text-blue-600" />}
        collapsible
        defaultCollapsed={true}
      >
        <div className="space-y-2 text-xs text-gray-700">
          <div>
            <p className="font-semibold text-gray-900">Passé (réalisé)</p>
            <p className="ml-3">Données issues des <strong>transactions</strong> du 1er janvier à aujourd'hui</p>
            <ul className="ml-6 mt-1 space-y-0.5">
              <li>• <strong>Recettes</strong> : Transactions avec nature de type "RECETTE" (défini dans codes système)</li>
              <li>• <strong>Charges</strong> : Transactions avec nature de type "DEPENSE" ET catégorie "déductible"</li>
              <li>• <strong>Commission d'agence</strong> : Déjà incluse dans les charges (nature = code système de gestion)</li>
              <li>• <strong>Intérêts emprunt</strong> : Calculés depuis les prêts actifs (CRD actuel × taux mensuel)</li>
            </ul>
          </div>
          
          <div className="pt-2 border-t border-gray-300">
            <p className="font-semibold text-gray-900">Projection (reste de l'année)</p>
            <p className="ml-3">Estimation basée sur les données prévisionnelles</p>
            <ul className="ml-6 mt-1 space-y-0.5">
              <li>• <strong>Loyers futurs</strong> : 
                <span className="ml-1">Montant du bail (loyer HC + charges récup) × mois restants</span>
                <span className="block ml-3 text-gray-600 italic">(ou moyenne des transactions si pas de bail actif)</span>
              </li>
              <li>• <strong>Charges futures</strong> : 
                <span className="ml-1">Échéances planifiées (EcheanceRecurrente) + Commission d'agence</span>
                <span className="block ml-3 text-gray-600">- Taxe foncière, assurance, CFE, etc. (périodicité : mensuel/annuel/...)</span>
                <span className="block ml-3 text-gray-600">- Commission calculée selon les règles de la société de gestion</span>
                <span className="block ml-3 text-gray-600 italic">(ou moyenne des charges passées si pas d'échéances)</span>
              </li>
              <li>• <strong>Intérêts emprunt</strong> : 
                <span className="ml-1">Calculés depuis les prêts actifs (CRD actuel × taux mensuel × mois restants)</span>
              </li>
            </ul>
          </div>
          
          <div 
            className="mt-3 p-4 border border-blue-300 rounded-xl"
            style={{ 
              backgroundColor: '#EFF6FF',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
            }}
          >
            <p className="text-blue-900 font-semibold flex items-center gap-2">
              💡 Commission d'agence (LOYERS UNIQUEMENT)
            </p>
            <p className="text-blue-800 mt-1">
              ⚠️ La commission s'applique UNIQUEMENT sur les loyers (nature = code système "loyer"), PAS sur les autres recettes ni sur la taxe foncière.
            </p>
            <p className="text-blue-700 text-xs mt-1">
              📋 Les codes système sont configurés dans <strong>Paramètres → Gestion déléguée → Codes système</strong>
            </p>
            <p className="text-blue-800 mt-1">
              Si le bien est en gestion déléguée, la commission est calculée selon les paramètres de la société :
            </p>
            <ul className="ml-4 mt-1 space-y-0.5 text-blue-700">
              <li>• Mode de calcul : "Loyers uniquement" OU "Revenus totaux" (loyer HC + charges récup)</li>
              <li>• Taux de commission : Défini dans la société de gestion (ex: 5%)</li>
              <li>• TVA applicable : Défini dans la société (ex: 20%)</li>
              <li>• Frais minimum : Si configuré</li>
            </ul>
            <p className="text-blue-600 mt-1 italic text-xs">
              ℹ️ Pour le passé : les commissions sont déjà dans les transactions (créées automatiquement). Pour la projection : calculées sur les loyers futurs uniquement.
            </p>
          </div>
          
          <p className="mt-2 text-gray-600 italic">
            ⚠️ Pour une projection précise, assurez-vous que :
          </p>
          <ul className="ml-4 text-gray-600 italic space-y-0.5">
            <li>• Vos baux ont le statut "ACTIF" et le montant du loyer est renseigné</li>
            <li>• Les échéances sont planifiées avec le bon type et la bonne périodicité</li>
            <li>• Les prêts sont actifs avec le taux et la durée corrects</li>
            <li>• La société de gestion est active et configurée (si gestion déléguée)</li>
          </ul>
        </div>
      </BlockCard>
    </div>
  );
}
