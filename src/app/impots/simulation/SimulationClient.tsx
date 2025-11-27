/**
 * SimulationClient - Client du simulateur fiscal
 * 
 * Interface principale pour la simulation fiscale avec formulaire et résultats
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Calculator,
  Euro,
  Users,
  Home,
  TrendingDown,
  TrendingUp,
  FileDown,
  Eye,
  AlertCircle,
  Loader2,
  PiggyBank,
  ChevronDown,
  ChevronUp,
  Save,
  Check,
  FolderOpen,
  Trash2,
} from 'lucide-react';
import { Separator } from '@/components/ui/Separator';
import {
  FiscalKPICard,
  FiscalDetailDrawer,
  ProjectionDetailModal,
} from '@/components/fiscal';
import type { FiscalInputs, SimulationResult, HouseholdInfo } from '@/types/fiscal';

export default function SimulationClient() {
  const [loading, setLoading] = useState(false);
  const [autofill, setAutofill] = useState(true);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [autofillData, setAutofillData] = useState<any>(null);
  const [loadingAutofill, setLoadingAutofill] = useState(false);
  const [selectedBienIds, setSelectedBienIds] = useState<string[]>([]); // IDs des biens sélectionnés
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedSimulationId, setSavedSimulationId] = useState<string | null>(null);
  
  // 🆕 Gestion des simulations sauvegardées
  const [savedSimulations, setSavedSimulations] = useState<any[]>([]);
  const [loadingSimulations, setLoadingSimulations] = useState(false);
  const [simulationsOpen, setSimulationsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // 🆕 Modal projection détaillée
  const [projectionModalOpen, setProjectionModalOpen] = useState(false);
  
  // 🆕 État des accordéons (ouvert/fermé)
  const [accordeonState, setAccordeonState] = useState({
    infosPersonnelles: true,  // Ouvert par défaut
    donneesSmartImmo: true,   // Ouvert par défaut
    optionsAvancees: false,   // Fermé par défaut
  });
  
  // Formulaire - Informations personnelles
  const [foyer, setFoyer] = useState<HouseholdInfo>({
    salaire: 50000,
    autresRevenus: 0,
    parts: 1,          // ✅ Défaut : 1 part
    isCouple: false,   // ✅ Défaut : célibataire
  });
  
  // PER (Plan Épargne Retraite)
  const [perEnabled, setPerEnabled] = useState(false);
  const [per, setPer] = useState({
    versementPrevu: 0,
    reliquats: {
      2022: 0,
      2023: 0,
      2024: 0,
    },
  });
  
  // Régimes fiscaux (override manuel)
  const [regimeOverride, setRegimeOverride] = useState<'auto' | 'micro' | 'reel'>('auto');
  
  // 🆕 Mode salaire : Brut ou Net imposable
  const [salaryMode, setSalaryMode] = useState<'brut' | 'netImposable'>('brut');
  const [salaireBrut, setSalaireBrut] = useState(50000);
  
  // 🆕 Choix déduction : Forfaitaire 10% ou Frais réels
  const [deductionMode, setDeductionMode] = useState<'forfaitaire' | 'reels'>('forfaitaire');
  const [fraisReels, setFraisReels] = useState(0);
  
  // Années disponibles
  const currentYear = new Date().getFullYear();
  // ✅ Défaut : Déclaration année N+1 (revenus année N)
  // Ex: En 2025 → Déclaration 2026 (revenus 2025)
  const [selectedYear, setSelectedYear] = useState(currentYear + 1);
  
  // Année de revenus = année de déclaration - 1
  const anneeRevenus = selectedYear - 1;
  
  /**
   * Charge les données autofill depuis SmartImmo
   */
  const loadAutofillData = async () => {
    setLoadingAutofill(true);
    try {
      // Appel à l'agrégateur fiscal pour récupérer les données avec timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // Timeout de 30 secondes
      
      const response = await fetch('/api/fiscal/aggregate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'demo-user', // TODO: Récupérer depuis session
          year: anneeRevenus,
          baseCalcul: 'encaisse',
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        const biens = data.biens || [];
        setAutofillData({
          biens,
          loyers: data.totaux?.loyers || 0,
          charges: data.totaux?.charges || 0,
          nombreBiens: data.totaux?.nombreBiens || 0,
        });
        // Sélectionner tous les biens par défaut
        setSelectedBienIds(biens.map((b: any) => b.id));
      } else {
        console.error('Erreur chargement autofill: réponse non OK', response.status);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('Timeout lors du chargement des données SmartImmo (30s)');
      } else {
      console.error('Erreur chargement autofill:', error);
      }
      // Pas d'alerte, juste ne pas afficher l'encart
    } finally {
      setLoadingAutofill(false);
    }
  };
  
  // Charger les données autofill au montage si toggle ON
  useEffect(() => {
    if (autofill) {
      loadAutofillData();
    }
    // Charger la liste des simulations
    loadSavedSimulations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  /**
   * Charge la liste des simulations sauvegardées
   */
  const loadSavedSimulations = async () => {
    setLoadingSimulations(true);
    try {
      const response = await fetch('/api/fiscal/simulations?limit=20');
      if (response.ok) {
        const data = await response.json();
        setSavedSimulations(data.simulations || []);
      }
    } catch (error) {
      console.error('Erreur chargement simulations:', error);
    } finally {
      setLoadingSimulations(false);
    }
  };
  
  /**
   * Charge une simulation dans le formulaire
   */
  const handleLoadSimulation = async (simulationId: string) => {
    try {
      const response = await fetch(`/api/fiscal/simulations/${simulationId}`);
      if (!response.ok) {
        throw new Error('Simulation introuvable');
      }
      
      const data = await response.json();
      const { inputs, result } = data.simulation;
      
      // Remplir le formulaire avec les données de la simulation
      setFoyer(inputs.foyer);
      setSelectedYear(inputs.year + 1); // Année de déclaration = année revenus + 1
      
      if (inputs.per) {
        setPerEnabled(true);
        setPer(inputs.per);
      }
      
      if (inputs.options?.regimeForce) {
        setRegimeOverride(inputs.options.regimeForce);
      }
      
      // Charger aussi le résultat pour affichage
      setSimulation(result);
      
      alert(`Simulation "${data.simulation.name}" chargée dans le formulaire`);
    } catch (error) {
      console.error('Erreur chargement simulation:', error);
      alert('Erreur lors du chargement de la simulation');
    }
  };
  
  /**
   * Supprime une simulation
   */
  const handleDeleteSimulation = async (simulationId: string, simulationName: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer "${simulationName}" ?`)) {
      return;
    }
    
    setDeletingId(simulationId);
    try {
      const response = await fetch(`/api/fiscal/simulations/${simulationId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la suppression');
      }
      
      // Recharger la liste
      await loadSavedSimulations();
      alert('Simulation supprimée avec succès');
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('Erreur lors de la suppression de la simulation');
    } finally {
      setDeletingId(null);
    }
  };
  
  /**
   * Calcule les totaux en fonction des biens sélectionnés
   */
  const calculateSelectedTotals = () => {
    if (!autofillData || !autofillData.biens) return { loyers: 0, charges: 0, nombreBiens: 0 };
    
    const selectedBiens = autofillData.biens.filter((b: any) => selectedBienIds.includes(b.id));
    
    return {
      loyers: selectedBiens.reduce((sum: number, b: any) => sum + (b.loyers || 0), 0),
      charges: selectedBiens.reduce((sum: number, b: any) => sum + (b.charges || 0), 0),
      nombreBiens: selectedBiens.length,
    };
  };
  
  /**
   * Toggle la sélection d'un bien
   */
  const toggleBienSelection = (bienId: string) => {
    setSelectedBienIds(prev => 
      prev.includes(bienId) 
        ? prev.filter(id => id !== bienId)
        : [...prev, bienId]
    );
  };
  
  /**
   * Sélectionner/désélectionner tous les biens
   */
  const toggleAllBiens = () => {
    if (!autofillData) return;
    
    if (selectedBienIds.length === autofillData.biens.length) {
      // Tout désélectionner
      setSelectedBienIds([]);
    } else {
      // Tout sélectionner
      setSelectedBienIds(autofillData.biens.map((b: any) => b.id));
    }
  };
  
  /**
   * Toggle un accordéon
   */
  const toggleAccordeon = (section: keyof typeof accordeonState) => {
    setAccordeonState(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };
  
  /**
   * Calcule le revenu net imposable à partir du salaire brut
   * Formule simple : Brut - Abattement forfaitaire 10% (ou frais réels)
   */
  const calculateNetImposable = (brut: number): number => {
    if (deductionMode === 'forfaitaire') {
      // Abattement 10% avec min/max
      const abattementParams = simulation?.taxParams?.salaryDeduction || { taux: 0.10, min: 472, max: 13522 };
      const abattement = Math.min(
        Math.max(brut * abattementParams.taux, abattementParams.min),
        abattementParams.max
      );
      return Math.round(brut - abattement);
    } else {
      // Frais réels
      return Math.round(brut - fraisReels);
    }
  };
  
  const handleSimulate = async () => {
    setLoading(true);
    
    try {
      // Calculer le revenu net imposable
      const salaireNetImposable = salaryMode === 'brut' 
        ? calculateNetImposable(salaireBrut)
        : foyer.salaire;
      
      // Appel API pour simuler
      const response = await fetch('/api/fiscal/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: anneeRevenus,  // Année de revenus (N-1), pas année de déclaration
          foyer: {
            ...foyer,
            salaire: salaireNetImposable,  // ← Net imposable calculé
          },
          per: perEnabled ? {
            versementPrevu: per.versementPrevu,
            plafondDisponible: 0,  // Calculé par le backend
            reliquats: per.reliquats,
          } : undefined,
          options: {
            autofill,
            baseCalcul: 'encaisse',
            optimiserRegimes: regimeOverride === 'auto',
            regimeForce: regimeOverride !== 'auto' ? regimeOverride : undefined,
          },
          // 🆕 Passer les IDs des biens sélectionnés si autofill
          scope: autofill && selectedBienIds.length > 0 ? {
            propertyIds: selectedBienIds,
          } : undefined,
        } as Partial<FiscalInputs>),
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la simulation');
      }
      
      const result: SimulationResult = await response.json();
      setSimulation(result);
      
      // 🆕 Mettre en cache dans localStorage pour la page /fiscal/resultats
      localStorage.setItem('fiscal-simulation-cache', JSON.stringify({
        result,
        savedId: savedSimulationId,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Erreur simulation:', error);
      alert('Erreur lors de la simulation fiscale. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleExportPDF = async () => {
    if (!simulation) return;
    
    try {
      const response = await fetch('/api/fiscal/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ simulation }),
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de l\'export PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `simulation-fiscale-${selectedYear}.pdf`;
      a.click();
    } catch (error) {
      console.error('Erreur export PDF:', error);
      alert('Erreur lors de l\'export PDF. Veuillez réessayer.');
    }
  };
  
  /**
   * Sauvegarde la simulation en BDD
   */
  const handleSave = async () => {
    if (!simulation) return;
    
    setSaving(true);
    setSaved(false);
    
    try {
      // Calculer le salaire net imposable en fonction du mode
      let salaireNetImposable = foyer.salaire;
      
      if (salaryMode === 'brut') {
        if (deductionMode === 'forfaitaire') {
          // Abattement forfaitaire 10%
          const params = simulation.taxParams.salaryDeduction || { taux: 0.10, min: 472, max: 13522 };
          const abattement = Math.min(
            Math.max(salaireBrut * params.taux, params.min),
            params.max
          );
          salaireNetImposable = salaireBrut - abattement;
        } else {
          // Frais réels
          salaireNetImposable = Math.max(0, salaireBrut - fraisReels);
        }
      }
      
      // ✅ IMPORTANT : Utiliser les inputs COMPLETS de la simulation (avec biens agrégés)
      // On écrase uniquement les champs du foyer qui peuvent être modifiés dans le formulaire
      const inputs: FiscalInputs = {
        ...simulation.inputs, // ✅ Garder TOUS les inputs (biens, societesIS, etc.)
        year: anneeRevenus,
        foyer: {
          salaire: salaireNetImposable,
          autresRevenus: foyer.autresRevenus,
          parts: foyer.parts,
          isCouple: foyer.isCouple,
        },
        per: perEnabled ? per : undefined,
        options: {
          autofill,
          baseCalcul: 'encaisse',
          optimiserRegimes: regimeOverride === 'auto',
          regimeForce: regimeOverride !== 'auto' ? regimeOverride : undefined,
        },
        scope: selectedBienIds.length > 0 ? { propertyIds: selectedBienIds } : undefined,
      };
      
      console.log('💾 Sauvegarde simulation complète:', {
        foyer: inputs.foyer,
        nombreBiens: inputs.biens?.length || 0,
        nombreSocietesIS: inputs.societesIS?.length || 0,
      });
      
      const response = await fetch('/api/fiscal/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Simulation ${selectedYear} (revenus ${anneeRevenus})`,
          inputs,
          result: simulation,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde');
      }
      
      const data = await response.json();
      setSavedSimulationId(data.simulation.id);
      setSaved(true);
      
      // 🆕 Mettre à jour le cache avec l'ID sauvegardé
      if (simulation) {
        localStorage.setItem('fiscal-simulation-cache', JSON.stringify({
          result: simulation,
          savedId: data.simulation.id,
          timestamp: Date.now(),
        }));
      }
      
      // Recharger la liste des simulations
      await loadSavedSimulations();
      
      // Masquer le message "Sauvegardé" après 3s
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde de la simulation');
    } finally {
      setSaving(false);
    }
  };
  
  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  
  const formatPercent = (rate: number) => `${(rate * 100).toFixed(1)}%`;
  
  return (
    <div className="space-y-6 p-6">
      {/* ========== HEADER ========== */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Calculator className="h-8 w-8 text-blue-600" />
          Simulation fiscale immobilière
        </h1>
        <p className="text-gray-600 mt-2">
          Calculez précisément vos impôts (IR + PS) et optimisez votre fiscalité immobilière
        </p>
      </div>
      
      {/* ========== MES SIMULATIONS ========== */}
      {savedSimulations.length > 0 && (
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <CardHeader 
            className="cursor-pointer hover:bg-purple-100/50 transition-colors"
            onClick={() => setSimulationsOpen(!simulationsOpen)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-base">
                  Mes simulations sauvegardées
                  <Badge variant="outline" className="ml-2 bg-purple-100 text-purple-800 border-purple-300">
                    {savedSimulations.length}
                  </Badge>
                </CardTitle>
              </div>
              {simulationsOpen ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </div>
          </CardHeader>
          
          {simulationsOpen && (
            <CardContent>
              {loadingSimulations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                </div>
              ) : (
                <div className="space-y-2">
                  {savedSimulations.map((sim) => (
                    <div 
                      key={sim.id}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{sim.name}</p>
                        <p className="text-xs text-gray-500">
                          Créée le {new Date(sim.createdAt).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {sim.fiscalVersionId && ` • Version ${sim.fiscalVersionId}`}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLoadSimulation(sim.id)}
                          className="text-xs"
                        >
                          <FolderOpen className="mr-1 h-3 w-3" />
                          Charger
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteSimulation(sim.id, sim.name)}
                          disabled={deletingId === sim.id}
                          className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {deletingId === sim.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}
      
      {/* Bannière version fiscale */}
      {simulation && simulation.taxParams && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Version fiscale : <strong>{simulation.taxParams.version}</strong> (année {simulation.taxParams.year})
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Source : {simulation.taxParams.source} • 
                Dernière MAJ : {new Date(simulation.taxParams.dateMAJ).toLocaleDateString('fr-FR')} • 
                Validé par : {simulation.taxParams.validatedBy}
              </p>
            </div>
            {(simulation.taxParams.version === '2025.1' || simulation.taxParams.version === '2024.1') && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                Fallback (BDD vide)
              </Badge>
            )}
            {simulation.taxParams.version.includes('scrape') && (
              <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
                Scraping officiel
              </Badge>
            )}
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ========== COLONNE GAUCHE : FORMULAIRE (ACCORDÉONS + STICKY) ========== */}
        <div className="lg:col-span-1 relative">
          {/* Contenu scrollable */}
          <div className="space-y-4 pb-32">{/* pb-32 = espace pour les boutons sticky */}
          
          {/* ========== ACCORDÉON 1 : INFORMATIONS PERSONNELLES ========== */}
          <Card>
            <CardHeader 
              className="cursor-pointer transition-colors"
              onClick={() => toggleAccordeon('infosPersonnelles')}
            >
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Informations personnelles
                </div>
                {accordeonState.infosPersonnelles ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </CardTitle>
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
              
              {/* Champ salaire (brut ou net imposable) */}
              <div>
                <Label htmlFor="salaire">
                  {salaryMode === 'brut' ? 'Salaire annuel brut' : 'Salaire annuel net imposable'}
                </Label>
                <div className="relative mt-1">
                  <Euro className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="salaire"
                    type="number"
                    value={salaryMode === 'brut' ? salaireBrut : foyer.salaire}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (salaryMode === 'brut') {
                        setSalaireBrut(value);
                      } else {
                        setFoyer({ ...foyer, salaire: value });
                      }
                    }}
                    className="pl-10"
                    placeholder="50000"
                  />
                </div>
              </div>
              
              {/* Choix Forfaitaire 10% / Frais réels (si mode brut) */}
              {salaryMode === 'brut' && (
                <div className="space-y-3 p-3 border rounded-lg bg-blue-50 border-blue-200">
                  <Label className="text-sm font-medium text-blue-900">Déduction fiscale</Label>
                  
                  {/* Option 1 : Forfaitaire 10% */}
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
                        Abattement forfaitaire de 10%
                        <Badge variant="outline" className="ml-2 bg-green-100 text-green-800 border-green-300">Par défaut</Badge>
                      </Label>
                      {deductionMode === 'forfaitaire' && (
                        <p className="text-xs text-blue-700 mt-1">
                          Déduction : {(() => {
                            const params = simulation?.taxParams?.salaryDeduction || { taux: 0.10, min: 472, max: 13522 };
                            const abat = Math.min(Math.max(salaireBrut * params.taux, params.min), params.max);
                            return abat.toLocaleString('fr-FR');
                          })()} € 
                          → Net imposable : {calculateNetImposable(salaireBrut).toLocaleString('fr-FR')} €
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Option 2 : Frais réels */}
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
                        <div className="mt-2">
                          <div className="relative">
                            <Euro className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input 
                              type="number" 
                              value={fraisReels}
                              onChange={(e) => setFraisReels(Number(e.target.value))}
                              placeholder="Montant annuel des frais réels"
                              className="pl-10"
                            />
                          </div>
                          <p className="text-xs text-blue-700 mt-1">
                            Net imposable : {calculateNetImposable(salaireBrut).toLocaleString('fr-FR')} €
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <Label htmlFor="autresRevenus">Autres revenus imposables</Label>
                <div className="relative mt-1">
                  <Euro className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="autresRevenus"
                    type="number"
                    value={foyer.autresRevenus}
                    onChange={(e) => setFoyer({ ...foyer, autresRevenus: Number(e.target.value) })}
                    className="pl-10"
                    placeholder="0"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="parts">Nombre de parts fiscales</Label>
                <Input
                  id="parts"
                  type="number"
                  step="0.5"
                  min="1"
                  value={foyer.parts}
                  onChange={(e) => setFoyer({ ...foyer, parts: Number(e.target.value) })}
                  className="mt-1"
                  placeholder="2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ex: 1 part (célibataire), 2 parts (couple), +0.5 par enfant
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="isCouple">En couple (marié/pacsé)</Label>
                <Switch
                  id="isCouple"
                  checked={foyer.isCouple}
                  onCheckedChange={(checked) => setFoyer({ ...foyer, isCouple: checked })}
                />
              </div>
            </CardContent>
            )}
          </Card>
          
          {/* ========== ACCORDÉON 3 : OPTIONS AVANCÉES ========== */}
          <Card>
            <CardHeader 
              className="cursor-pointer transition-colors"
              onClick={() => toggleAccordeon('optionsAvancees')}
            >
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Options avancées
                </div>
                {accordeonState.optionsAvancees ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </CardTitle>
            </CardHeader>
            {accordeonState.optionsAvancees && (
            <CardContent className="space-y-4">
              
              {/* Année de déclaration */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Année de déclaration</Label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full p-2 border rounded-lg"
                >
                  {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                    <option key={year} value={year}>
                      Déclaration {year} (revenus {year - 1})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  La déclaration {selectedYear} concerne les revenus de l'année {anneeRevenus}
                </p>
              </div>
              
              <Separator />
              
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
              </div>
              
              <Separator />
              
              {/* Régime fiscal (ancien contenu de Paramètres fiscaux) */}
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
                    <span>✓</span> Utilise le régime défini sur chaque bien, ou calcule l'optimal
                  </p>
                )}
              </div>
              
              <Separator />
              
              {/* Options autofill (ancien contenu de Options) */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Données SmartImmo</Label>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="autofill" className="text-sm text-gray-600">Autofill depuis mes données</Label>
                    <p className="text-xs text-gray-500 mt-1">
                      Pré-remplir automatiquement les revenus/charges depuis vos transactions
                    </p>
                  </div>
                  <Switch
                    id="autofill"
                    checked={autofill}
                    onCheckedChange={(checked) => {
                      setAutofill(checked);
                      if (checked) {
                        loadAutofillData();
                      } else {
                        setAutofillData(null);
                      }
                    }}
                  />
                </div>
              </div>
              
              {/* 🆕 Encart vert déplacé dans Options avancées */}
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
                        {/* Résumé biens */}
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
                        
                        {/* Consolidation revenus */}
                        <Separator className="bg-green-200" />
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-green-700">Loyers annuels</p>
                            <p className="text-sm font-semibold text-green-900">
                              {calculateSelectedTotals().loyers.toLocaleString('fr-FR')} €
                            </p>
                            {selectedBienIds.length < autofillData.biens.length && (
                              <p className="text-xs text-green-600 mt-0.5">
                                ({selectedBienIds.length}/{autofillData.biens.length} biens sélectionnés)
                              </p>
                            )}
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
          
          {/* ANCIEN ACCORDÉON 2 SUPPRIMÉ - Maintenant dans Options avancées */}
          {false && autofill && (loadingAutofill || autofillData) && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader 
                className="cursor-pointer transition-colors"
                onClick={() => toggleAccordeon('donneesSmartImmo')}
              >
                <CardTitle className="text-base flex items-center justify-between text-green-900">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Données récupérées depuis SmartImmo
                  </div>
                  {accordeonState.donneesSmartImmo ? (
                    <ChevronUp className="h-5 w-5 text-green-700" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-green-700" />
                  )}
                </CardTitle>
              </CardHeader>
              {accordeonState.donneesSmartImmo && (
              <CardContent className="space-y-3">
                {loadingAutofill ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                    <span className="ml-2 text-sm text-green-700">Chargement des données...</span>
                  </div>
                ) : autofillData ? (
                  <>
                {/* Résumé biens */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-green-900">
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
                    <div className="mt-2 space-y-2">
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
                
                {/* Consolidation revenus avec breakdown détaillé */}
                <Separator className="bg-green-200" />
                
                <div className="space-y-4">
                  {/* LOYERS */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-green-900">Loyers annuels</p>
                      <p className="text-lg font-bold text-green-900">
                        {calculateSelectedTotals().loyers.toLocaleString('fr-FR')} €
                      </p>
                    </div>
                    {autofillData.biens.some((b: any) => b.breakdown) && (
                      <div className="grid grid-cols-3 gap-2 text-xs pl-4">
                        <div>
                          <p className="text-green-600">Réalisé</p>
                          <p className="font-medium text-green-800">
                            {autofillData.biens
                              .filter((b: any) => selectedBienIds.includes(b.id))
                              .reduce((sum: number, b: any) => sum + (b.breakdown?.passe?.recettes || b.loyers || 0), 0)
                              .toLocaleString('fr-FR')} €
                          </p>
                        </div>
                        <div>
                          <p className="text-green-600">Projeté</p>
                          <p className="font-medium text-green-800">
                            {autofillData.biens
                              .filter((b: any) => selectedBienIds.includes(b.id))
                              .reduce((sum: number, b: any) => sum + (b.breakdown?.projection?.loyersFuturs || 0), 0)
                              .toLocaleString('fr-FR')} €
                          </p>
                        </div>
                        <div>
                          <p className="text-green-600">Mois restants</p>
                          <p className="font-medium text-green-800">
                            {autofillData.biens[0]?.breakdown?.projection?.moisRestants || 0} mois
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* CHARGES */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-green-900">Charges annuelles</p>
                      <p className="text-lg font-bold text-green-900">
                        {calculateSelectedTotals().charges.toLocaleString('fr-FR')} €
                      </p>
                    </div>
                    {autofillData.biens.some((b: any) => b.breakdown) && (
                      <div className="grid grid-cols-3 gap-2 text-xs pl-4">
                        <div>
                          <p className="text-green-600">Charges passées</p>
                          <p className="font-medium text-green-800">
                            {autofillData.biens
                              .filter((b: any) => selectedBienIds.includes(b.id))
                              .reduce((sum: number, b: any) => sum + (b.breakdown?.passe?.chargesDeductibles || 0), 0)
                              .toLocaleString('fr-FR')} €
                          </p>
                        </div>
                        <div>
                          <p className="text-green-600">Charges futures</p>
                          <p className="font-medium text-green-800">
                            {autofillData.biens
                              .filter((b: any) => selectedBienIds.includes(b.id))
                              .reduce((sum: number, b: any) => sum + (b.breakdown?.projection?.chargesFutures || 0), 0)
                              .toLocaleString('fr-FR')} €
                          </p>
                        </div>
                        <div>
                          <p className="text-green-600">Intérêts emprunt</p>
                          <p className="font-medium text-green-800">
                            {autofillData.biens
                              .filter((b: any) => selectedBienIds.includes(b.id))
                              .reduce((sum: number, b: any) => sum + (b.breakdown?.total?.interetsEmprunt || 0), 0)
                              .toLocaleString('fr-FR')} €
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {selectedBienIds.length < autofillData.biens.length && (
                    <div className="bg-green-100 border border-green-300 rounded p-2">
                      <p className="text-xs text-green-800">
                        📊 {selectedBienIds.length}/{autofillData.biens.length} biens sélectionnés
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="pt-2 border-t border-green-200">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-green-600 italic">
                      💡 Ces données ont été automatiquement récupérées depuis votre patrimoine SmartImmo
                    </p>
                    {autofillData.biens.some((b: any) => b.breakdown) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setProjectionModalOpen(true)}
                        className="text-xs"
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Voir le détail
                      </Button>
                    )}
                  </div>
                </div>
                  </>
                ) : null}
              </CardContent>
              )}
            </Card>
          )}
          
          {/* ========== MODAL PROJECTION DÉTAILLÉE ========== */}
          {autofillData && (
            <ProjectionDetailModal
              open={projectionModalOpen}
              onClose={() => setProjectionModalOpen(false)}
              biens={autofillData.biens || []}
              year={anneeRevenus}
            />
          )}
          
          </div>
          
          {/* ========== BOUTONS D'ACTION (STICKY EN BAS) ========== */}
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 bg-transparent backdrop-blur-sm rounded-t-xl p-4 flex flex-row items-center gap-3">
            <Button
              onClick={handleSimulate}
              disabled={loading}
              className="px-6"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calcul en cours...
                </>
              ) : (
                <>
                  <Calculator className="mr-2 h-4 w-4" />
                  Calculer la simulation
                </>
              )}
            </Button>
            
            {simulation && (
              <>
                <Button
                  onClick={() => window.location.href = '/fiscal/resultats?tab=synthese#synthese'}
                  variant="default"
                  className="px-6"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Voir résultats détaillés
                </Button>
                
                <Button
                  onClick={handleSave}
                  variant="outline"
                  className="px-6"
                  disabled={saving || saved}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sauvegarde...
                    </>
                  ) : saved ? (
                    <>
                      <Check className="mr-2 h-4 w-4 text-green-600" />
                      Sauvegardé !
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Sauvegarder la simulation
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={handleExportPDF}
                  variant="outline"
                  className="px-6"
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Export PDF complet
                </Button>
              </>
            )}
          </div>
        </div>
        
        {/* ========== COLONNE DROITE : RÉSULTATS ========== */}
        <div className="lg:col-span-2 space-y-4">
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}
          
          {!loading && !simulation && (
            <Card className="h-full flex items-center justify-center p-12">
              <div className="text-center text-gray-500">
                <Calculator className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Aucune simulation</p>
                <p className="text-sm mt-2">
                  Remplissez le formulaire et lancez une simulation pour voir les résultats
                </p>
              </div>
            </Card>
          )}
          
          {!loading && simulation && (
            <>
              {/* KPIs Principaux */}
              <div className="grid grid-cols-2 gap-4">
                <FiscalKPICard
                  title="Salaire imposable"
                  value={simulation.inputs.foyer.salaire}
                  subtitle={`${simulation.inputs.foyer.parts} part(s)`}
                  icon={Euro}
                  iconColor="text-blue-600"
                />
                
                <FiscalKPICard
                  title="Impôt foncier"
                  value={simulation.consolidation.revenusFonciers}
                  subtitle={`${simulation.biens.filter(b => b.type === 'NU').length} bien(s) nu(s)`}
                  icon={Home}
                  iconColor="text-green-600"
                />
              </div>
              
              {/* Impacts fiscaux */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                    Impacts fiscaux
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <span className="font-medium text-gray-700">Impôt sur le revenu (IR)</span>
                    <span className="text-2xl font-bold text-purple-600">
                      {formatEuro(simulation.ir.impotNet)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                    <span className="font-medium text-gray-700">Prélèvements sociaux (PS)</span>
                    <span className="text-2xl font-bold text-orange-600">
                      {formatEuro(simulation.ps.montant)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm mt-4">
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-gray-600 text-xs">Taux effectif</p>
                      <p className="font-bold text-gray-900">
                        {formatPercent(simulation.resume.tauxEffectif)}
                      </p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-gray-600 text-xs">Tranche marginale</p>
                      <p className="font-bold text-gray-900">
                        {formatPercent(simulation.ir.trancheMarginate)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Résumé */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Résumé
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between p-3 bg-red-50 rounded-lg">
                    <span className="font-medium text-gray-700">Total impôts (IR + PS)</span>
                    <span className="text-xl font-bold text-red-600">
                      {formatEuro(simulation.resume.totalImpots)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex-1">
                      <span className="font-medium text-gray-700">Bénéfice net immobilier</span>
                      <p className="text-xs text-gray-500 mt-1">
                        Loyers - Charges - Impôts supplémentaires (IR + PS)
                      </p>
                    </div>
                    <span className="text-xl font-bold text-green-600">
                      {formatEuro(simulation.resume.beneficeNetImmobilier)}
                    </span>
                  </div>
                  
                  {/* Détail IR supplémentaire - ENCART BLEU */}
                  <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-2 mb-2">
                    <p className="font-medium text-blue-900 mb-1">💡 Détail du calcul :</p>
                    <div className="space-y-0.5">
                      <div className="flex justify-between">
                        <span>Loyers encaissés</span>
                        <span className="font-medium">
                          {formatEuro(simulation.biens.reduce((sum, b) => sum + b.recettesBrutes, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>- Charges déductibles</span>
                        <span className="font-medium">
                          -{formatEuro(simulation.biens.reduce((sum, b) => sum + b.chargesDeductibles, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between text-blue-700">
                        <span>- Impôts supplémentaires (IR + PS causés par le foncier)</span>
                        <span className="font-medium">
                          -{formatEuro(simulation.resume.impotsSuppTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 ml-4">
                        <span>└ dont IR supplémentaire</span>
                        <span>-{formatEuro(simulation.resume.irSupplementaire)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 ml-4">
                        <span>└ dont PS fonciers</span>
                        <span>-{formatEuro(simulation.ps.montant)}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-blue-300 font-semibold text-blue-900">
                        <span>= Bénéfice net réel</span>
                        <span className={simulation.resume.beneficeNetImmobilier >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatEuro(simulation.resume.beneficeNetImmobilier)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* 🆕 Régimes fiscaux : Actuel → Suggéré + Gain - ENCART VIOLET */}
                  <div className="text-xs bg-purple-50 border border-purple-200 rounded p-3">
                    <p className="font-medium text-purple-900 mb-2">📊 Régimes fiscaux par bien :</p>
                    <div className="space-y-2">
                      {simulation.biens.map((bien, i) => {
                        const suggere = bien.regimeSuggere;
                        const utilise = bien.regimeUtilise;
                        const isOptimal = suggere === utilise;
                        
                        // Calculer le gain potentiel en changeant de régime
                        const gainPotentiel = bien.details.economieRegimeReel || 0;
                        
                        return (
                          <div key={i} className="bg-white border border-purple-200 rounded p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-gray-800">{bien.nom}</span>
                              <span className="text-xs text-gray-500">{bien.type}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {isOptimal ? (
                                <>
                                  <span className="text-xs text-gray-600">Actuel :</span>
                                  <Badge className="bg-green-100 text-green-800 border-green-300">
                                    {utilise === 'micro' ? 'Micro' : 'Réel'}
                                  </Badge>
                                  <span className="text-green-600 text-xs flex items-center gap-1">
                                    <span className="font-bold">✓</span> Optimal
                                  </span>
                                </>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-600">Actuel :</span>
                                    <Badge variant="outline" className="bg-gray-100 text-gray-700">
                                      {utilise === 'micro' ? 'Micro' : 'Réel'}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-orange-700 font-medium">Suggéré :</span>
                                    <Badge className="bg-orange-100 text-orange-800 border-orange-300">
                                      {suggere === 'micro' ? 'Micro' : 'Réel'}
                                    </Badge>
                                    {Math.abs(gainPotentiel) > 0 && (
                                      <span className="text-orange-600 text-xs font-bold">
                                        +{Math.round(Math.abs(gainPotentiel)).toLocaleString('fr-FR')} €/an
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Légende */}
                    <div className="mt-2 pt-2 border-t border-purple-200">
                      <p className="text-xs text-purple-700 italic">
                        💡 Actuel → Suggéré (+gain potentiel/an)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Optimisation fiscale */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PiggyBank className="h-5 w-5 text-yellow-600" />
                    Optimisation fiscale
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Des optimisations fiscales sont disponibles ! Consultez l'onglet{' '}
                      <strong>"Optimiseur"</strong> pour découvrir des stratégies PER et travaux
                      qui pourraient réduire vos impôts.
                    </AlertDescription>
                  </Alert>
                  
                  <Button
                    variant="outline"
                    className="w-full mt-3"
                    onClick={() => window.location.href = '/impots/optimizer'}
                  >
                    Voir les optimisations
                  </Button>
                </CardContent>
              </Card>
              
              {/* Bouton détails */}
              <Button
                variant="outline"
                onClick={() => setDetailsOpen(true)}
                className="w-full"
              >
                <Eye className="mr-2 h-4 w-4" />
                Voir le détail complet des calculs
              </Button>
              
              {/* Version des barèmes */}
              <div className="text-xs text-gray-500 text-center">
                Barèmes fiscaux : {simulation.taxParams.version} ({simulation.taxParams.source})
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Drawer détails */}
      {simulation && (
        <FiscalDetailDrawer
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          simulation={simulation}
          onOpenProjectionModal={() => setProjectionModalOpen(true)}
        />
      )}
    </div>
  );
}

