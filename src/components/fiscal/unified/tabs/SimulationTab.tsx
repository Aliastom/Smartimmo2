/**
 * SimulationTab - Onglet de saisie et configuration de la simulation
 * 
 * Formulaire complet connecté au store Zustand
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useFiscalStore } from '@/store/fiscalStore';
import { useFiscalSession } from '@/hooks/useFiscalSession';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
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
  AlertCircle,
} from 'lucide-react';
import { Separator } from '@/components/ui/Separator';
import { FiscalLoadingOverlay } from '@/components/fiscal/FiscalLoadingOverlay';

export default function SimulationTab() {
  const { simulationDraft, simulationResult, updateDraft, setAutofillCache, autofillCache } = useFiscalStore();
  const { session: fiscalSession } = useFiscalSession();
  const { organizationId } = useCurrentOrganization();

  // Année des revenus : priorité à la session (mise à jour immédiate au changement de déclaration), sinon le draft
  const currentIncomeYear = fiscalSession?.incomeYear ?? simulationDraft.year ?? new Date().getFullYear();
  
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
  const [autofillFromCache, setAutofillFromCache] = useState(false); // Badge "Données locales"
  const [offlineNoCache, setOfflineNoCache] = useState(false);       // Message "Hors ligne"
  
  // 🆕 États pour les impôts déjà payés
  const [prelevementSourceDejaPaye, setPrelevementSourceDejaPaye] = useState(
    simulationDraft.options?.prelevementSourceDejaPaye || 0
  );
  const [acomptesDejaPayes, setAcomptesDejaPayes] = useState(
    simulationDraft.options?.acomptesDejaPayes || 0
  );
  
  // États pour le suivi de progression du chargement
  const [loadingProgress, setLoadingProgress] = useState({
    totalBiens: 0,
    biensProcessed: 0,
    currentBien: '',
    startTime: 0,
  });

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

  // ✅ Ref pour éviter les boucles infinies - tracker si on est en train de restaurer depuis le store
  const isRestoringFromStore = useRef(false);
  const lastRestoredMetadataRef = useRef<string | null>(null);

  // ✅ Restaurer TOUS les états locaux depuis le store (quand une simulation est chargée)
  useEffect(() => {
    // Éviter la restauration si on est déjà en train de synchroniser avec le store
    if (isRestoringFromStore.current) {
      return;
    }
    
    // Créer une clé unique basée sur les métadonnées
    const metadataKey = simulationDraft._uiMetadata 
      ? JSON.stringify(simulationDraft._uiMetadata) 
      : null;
    
    // Si les métadonnées n'ont pas changé, ne pas restaurer
    if (lastRestoredMetadataRef.current === metadataKey) {
      return;
    }
    
    if (simulationDraft._uiMetadata && metadataKey) {
      const meta = simulationDraft._uiMetadata;
      
      // Marquer qu'on est en train de restaurer pour éviter la boucle
      isRestoringFromStore.current = true;
      lastRestoredMetadataRef.current = metadataKey;
      
      // Utiliser requestAnimationFrame pour différer les mises à jour et éviter les conflits
      requestAnimationFrame(() => {
      // Salaire
      if (meta.salaryMode && meta.salaryMode !== salaryMode) {
        setSalaryMode(meta.salaryMode);
      }
        if (meta.salaireBrutOriginal !== undefined && meta.salaireBrutOriginal !== salaireBrut) {
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
        
        // ✅ Restaurer les IDs des biens sélectionnés
        if ((meta as any).selectedBienIds && Array.isArray((meta as any).selectedBienIds)) {
          const savedIds = (meta as any).selectedBienIds as string[];
          if (JSON.stringify(savedIds) !== JSON.stringify(selectedBienIds)) {
            setSelectedBienIds(savedIds);
          }
    }
    
        // Réinitialiser le flag après que toutes les mises à jour soient faites
        requestAnimationFrame(() => {
          isRestoringFromStore.current = false;
        });
      });
    }
    
    // ✅ Restaurer les impôts déjà payés depuis simulationDraft.options
    if (simulationDraft.options) {
      const options = simulationDraft.options;
      if (options.prelevementSourceDejaPaye !== undefined && options.prelevementSourceDejaPaye !== prelevementSourceDejaPaye) {
        setPrelevementSourceDejaPaye(options.prelevementSourceDejaPaye || 0);
      }
      if (options.acomptesDejaPayes !== undefined && options.acomptesDejaPayes !== acomptesDejaPayes) {
        setAcomptesDejaPayes(options.acomptesDejaPayes || 0);
      }
    }
    
    // Restaurer PER depuis simulationDraft.per (seulement si différent)
    if (simulationDraft.per) {
      const perKey = JSON.stringify(simulationDraft.per);
      if (perKey !== JSON.stringify(per)) {
        isRestoringFromStore.current = true;
        requestAnimationFrame(() => {
      setPer(simulationDraft.per);
          requestAnimationFrame(() => {
            isRestoringFromStore.current = false;
          });
        });
    }
    }
  }, [simulationDraft._uiMetadata, simulationDraft.per, simulationDraft.options?.prelevementSourceDejaPaye, simulationDraft.options?.acomptesDejaPayes]); // ⚠️ Seulement les métadonnées du store

  // Synchroniser avec le store (incluant TOUTES les métadonnées UI)
  // ⚠️ Utiliser un ref pour tracker si on vient de restaurer pour éviter la boucle
  const lastSyncedMetadataRef = useRef<string>('');
  
  useEffect(() => {
    // Ne pas synchroniser si on est en train de restaurer depuis le store
    if (isRestoringFromStore.current) {
      return;
    }
    
    // Créer une clé unique pour les métadonnées à synchroniser
    const metadataToSync = JSON.stringify({
      netImposable,
      perEnabled,
      per,
      autofill,
      regimeOverride,
      salaryMode,
      salaireBrut,
      deductionMode,
      fraisReels,
      selectedBienIds,
      prelevementSourceDejaPaye,
      acomptesDejaPayes,
    });
    
    // Si les métadonnées n'ont pas changé, ne pas synchroniser
    if (lastSyncedMetadataRef.current === metadataToSync) {
      return;
    }
    
    lastSyncedMetadataRef.current = metadataToSync;
    
    // Utiliser requestAnimationFrame pour différer la synchronisation et éviter les conflits
    requestAnimationFrame(() => {
      if (isRestoringFromStore.current) {
        return;
      }
      
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
          prelevementSourceDejaPaye: prelevementSourceDejaPaye || undefined,
          acomptesDejaPayes: acomptesDejaPayes || undefined,
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
          selectedBienIds, // ✅ Sauvegarder les IDs des biens sélectionnés
      },
    });
    });
  }, [netImposable, perEnabled, per, autofill, regimeOverride, salaryMode, salaireBrut, deductionMode, fraisReels, selectedBienIds, prelevementSourceDejaPaye, acomptesDejaPayes]); // ⚠️ Retirer updateDraft et simulationDraft pour éviter la boucle

  // Charger les données SmartImmo (offline-first) pour l'année des revenus sélectionnée (session.incomeYear)
  const loadAutofillData = useCallback(async () => {
    if (loadingAutofill) return;

    const year = currentIncomeYear;
    const baseCalcul = simulationDraft.options?.baseCalcul ?? 'encaisse';
    const cacheKey = organizationId ? `${organizationId}:${year}:${baseCalcul}` : null;

    const applyAutofillData = (data: { biens: any[]; totaux?: { loyers?: number; charges?: number; nombreBiens?: number } }, fromCache = false) => {
      const biens = data.biens || [];
      setAutofillData({
        biens,
        loyers: data.totaux?.loyers ?? biens.reduce((s: number, b: any) => s + (b.loyers || 0), 0),
        charges: data.totaux?.charges ?? biens.reduce((s: number, b: any) => s + (b.charges || 0), 0),
        nombreBiens: data.totaux?.nombreBiens ?? biens.length,
      });
      setAutofillFromCache(fromCache);
      setOfflineNoCache(false);
      const savedIds = (simulationDraft._uiMetadata as any)?.selectedBienIds;
      if (!savedIds || savedIds.length === 0) {
        setSelectedBienIds(biens.map((b: any) => b.id));
      }
      setAutofillCache({ biens, year, baseCalcul });
    };

    // Offline : lire le cache IDB
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    if (!isOnline) {
      setLoadingAutofill(true);
      setOfflineNoCache(false);
      try {
        if (cacheKey) {
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          if (db?.FiscalAggregateCache) {
            const cached = await db.FiscalAggregateCache.get(cacheKey);
            if (cached?.payload) {
              const data = JSON.parse(cached.payload);
              applyAutofillData(data, true);
              setLoadingAutofill(false);
              return;
            }
          }
        }
        setOfflineNoCache(true);
      } catch (e) {
        console.warn('[Fiscal] Erreur lecture cache IDB:', e);
        setOfflineNoCache(true);
      }
      setLoadingAutofill(false);
      return;
    }

    setLoadingAutofill(true);
    setOfflineNoCache(false);
    setAutofillFromCache(false);
    const startTime = Date.now();
    setLoadingProgress({ totalBiens: 0, biensProcessed: 0, currentBien: '', startTime });

    let progressInterval: NodeJS.Timeout | null = null;
    let currentProgress = 0;

    progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        const elapsed = (Date.now() - prev.startTime) / 1000;
        const estimatedBiens = Math.min(Math.floor(elapsed / 1.2), 20);
        const estimatedTotal = Math.max(prev.totalBiens || 10, estimatedBiens + 5);
        const newBiensProcessed = Math.min(estimatedBiens, estimatedTotal - 1);
        if (newBiensProcessed < currentProgress) return prev;
        currentProgress = newBiensProcessed;
        return { ...prev, totalBiens: estimatedTotal, biensProcessed: newBiensProcessed };
      });
    }, 800);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/api/fiscal/aggregate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, baseCalcul }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      if (response.ok) {
        const data = await response.json();
        const biens = data.biens || [];

        // Écrire en cache IDB pour usage offline
        if (cacheKey && typeof window !== 'undefined') {
          try {
            const { getLocalDB } = await import('@/lib/offline/db');
            const db = await getLocalDB();
            if (db?.FiscalAggregateCache && organizationId) {
              await db.FiscalAggregateCache.put({
                id: cacheKey,
                organizationId,
                year,
                baseCalcul,
                payload: JSON.stringify(data),
                updatedAt: new Date().toISOString(),
                source: 'server',
              });
            }
          } catch (e) {
            console.warn('[Fiscal] Erreur écriture cache IDB:', e);
          }
        }

        // Animation progression
        const biensNoms = biens.map((b: any) => b.name || b.id).filter(Boolean);
        const totalBiens = biensNoms.length;
        
        // ✅ Continuer la progression depuis où on en était, pas depuis 0
        // On était probablement à environ 80-90% après l'appel API
        // On complète les 10-20% restants avec l'animation des biens
        const estimatedProgress = Math.max(currentProgress, Math.floor(totalBiens * 0.85)); // Au moins 85% de progression estimée
        
        // ✅ Mettre à jour le total de biens et continuer depuis la progression estimée
        setLoadingProgress({
          totalBiens,
          biensProcessed: estimatedProgress,
          currentBien: '',
          startTime,
        });
        
        // ✅ Si on n'est pas encore à 100%, animer les biens restants
        if (estimatedProgress < totalBiens) {
          // Animer chaque bien restant progressivement (seulement les biens restants)
          for (let i = estimatedProgress; i < totalBiens; i++) {
            const newProgress = i + 1;
            setLoadingProgress({
              totalBiens,
              biensProcessed: newProgress,
              currentBien: biensNoms[i] || '',
              startTime,
            });
            await new Promise(resolve => setTimeout(resolve, 80)); // Animation rapide pour la phase 2
          }
        }
        
        // Afficher 100% avec tous les biens traités
        setLoadingProgress({
          totalBiens,
          biensProcessed: totalBiens,
          currentBien: '',
          startTime,
        });
        
        await new Promise(resolve => setTimeout(resolve, 300));

        applyAutofillData(data, false);
      } else {
        console.error('Erreur chargement autofill: réponse non OK', response.status);
      }
    } catch (error: any) {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
      if (error.name === 'AbortError') {
        console.error('Timeout lors du chargement des données SmartImmo (30s)');
      } else {
        console.error('Erreur chargement autofill:', error);
      }
      // Fallback cache IDB en cas d'erreur réseau
      if (cacheKey) {
        try {
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          if (db?.FiscalAggregateCache) {
            const cached = await db.FiscalAggregateCache.get(cacheKey);
            if (cached?.payload) {
              const data = JSON.parse(cached.payload);
              applyAutofillData(data, true);
            }
          }
        } catch (e) {
          // Ignorer
        }
      }
    } finally {
      // ✅ Ne réinitialiser la progression que si le chargement est vraiment terminé
      // Attendre un peu pour que l'animation finale (100%) soit visible
      setTimeout(async () => {
        setLoadingAutofill(false);
        // Réinitialiser après un délai supplémentaire pour éviter que la progression reparte à 0 immédiatement
        await new Promise(resolve => setTimeout(resolve, 300));
        setLoadingProgress({
          totalBiens: 0,
          biensProcessed: 0,
          currentBien: '',
          startTime: 0,
        });
      }, 500);
    }
  }, [organizationId, currentIncomeYear, simulationDraft.options?.baseCalcul, simulationDraft._uiMetadata]);

  // ✅ Ref pour éviter les appels multiples
  const autofillLoadingRef = useRef(false);
  const lastAutofillYearRef = useRef<number | null>(null);

  // Quand l'année des revenus change (changement déclaration), invalider et recharger immédiatement
  useEffect(() => {
    if (!autofill) return;
    const year = currentIncomeYear;
    const prevYear = lastAutofillYearRef.current;
    lastAutofillYearRef.current = year;

    if (prevYear !== null && prevYear !== year) {
      console.log('[Fiscal] Année revenus changée:', prevYear, '→', year, ', rechargement données');
      setAutofillCache(null);
      setAutofillData(null);
      if (!autofillLoadingRef.current) {
        autofillLoadingRef.current = true;
        loadAutofillData().finally(() => {
          autofillLoadingRef.current = false;
        });
      }
    }
  }, [currentIncomeYear, autofill, loadAutofillData, setAutofillCache]);

  useEffect(() => {
    const year = currentIncomeYear;
    // ✅ Restaurer depuis le cache du store seulement si l'année correspond
    if (autofill && !autofillData && autofillCache?.biens?.length && autofillCache.year === year) {
      setAutofillData({
        biens: autofillCache.biens,
        loyers: autofillCache.biens.reduce((sum: number, b: any) => sum + (b.loyers || 0), 0),
        charges: autofillCache.biens.reduce((sum: number, b: any) => sum + (b.charges || 0), 0),
        nombreBiens: autofillCache.biens.length,
      });
      const savedIds = (simulationDraft._uiMetadata as any)?.selectedBienIds;
      if (!savedIds || savedIds.length === 0) {
        setSelectedBienIds(autofillCache.biens.map((b: any) => b.id));
      }
      return;
    }

    // ✅ Charger si autofill activé et (pas de données OU année du cache différente)
    if (autofill && (!autofillData || autofillCache?.year !== year) && !autofillLoadingRef.current) {
      autofillLoadingRef.current = true;
      loadAutofillData().finally(() => {
        autofillLoadingRef.current = false;
      });
    } else if (!autofill) {
      setAutofillData(null);
      autofillLoadingRef.current = false;
    }
  }, [autofill, autofillData, autofillCache, currentIncomeYear, loadAutofillData, organizationId, simulationDraft._uiMetadata]);

  // Réessayer au retour online
  useEffect(() => {
    const handleOnline = () => {
      if (autofill && offlineNoCache) {
        setOfflineNoCache(false);
        loadAutofillData();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [autofill, offlineNoCache, loadAutofillData]);

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

  // Calculer le temps estimé restant
  const estimatedTimeRemaining = loadingProgress.startTime > 0 && loadingProgress.totalBiens > 0
    ? Math.max(0, ((loadingProgress.totalBiens - loadingProgress.biensProcessed) * 1.0)) // ~1 seconde par bien
    : undefined;

  return (
    <>
      {/* Overlay de chargement avec progression */}
      <FiscalLoadingOverlay
        isLoading={loadingAutofill}
        totalBiens={loadingProgress.totalBiens || 0}
        biensProcessed={loadingProgress.biensProcessed}
        currentBien={loadingProgress.currentBien}
        estimatedTime={estimatedTimeRemaining}
      />
      
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
                      <span>✓</span> Utilise le régime paramétré pour chaque bien
                    </p>
                  )}
                </div>

                <Separator />

                {/* 🆕 Impôts déjà payés */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Impôts déjà payés</Label>
                  <p className="text-xs text-gray-500 mb-3">
                    Déduire les montants déjà versés du total d'impôts à payer
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="prelevement-source" className="text-sm text-gray-600">
                        Prélèvement à la source déjà payé (€)
                      </Label>
                      <div className="relative mt-1">
                        <Euro className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="prelevement-source"
                          type="number"
                          value={prelevementSourceDejaPaye}
                          onChange={(e) => setPrelevementSourceDejaPaye(Number(e.target.value) || 0)}
                          className="pl-10"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="acomptes" className="text-sm text-gray-600">
                        Acomptes déjà payés (€)
                      </Label>
                      <div className="relative mt-1">
                        <Euro className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="acomptes"
                          type="number"
                          value={acomptesDejaPayes}
                          onChange={(e) => setAcomptesDejaPayes(Number(e.target.value) || 0)}
                          className="pl-10"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
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
                        if (!checked) {
                          setAutofillData(null);
                          setAutofillFromCache(false);
                          setOfflineNoCache(false);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Hors ligne sans cache */}
                {autofill && offlineNoCache && (
                  <div className="mt-4">
                    <Separator />
                    <Alert variant="outline" className="mt-4 border-amber-200 bg-amber-50">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription>
                        <p className="text-sm font-medium text-amber-900">Hors ligne — impossible d&apos;importer</p>
                        <p className="text-xs text-amber-700 mt-1">
                          Connectez-vous ou réessayez lorsque le réseau sera disponible.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => loadAutofillData()}
                        >
                          Réessayer
                        </Button>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {/* Encart vert biens */}
                {autofill && (loadingAutofill || autofillData) && !offlineNoCache && (
                  <div className="mt-4">
                    <Separator />
                    
                    <div className="mt-4 border-2 border-green-200 bg-green-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <Home className="h-4 w-4 text-green-700" />
                        <p className="text-sm font-medium text-green-900">
                          Données récupérées depuis SmartImmo
                          <span className="text-green-700 font-semibold"> (revenus {currentIncomeYear})</span>
                          {autofillFromCache && (
                            <Badge variant="outline" className="ml-2 text-xs bg-amber-100 text-amber-800 border-amber-300">
                              Données locales (peuvent être non à jour)
                            </Badge>
                          )}
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
    </>
  );
}
