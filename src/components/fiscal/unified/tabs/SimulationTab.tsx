/**
 * SimulationTab - Onglet de saisie et configuration de la simulation
 * 
 * Formulaire complet connecté au store Zustand
 */

'use client';

import { useState, useEffect } from 'react';
import { useFiscalStore } from '@/store/fiscalStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calculator,
  Euro,
  Users,
  Home,
  PiggyBank,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
} from 'lucide-react';
import { Separator } from '@/components/ui/Separator';

export default function SimulationTab() {
  const { simulationDraft, simulationResult, updateDraft } = useFiscalStore();
  
  // États locaux pour le formulaire
  const [accordeonState, setAccordeonState] = useState({
    infosPersonnelles: true,
    optionsAvancees: false,
  });
  
  // Paramètres fiscaux (depuis la simulation calculée ou défaut)
  const [taxParams, setTaxParams] = useState<any>(null);

  // ✅ Initialiser TOUS les états locaux depuis les métadonnées UI
  const [salaryMode, setSalaryMode] = useState<'brut' | 'netImposable'>(
    (simulationDraft._uiMetadata?.salaryMode as 'brut' | 'netImposable') || 'brut'
  );
  const [salaireBrut, setSalaireBrut] = useState(
    simulationDraft._uiMetadata?.salaireBrutOriginal || simulationDraft.foyer?.salaire || 50000
  );
  const [deductionMode, setDeductionMode] = useState<'forfaitaire' | 'reels'>(
    (simulationDraft._uiMetadata?.deductionMode as 'forfaitaire' | 'reels') || 'forfaitaire'
  );
  const [fraisReels, setFraisReels] = useState(
    simulationDraft._uiMetadata?.fraisReels || 0
  );
  const [perEnabled, setPerEnabled] = useState(
    simulationDraft._uiMetadata?.perEnabled || false
  );
  const [per, setPer] = useState(
    simulationDraft.per || {
      versementPrevu: 0,
      reliquats: { 2022: 0, 2023: 0, 2024: 0 },
    }
  );
  const [regimeOverride, setRegimeOverride] = useState<'auto' | 'micro' | 'reel'>(
    (simulationDraft._uiMetadata?.regimeOverride as 'auto' | 'micro' | 'reel') || 'auto'
  );
  const [autofill, setAutofill] = useState(
    simulationDraft._uiMetadata?.autofill ?? true
  );
  const [autofillData, setAutofillData] = useState<any>(null);
  const [loadingAutofill, setLoadingAutofill] = useState(false);
  const [selectedBienIds, setSelectedBienIds] = useState<string[]>([]);

  // Charger les paramètres fiscaux au montage
  useEffect(() => {
    const loadTaxParams = async () => {
      try {
        const response = await fetch('/api/fiscal/tax-params');
        if (response.ok) {
          const data = await response.json();
          setTaxParams(data.params);
        }
      } catch (error) {
        console.error('Erreur chargement paramètres fiscaux:', error);
      }
    };

    // Utiliser les params de la simulation si disponibles, sinon charger depuis l'API
    if (simulationResult?.taxParams) {
      setTaxParams(simulationResult.taxParams);
    } else {
      loadTaxParams();
    }
  }, [simulationResult]);

  // Calculer le net imposable depuis le brut
  const calculateNetImposable = (brut: number) => {
    if (deductionMode === 'forfaitaire') {
      // ✅ Utiliser les paramètres depuis la BDD
      const taux = taxParams?.salaryDeduction?.taux || 0.10;
      const min = taxParams?.salaryDeduction?.min || 472;
      const max = taxParams?.salaryDeduction?.max || 13522;
      const deduction = Math.min(Math.max(brut * taux, min), max);
      return brut - deduction;
    } else {
      return Math.max(brut - fraisReels, 0);
    }
  };

  const netImposable = salaryMode === 'brut' ? calculateNetImposable(salaireBrut) : salaireBrut;

  // ✅ Restaurer TOUS les états locaux depuis le store (quand une simulation est chargée)
  useEffect(() => {
    if (simulationDraft._uiMetadata) {
      const meta = simulationDraft._uiMetadata;
      console.log('🔄 Restauration formulaire depuis métadonnées UI:', meta);
      
      // Salaire
      if (meta.salaryMode && meta.salaryMode !== salaryMode) {
        setSalaryMode(meta.salaryMode);
      }
      if (meta.salaireBrutOriginal && meta.salaireBrutOriginal !== salaireBrut) {
        setSalaireBrut(meta.salaireBrutOriginal);
      }
      
      // Déduction
      if (meta.deductionMode && meta.deductionMode !== deductionMode) {
        setDeductionMode(meta.deductionMode);
      }
      if (meta.fraisReels !== undefined && meta.fraisReels !== fraisReels) {
        setFraisReels(meta.fraisReels);
      }
      
      // PER
      if (meta.perEnabled !== undefined && meta.perEnabled !== perEnabled) {
        setPerEnabled(meta.perEnabled);
      }
      
      // Régime override
      if (meta.regimeOverride && meta.regimeOverride !== regimeOverride) {
        setRegimeOverride(meta.regimeOverride);
      }
      
      // Autofill
      if (meta.autofill !== undefined && meta.autofill !== autofill) {
        setAutofill(meta.autofill);
      }
    }
    
    // Restaurer PER depuis simulationDraft.per
    if (simulationDraft.per && JSON.stringify(simulationDraft.per) !== JSON.stringify(per)) {
      setPer(simulationDraft.per);
    }
  }, [simulationDraft]);

  // Synchroniser avec le store (incluant TOUTES les métadonnées UI)
  useEffect(() => {
    updateDraft({
      foyer: {
        ...simulationDraft.foyer,
        salaire: netImposable,
      },
      per: perEnabled ? per : undefined,
      options: {
        ...simulationDraft.options,
        autofill,
        regimeForce: regimeOverride !== 'auto' ? regimeOverride : undefined,
      },
      // ✅ Sauvegarder TOUTES les métadonnées UI pour restaurer le formulaire correctement
      _uiMetadata: {
        salaryMode,
        salaireBrutOriginal: salaireBrut,
        deductionMode,
        fraisReels,
        perEnabled,
        regimeOverride,
        autofill,
      },
    });
  }, [netImposable, perEnabled, per, autofill, regimeOverride, salaryMode, salaireBrut, deductionMode, fraisReels]);

  // Charger les données SmartImmo
  const loadAutofillData = async () => {
    setLoadingAutofill(true);
    try {
      const currentYear = new Date().getFullYear();
      const response = await fetch('/api/fiscal/aggregate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'demo-user',
          year: currentYear,
          baseCalcul: 'encaisse',
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const biens = data.biens || [];
        setAutofillData({
          biens,
          loyers: data.totaux?.loyers || 0,
          charges: data.totaux?.charges || 0,
          nombreBiens: data.totaux?.nombreBiens || 0,
        });
        setSelectedBienIds(biens.map((b: any) => b.id));
      }
    } catch (error) {
      console.error('Erreur chargement autofill:', error);
    } finally {
      setLoadingAutofill(false);
    }
  };

  useEffect(() => {
    if (autofill) {
      loadAutofillData();
    }
  }, [autofill]);

  const toggleBienSelection = (bienId: string) => {
    setSelectedBienIds((prev) =>
      prev.includes(bienId) ? prev.filter((id) => id !== bienId) : [...prev, bienId]
    );
  };

  const toggleAllBiens = () => {
    if (selectedBienIds.length === autofillData.biens.length) {
      setSelectedBienIds([]);
    } else {
      setSelectedBienIds(autofillData.biens.map((b: any) => b.id));
    }
  };

  const calculateSelectedTotals = () => {
    if (!autofillData) return { loyers: 0, charges: 0 };
    
    const selected = autofillData.biens.filter((b: any) => selectedBienIds.includes(b.id));
    return {
      loyers: selected.reduce((sum: number, b: any) => sum + (b.loyers || 0), 0),
      charges: selected.reduce((sum: number, b: any) => sum + (b.charges || 0), 0),
    };
  };

  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6 p-6">
      {/* Intro */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Simulation fiscale immobilière
        </h2>
        <p className="text-gray-600">
          Calculez précisément vos impôts (IR + PS) et optimisez votre fiscalité immobilière
        </p>
      </div>

      {/* Version fiscale */}
      <Alert className="bg-sky-50 border-sky-200">
        <Info className="h-4 w-4 text-sky-600" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sky-900">
                Année fiscale {currentYear}
              </p>
              <p className="text-xs text-sky-700">
                Déclaration {currentYear + 1} • Barèmes officiels 2025
              </p>
            </div>
            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">
              Validé
            </Badge>
          </div>
        </AlertDescription>
      </Alert>

      {/* Formulaire principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche : Saisie */}
        <div className="lg:col-span-2 space-y-4">
          {/* Informations personnelles */}
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setAccordeonState(prev => ({ ...prev, infosPersonnelles: !prev.infosPersonnelles }))}>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-blue-600" />
                  Informations personnelles
                </CardTitle>
                {accordeonState.infosPersonnelles ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </div>
            </CardHeader>

            {accordeonState.infosPersonnelles && (
              <CardContent className="space-y-4">
                {/* Toggle Brut / Net imposable */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <Label className="text-sm font-medium">Type de salaire</Label>
                  <div className="flex items-center gap-2">
                    <span className={salaryMode === 'brut' ? 'text-sm font-semibold text-blue-600' : 'text-sm text-gray-500'}>
                      Brut
                    </span>
                    <Switch 
                      checked={salaryMode === 'netImposable'}
                      onCheckedChange={(checked) => setSalaryMode(checked ? 'netImposable' : 'brut')}
                    />
                    <span className={salaryMode === 'netImposable' ? 'text-sm font-semibold text-blue-600' : 'text-sm text-gray-500'}>
                      Net imposable
                    </span>
                  </div>
                </div>

                {/* Salaire */}
                <div>
                  <Label htmlFor="salaire">
                    {salaryMode === 'brut' ? 'Salaire annuel brut' : 'Salaire annuel net imposable'}
                  </Label>
                  <div className="relative mt-1">
                    <Euro className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="salaire"
                      type="number"
                      value={salaireBrut}
                      onChange={(e) => setSalaireBrut(Number(e.target.value))}
                      className="pl-10"
                      placeholder="50000"
                    />
                  </div>
                </div>

                {/* Déduction */}
                {salaryMode === 'brut' && (
                  <div className="space-y-3 p-3 border rounded-lg bg-blue-50 border-blue-200">
                    <Label className="text-sm font-medium text-blue-900">Déduction fiscale</Label>
                    
                    <div className="flex items-start gap-3">
                      <input 
                        type="radio" 
                        checked={deductionMode === 'forfaitaire'}
                        onChange={() => setDeductionMode('forfaitaire')}
                        className="mt-1"
                        id="forfaitaire"
                      />
                      <div className="flex-1">
                        <Label htmlFor="forfaitaire" className="font-normal cursor-pointer">
                          Abattement forfaitaire de {taxParams ? `${(taxParams.salaryDeduction?.taux * 100).toFixed(0)}%` : '10%'}
                          <Badge variant="outline" className="ml-2 bg-green-100 text-green-800 border-green-300">Par défaut</Badge>
                        </Label>
                        {deductionMode === 'forfaitaire' && (
                          <p className="text-xs text-blue-700 mt-1">
                            Déduction : {formatEuro(Math.min(Math.max(salaireBrut * (taxParams?.salaryDeduction?.taux || 0.10), taxParams?.salaryDeduction?.min || 472), taxParams?.salaryDeduction?.max || 13522))} → Net imposable : {formatEuro(netImposable - (perEnabled ? per.versementPrevu : 0))}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <input 
                        type="radio" 
                        checked={deductionMode === 'reels'}
                        onChange={() => setDeductionMode('reels')}
                        className="mt-1"
                        id="reels"
                      />
                      <div className="flex-1">
                        <Label htmlFor="reels" className="font-normal cursor-pointer">
                          Frais réels (transport, repas, etc.)
                        </Label>
                        {deductionMode === 'reels' && (
                          <div className="mt-2 relative">
                            <Euro className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input 
                              type="number"
                              value={fraisReels}
                              onChange={(e) => setFraisReels(Number(e.target.value))}
                              placeholder="Montant des frais réels"
                              className="pl-10"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Autres revenus */}
                <div>
                  <Label htmlFor="autresRevenus">Autres revenus imposables (€)</Label>
                  <div className="relative mt-1">
                    <Euro className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="autresRevenus"
                      type="number"
                      value={simulationDraft.foyer?.autresRevenus || 0}
                      onChange={(e) =>
                        updateDraft({
                          foyer: {
                            ...simulationDraft.foyer,
                            autresRevenus: Number(e.target.value),
                          },
                        })
                      }
                      className="pl-10"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Parts fiscales */}
                <div>
                  <Label htmlFor="parts">Nombre de parts fiscales</Label>
                  <Input
                    id="parts"
                    type="number"
                    step="0.5"
                    value={simulationDraft.foyer?.parts || 1}
                    onChange={(e) =>
                      updateDraft({
                        foyer: {
                          ...simulationDraft.foyer,
                          parts: Number(e.target.value),
                        },
                      })
                    }
                    placeholder="1"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ex: 1 part (célibataire), 2 parts (couple), +0.5 par enfant
                  </p>
                </div>

                {/* En couple */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="isCouple">En couple (marié/pacsé)</Label>
                  <Switch
                    id="isCouple"
                    checked={simulationDraft.foyer?.isCouple || false}
                    onCheckedChange={(checked) =>
                      updateDraft({
                        foyer: {
                          ...simulationDraft.foyer,
                          isCouple: checked,
                        },
                      })
                    }
                  />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Options avancées */}
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setAccordeonState(prev => ({ ...prev, optionsAvancees: !prev.optionsAvancees }))}>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PiggyBank className="h-4 w-4 text-purple-600" />
                  Options avancées (PER, déficits...)
                </CardTitle>
                {accordeonState.optionsAvancees ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </div>
            </CardHeader>

            {accordeonState.optionsAvancees && (
              <CardContent className="space-y-4">
                {/* PER */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <PiggyBank className="h-4 w-4" />
                    <Label className="text-sm font-medium">Plan Épargne Retraite (PER)</Label>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="per-enabled" className="text-sm text-gray-600">
                      Inclure le PER dans la simulation
                    </Label>
                    <Switch
                      id="per-enabled"
                      checked={perEnabled}
                      onCheckedChange={setPerEnabled}
                    />
                  </div>
                  
                  {perEnabled && (
                    <div className="mt-3 space-y-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <div>
                        <Label htmlFor="per-versement" className="text-sm">Versement prévu {currentYear}</Label>
                        <div className="relative mt-1">
                          <Euro className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id="per-versement"
                            type="number"
                            value={per.versementPrevu}
                            onChange={(e) => setPer({ ...per, versementPrevu: Number(e.target.value) })}
                            className="pl-10"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <Separator />

                {/* Régime fiscal */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Régime fiscal</Label>
                  <select
                    value={regimeOverride}
                    onChange={(e) => setRegimeOverride(e.target.value as 'auto' | 'micro' | 'reel')}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="auto">🤖 Automatique (recommandé)</option>
                    <option value="micro">Micro-foncier (30% abattement)</option>
                    <option value="reel">Régime réel (charges exactes)</option>
                  </select>
                  {regimeOverride === 'auto' && (
                    <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                      <span>✓</span> Utilise le régime optimal pour chaque bien
                    </p>
                  )}
                </div>

                <Separator />

                {/* Autofill */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Données SmartImmo</Label>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label htmlFor="autofill" className="text-sm text-gray-600">Importer mes données</Label>
                      <p className="text-xs text-gray-500 mt-1">
                        Pré-remplir automatiquement les revenus/charges depuis vos transactions
                      </p>
                    </div>
                    <Switch
                      id="autofill"
                      checked={autofill}
                      onCheckedChange={(checked) => {
                        setAutofill(checked);
                        if (!checked) setAutofillData(null);
                      }}
                    />
                  </div>
                </div>

                {/* Encart vert biens */}
                {autofill && (loadingAutofill || autofillData) && (
                  <div className="mt-4">
                    <Separator />
                    
                    <div className="mt-4 border-2 border-green-200 bg-green-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <Home className="h-4 w-4 text-green-700" />
                        <p className="text-sm font-medium text-green-900">
                          Données récupérées depuis SmartImmo
                        </p>
                      </div>
                      
                      {loadingAutofill ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                          <span className="ml-2 text-sm text-green-700">Chargement des données...</span>
                        </div>
                      ) : autofillData ? (
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-medium text-green-900">
                                {autofillData.nombreBiens || autofillData.biens.length} bien(s) immobilier(s)
                              </p>
                              {autofillData.biens.length > 0 && (
                                <button
                                  onClick={toggleAllBiens}
                                  className="text-xs text-green-700 hover:text-green-900 underline"
                                >
                                  {selectedBienIds.length === autofillData.biens.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                                </button>
                              )}
                            </div>
                            {autofillData.biens.length > 0 ? (
                              <div className="space-y-2">
                                {autofillData.biens.map((bien: any, i: number) => {
                                  const isSelected = selectedBienIds.includes(bien.id);
                                  return (
                                    <div 
                                      key={i} 
                                      className={`flex items-center gap-2 p-2 rounded border transition-colors ${
                                        isSelected 
                                          ? 'bg-green-100 border-green-300' 
                                          : 'bg-gray-50 border-gray-200 opacity-60'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleBienSelection(bien.id)}
                                        className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                      />
                                      <Badge variant="outline" className={isSelected ? 'bg-white' : 'bg-gray-100'}>
                                        {bien.type}
                                      </Badge>
                                      <span className={`text-xs flex-1 ${isSelected ? 'text-green-900 font-medium' : 'text-gray-600'}`}>
                                        {bien.nom || bien.id}
                                      </span>
                                      <span className={`text-xs ${isSelected ? 'text-green-700' : 'text-gray-500'}`}>
                                        {(bien.loyers || 0).toLocaleString('fr-FR')} €
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-green-700 mt-1">Aucun bien trouvé dans votre patrimoine SmartImmo</p>
                            )}
                          </div>
                          
                          <Separator className="bg-green-200" />
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-green-700">Loyers annuels</p>
                              <p className="text-sm font-semibold text-green-900">
                                {calculateSelectedTotals().loyers.toLocaleString('fr-FR')} €
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-green-700">Charges annuelles</p>
                              <p className="text-sm font-semibold text-green-900">
                                {calculateSelectedTotals().charges.toLocaleString('fr-FR')} €
                              </p>
                            </div>
                          </div>
                          
                          <div className="pt-2 border-t border-green-200">
                            <p className="text-xs text-green-600 italic">
                              💡 Ces données ont été automatiquement récupérées depuis votre patrimoine SmartImmo
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Colonne droite : Aide */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Salaire imposable</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">
                {formatEuro(netImposable - (perEnabled ? per.versementPrevu : 0))}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {simulationDraft.foyer?.parts || 1} part(s)
              </p>
              {perEnabled && per.versementPrevu > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  Après PER : -{formatEuro(per.versementPrevu)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Home className="h-4 w-4" />
                Biens immobiliers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {autofill && autofillData && autofillData.biens.length > 0 ? (
                <div>
                  <p className="text-2xl font-bold text-green-600">{selectedBienIds.length}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedBienIds.length} bien(s) sélectionné(s)
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  Activez "Importer mes données" dans les options avancées
                </p>
              )}
            </CardContent>
          </Card>

          {/* Aide */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              💡 <strong>Conseil</strong> : Complétez vos informations puis cliquez sur "Calculer" dans le header
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
