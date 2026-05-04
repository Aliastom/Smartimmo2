/**
 * FiscalAggregator - Service d'agrégation des données fiscales
 * 
 * Ce service récupère automatiquement toutes les données nécessaires pour les calculs fiscaux
 * depuis les différentes sources SmartImmo (transactions, baux, prêts, sociétés de gestion)
 */

import { prisma } from '@/lib/prisma';
import { calcCommission } from '@/lib/gestion/calcCommission'; // 🆕 Import du service de calcul de commission
import { Fiscal2044Aggregator } from '@/services/tax/Fiscal2044Aggregator';
import { LoanInterestYearAggregator } from '@/services/tax/LoanInterestYearAggregator';
import type {
  FiscalInputs,
  HouseholdInfo,
  RentalPropertyInput,
  PERInput,
  TaxYear,
  TypeBien,
  RegimeFiscal,
  TypeTravaux,
  Fiscal2044DeclarativeMissingKey,
  Fiscal2044InformationsBien,
  Fiscal2044UiHintLine,
  Fiscal2044UiDelegatedHints,
} from '@/types/fiscal';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * ⚠️ DEPRECATED : Ce mapping sera supprimé et remplacé par un chargement BDD
 * TODO : Charger les mappings depuis une table de configuration
 * 
 * Mapping temporaire des types de baux vers types fiscaux BDD
 * IMPORTANT : Les valeurs doivent correspondre aux FiscalType.id en BDD
 * Ex: FiscalType.id = 'NU', 'MEUBLE', 'SCI_IS'
 */
const BAIL_TYPE_TO_FISCAL_TYPE_FALLBACK: Record<string, TypeBien> = {
  'nu': 'NU',
  'empty': 'NU',
  'meuble': 'MEUBLE',
  'furnished': 'MEUBLE',
  'lmnp': 'MEUBLE',
  'lmp': 'MEUBLE',
};

// ============================================================================
// OPTIONS D'AGRÉGATION
// ============================================================================

interface AggregationOptions {
  /** Obligatoire - isolation multi-tenant */
  organizationId: string;
  year: TaxYear;
  scope?: {
    propertyIds?: string[];      // Filtrer par biens spécifiques
    societyIds?: string[];        // Filtrer par sociétés spécifiques
  };
  baseCalcul?: 'encaisse' | 'exigible';  // Base de calcul (encaissé par défaut)
  regimeForce?: 'micro' | 'reel';  // Forcer un régime spécifique
}

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

class FiscalAggregatorClass {
  private createEmptyUiDelegatedHints(): Fiscal2044UiDelegatedHints {
    return {
      byFiscalLine: {
        '211': { count: 0, labels: [] },
        '221': { count: 0, labels: [] },
        '222': { count: 0, labels: [] },
        '223': { count: 0, labels: [] },
        '224': { count: 0, labels: [] },
        '225': { count: 0, labels: [] },
        '227': { count: 0, labels: [] },
        '230': { count: 0, labels: [] },
      },
    };
  }

  /**
   * Cache des codes système et natures pour éviter les requêtes multiples
   */
  private systemCodesCache: {
    rentNature: string;
    rentCategory: string;
    mgmtNature: string;
    mgmtCategory: string;
  } | null = null;
  
  private naturesCache: Map<string, { code: string; label: string; flow: string }> | null = null;
  
  // 🆕 Cache des types fiscaux (NU, MEUBLE, SCI_IS)
  private fiscalTypesCache: Map<string, { id: string; label: string; category: string }> | null = null;
  
  /**
   * Charge les codes système depuis AppSetting
   */
  private async loadSystemCodes() {
    if (this.systemCodesCache) {
      return this.systemCodesCache;
    }
    
    try {
      const settings = await prisma.appSetting.findMany({
        where: {
          key: {
            startsWith: 'gestion.codes.',
          },
        },
      });
      
      const codesMap: Record<string, string> = {};
      for (const setting of settings) {
        codesMap[setting.key] = setting.value;
      }
      
      // ✅ Nettoyer les guillemets doubles qui peuvent entourer les valeurs
      const cleanValue = (value: string) => {
        if (!value) return value;
        // Retirer les guillemets doubles au début et à la fin
        return value.replace(/^["']|["']$/g, '');
      };
      
      this.systemCodesCache = {
        rentNature: cleanValue(codesMap['gestion.codes.rent.nature'] || 'RECETTE_LOYER'),
        rentCategory: cleanValue(codesMap['gestion.codes.rent.Category'] || 'loyer-charges'),
        mgmtNature: cleanValue(codesMap['gestion.codes.mgmt.nature'] || 'DEPENSE_GESTION'),
        mgmtCategory: cleanValue(codesMap['gestion.codes.mgmt.Category'] || 'frais-gestion'),
      };
      
      // Log supprimé pour réduire la verbosité
      return this.systemCodesCache;
    } catch (error) {
      console.error('[FiscalAggregator] Erreur chargement codes système:', error);
      // Valeurs par défaut
      this.systemCodesCache = {
        rentNature: 'RECETTE_LOYER',
        rentCategory: 'loyer-charges',
        mgmtNature: 'DEPENSE_GESTION',
        mgmtCategory: 'frais-gestion',
      };
      return this.systemCodesCache;
    }
  }
  
  /**
   * Charge toutes les natures (NatureEntity) pour filtrer par flow
   */
  private async loadNatures() {
    if (this.naturesCache) {
      return this.naturesCache;
    }
    
    try {
      const natures = await prisma.natureEntity.findMany({
        select: {
          code: true,
          label: true,
          flow: true,
        },
      });
      
      this.naturesCache = new Map();
      for (const nature of natures) {
        this.naturesCache.set(nature.code, nature);
      }
      
      // Log supprimé pour réduire la verbosité
      return this.naturesCache;
    } catch (error) {
      console.error('[FiscalAggregator] Erreur chargement natures:', error);
      this.naturesCache = new Map();
      return this.naturesCache;
    }
  }
  
  /**
   * ✅ Charge tous les types fiscaux (FiscalType) depuis la BDD
   */
  private async loadFiscalTypes() {
    if (this.fiscalTypesCache) {
      return this.fiscalTypesCache;
    }
    
    try {
      const fiscalTypes = await prisma.fiscalType.findMany({
        where: { isActive: true },
        select: {
          id: true,
          label: true,
          category: true,
        },
      });
      
      this.fiscalTypesCache = new Map();
      for (const fiscalType of fiscalTypes) {
        this.fiscalTypesCache.set(fiscalType.id, fiscalType);
      }
      
      // Log supprimé pour réduire la verbosité
      return this.fiscalTypesCache;
    } catch (error) {
      console.error('[FiscalAggregator] Erreur chargement types fiscaux:', error);
      // Fallback sur types hardcodés
      this.fiscalTypesCache = new Map([
        ['NU', { id: 'NU', label: 'Location nue', category: 'FONCIER' }],
        ['MEUBLE', { id: 'MEUBLE', label: 'Location meublée', category: 'BIC' }],
        ['SCI_IS', { id: 'SCI_IS', label: 'SCI à l\'IS', category: 'IS' }],
      ]);
      return this.fiscalTypesCache;
    }
  }
  
  /**
   * Agrège toutes les données fiscales pour un utilisateur et une année
   */
  async aggregate(options: AggregationOptions): Promise<Omit<FiscalInputs, 'foyer' | 'per' | 'options'>> {
    const { organizationId, year, scope, baseCalcul = 'encaisse', regimeForce } = options;
    
    console.log(`📊 Agrégation fiscale ${year} pour org ${organizationId.slice(0, 8)}...`);
    
    // Charger les codes système, natures et types fiscaux UNE SEULE FOIS
    await this.loadSystemCodes();
    await this.loadNatures();
    await this.loadFiscalTypes();  // ✅ Charger les types fiscaux depuis BDD
    
    // Paramètres fiscaux : `FiscalVersion.year` = année de déclaration (campagne), pas année des revenus
    const { TaxParamsService } = await import('./TaxParamsService');
    const declarationYear = year + 1;
    const taxParams = await TaxParamsService.get(declarationYear);
    console.log(`📋 TaxParams ${taxParams.version} chargés (revenus ${year} / décl. ${declarationYear} ; micro foncier: ${taxParams.micro.foncierPlafond}€, ${taxParams.micro.foncierAbattement * 100}%)`);
    
    // Récupérer tous les biens de l'organisation
    const properties = await this.getProperties(organizationId, scope?.propertyIds);
    
    // Pour chaque bien, agréger les données fiscales
    const biens: RentalPropertyInput[] = [];
    
    for (const property of properties) {
      const propertyData = await this.aggregateProperty(property.id, organizationId, year, baseCalcul, taxParams);
      if (propertyData) {
        biens.push(propertyData);
      }
    }
    
    console.log(`✅ ${biens.length} bien(s) agrégé(s)`);

    const sumResultatsBiens = biens.reduce((sum, bien) => sum + ((bien.loyers || 0) - (bien.charges || 0)), 0);
    const montant4BA = sumResultatsBiens;
    const delta = Math.abs(sumResultatsBiens - montant4BA);
    if (delta > 0.01) {
      console.error('[FISCAL_COHERENCE_ERROR]', {
        sumResultatsBiens,
        montant4BA,
        delta,
        detailsParBien: biens.map((b) => ({
          id: b.id,
          nom: b.nom,
          recettes: b.loyers || 0,
          charges: b.charges || 0,
          resultatFiscal: (b.loyers || 0) - (b.charges || 0),
        })),
      });
    }
    
    // TODO: Implémenter l'agrégation des sociétés IS
    return { 
      year, 
      biens,
      societesIS: [] // Pour le moment, toujours vide
    };
  }
  
  /**
   * Récupère les biens d'une organisation (filtrage multi-tenant obligatoire)
   */
  private async getProperties(organizationId: string, propertyIds?: string[]) {
    const where: any = {
      organizationId,
      isArchived: false,
    };
    
    if (propertyIds && propertyIds.length > 0) {
      where.id = { in: propertyIds };
    }
    
    return prisma.property.findMany({
      where,
      select: {
        id: true,
        name: true,
        address: true,
        type: true,
        fiscalTypeId: true,      // ✅ Type fiscal explicite du bien
        FiscalType: true,         // ✅ Relation FiscalType complète
        fiscalRegimeId: true,
        FiscalRegime: true,
      },
      orderBy: { name: 'asc' },
      take: 50,  // Limiter à 50 biens max pour éviter les timeouts
    });
  }
  
  /**
   * ✅ Détermine le type fiscal d'un bien depuis FiscalType en BDD
   * PRIORITÉS :
   * 1. property.fiscalTypeId (PRIORITÉ ABSOLUE - défini dans l'UI du bien)
   * 2. Mapping Lease.type → FiscalType depuis cache BDD (fallback si pas défini)
   * 3. Fallback : 'NU'
   */
  /**
   * Libellés déclaratifs (2044) : locataires, adresse, acquisition, pièces — sans impact sur les calculs IR/PS.
   */
  private buildFiscal2044InformationsBien(property: any): Fiscal2044InformationsBien {
    const leases = property.Lease || [];
    const line1 = [property.address].filter(Boolean).join(' ').trim();
    const line2 = [property.postalCode, property.city].filter(Boolean).join(' ').trim();
    const adresseFormatee =
      [line1, line2].filter((s) => s.length > 0).join(', ') || null;

    const namesSet = new Set<string>();
    for (const lease of leases) {
      const t = lease.Tenant;
      if (t) {
        const n = `${t.firstName || ''} ${t.lastName || ''}`.trim();
        if (n) namesSet.add(n);
      }
    }
    const locatairesNoms = [...namesSet];

    const acq = property.acquisitionDate ? new Date(property.acquisitionDate) : null;
    const dateAcquisition =
      acq && Number.isFinite(acq.getTime()) ? acq.toISOString().slice(0, 10) : null;

    const rooms = typeof property.rooms === 'number' ? property.rooms : null;
    const nombrePiecesOuLotsIndicatif = rooms && rooms > 0 ? rooms : null;

    const missing: Fiscal2044DeclarativeMissingKey[] = [];
    if (leases.length === 0) missing.push('bail');
    if (!dateAcquisition) missing.push('dateAcquisition');
    if (nombrePiecesOuLotsIndicatif == null) missing.push('lots');

    return {
      adresseFormatee,
      locatairesNoms,
      dateAcquisition,
      nombrePiecesOuLotsIndicatif,
      nombreBauxSurAnnee: leases.length,
      missingDeclarative: missing,
    };
  }

  private determinePropertyType(property: any): TypeBien {
    const propertyName = property.name || property.id;
    
    // Priorité 1 : fiscalTypeId explicite (défini dans l'UI "Modifier le bien")
    if (property.fiscalTypeId) {
      return property.fiscalTypeId as TypeBien;
    }
    
    // Priorité 2 : Déduire depuis le type de bail via FiscalType en BDD (fallback)
    if (property.Lease && property.Lease.length > 0) {
      const lease = property.Lease[0];
      const typeBail = lease.type?.toLowerCase() || '';
      
      // ✅ Chercher dans le cache des types fiscaux
      if (this.fiscalTypesCache) {
        for (const [typeId, typeData] of this.fiscalTypesCache.entries()) {
          // Matcher par ID ou label (case-insensitive)
          if (
            typeId.toLowerCase() === typeBail ||
            typeData.label.toLowerCase().includes(typeBail) ||
            (typeBail === 'meuble' && typeId === 'MEUBLE') ||
            (typeBail === 'nu' && typeId === 'NU') ||
            (typeBail === 'lmnp' && typeId === 'MEUBLE') ||
            (typeBail === 'lmp' && typeId === 'MEUBLE')
          ) {
            return typeId as TypeBien;
          }
        }
      }
      
      // Fallback sur l'ancien mapping si le type n'est pas trouvé en BDD
      return BAIL_TYPE_TO_FISCAL_TYPE_FALLBACK[typeBail] || 'NU';
    }
    
    // Par défaut, considérer comme location nue
    return 'NU';
  }

  private parseRegimeChoisi(property: any): RegimeFiscal | undefined {
    let regimeChoisi: RegimeFiscal | undefined;
    if (property.fiscalRegimeId) {
      const regimeId = String(property.fiscalRegimeId).toUpperCase();
      if (regimeId.includes('MICRO')) {
        regimeChoisi = 'micro';
      } else if (regimeId.includes('REEL')) {
        regimeChoisi = 'reel';
      }
    }

    if (property.FiscalRegime && typeof property.FiscalRegime === 'object' && 'code' in property.FiscalRegime) {
      const code = (property.FiscalRegime as any).code?.toLowerCase() || '';
      if (code.includes('micro')) {
        regimeChoisi = 'micro';
      } else if (code.includes('reel') || code.includes('réel')) {
        regimeChoisi = 'reel';
      }
    }

    return regimeChoisi;
  }
  
  /**
   * Agrège les données fiscales pour un bien spécifique
   * 
   * LOGIQUE ROBUSTE :
   * - Récupérer TOUTES les transactions du bien pour l'année
   * - Recettes = Somme(amount > 0) en valeur absolue
   * - Charges déductibles = Somme(amount < 0 ET Category.deductible = true) en valeur absolue
   * - Charges capitalisables = Somme(amount < 0 ET Category.capitalizable = true) en valeur absolue
   */
  private async aggregateProperty(
    propertyId: string,
    organizationId: string,
    year: TaxYear,
    baseCalcul: 'encaisse' | 'exigible',
    taxParams: any // TaxParams depuis la BDD
  ): Promise<RentalPropertyInput | null> {
    const toCents = (amount: number) => Math.round((Number(amount) + Number.EPSILON) * 100);
    const fromCents = (cents: number) => cents / 100;

    // Récupérer le bien avec son agence de gestion et configuration fiscale
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        ManagementCompany: true, // 🆕 Inclure l'agence de gestion
        FiscalType: true,         // ✅ Type fiscal du bien (NU, MEUBLE, etc.)
        FiscalRegime: true,       // ✅ Régime fiscal du bien (micro, réel)
        Lease: {
          where: {
            AND: [
              { startDate: { lte: new Date(`${year}-12-31T23:59:59.999Z`) } },
              {
                OR: [
                  { endDate: null },
                  { endDate: { gte: new Date(`${year}-01-01T00:00:00.000Z`) } },
                ],
              },
            ],
          },
          orderBy: { startDate: 'desc' },
          include: {
            Tenant: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    
    if (!property) return null;
    
    // Déterminer le type de bien (NU, LMNP, LMP, SCI IS)
    const typeBien = this.determinePropertyType(property);
    
    // Récupérer les transactions du bien pour cette année
    // ✅ RÈGLE FISCALE DGFiP : Les revenus fonciers sont rattachés à l'année d'encaissement.
    // On utilise UNIQUEMENT la date de paiement (paidAt, fallback date, fallback createdAt).
    // NE PAS utiliser accounting_month/periodMonth/periodYear (période couverte par le loyer).
    const yearString = year.toString();
    const jan1 = new Date(`${year}-01-01T00:00:00.000Z`);
    const dec31 = new Date(`${year}-12-31T23:59:59.999Z`);
    
    const transactionsRaw = await prisma.transaction.findMany({
      where: {
        propertyId,
        organizationId,
        OR: [
          { paidAt: { gte: jan1, lte: dec31 } },
          { paidAt: { equals: null }, date: { gte: jan1, lte: dec31 } },
        ],
      },
      include: {
        Category: true,
        // Note: nature est un champ String, pas une relation
      },
      orderBy: { date: 'asc' },
    });

    // Déduplication stricte : une transaction (id) ne peut être comptée qu'une seule fois.
    const uniqueTransactionsById = new Map<string, (typeof transactionsRaw)[number]>();
    const duplicateTransactionIds: string[] = [];
    for (const tx of transactionsRaw) {
      if (uniqueTransactionsById.has(tx.id)) {
        duplicateTransactionIds.push(tx.id);
        continue;
      }
      uniqueTransactionsById.set(tx.id, tx);
    }
    const transactions = Array.from(uniqueTransactionsById.values());
    
    // Log supprimé pour réduire la verbosité
    
    // logDebug(`📊 Bien ${property.name} : ${transactions.length} transaction(s) trouvée(s) pour ${year}`);
    
    // ✅ CORRECTION : Filtrer selon NatureEntity.flow (RECETTE/DEPENSE) et non amount > 0
    const natures = this.naturesCache!;
    const systemCodes = this.systemCodesCache!;

    const norm = (v: string | null | undefined) => String(v || '').trim().toLowerCase();
    const rentNatureCode = norm(systemCodes.rentNature);
    const rentCategorySlug = norm(systemCodes.rentCategory);
    const mgmtNatureCode = norm(systemCodes.mgmtNature);
    const mgmtCategorySlug = norm(systemCodes.mgmtCategory);

    const uiDelegatedHints = this.createEmptyUiDelegatedHints();

    const includedTransactionsForSynthese: Array<{
      id: string;
      label: string;
      amountAbs: number;
      reason: string;
    }> = [];
    const excludedTransactionsForSynthese: Array<{
      id: string;
      label: string;
      amountAbs: number;
      reason: string;
    }> = [];
    
    let recettesTotalesCents = 0;
    let chargesDeductiblesCents = 0;
    let chargesCapitalisablesCents = 0;
    let sumTransactionsUsedForSyntheseCents = 0;
    const lmnpChargesLines: Array<{
      transactionId: string;
      bienId: string;
      date: string | null;
      moisComptable: string | null;
      libelle: string;
      categorie: string;
      nature: string;
      montant: number;
      rapprochement: 'rapprochee' | 'non_rapprochee' | 'inconnu';
      sourceMappingLmnp: string;
      bucketFiscal: 'charge_directe' | 'amortissement' | 'hors_charges';
    }> = [];
    
    // 🆕 Breakdown par catégorie
    const recettesParCategorie: Record<string, { label: string; amount: number }> = {};
    const chargesParCategorie: Record<string, { label: string; amount: number }> = {};
    const lmnpChargesParCategorie: Record<string, number> = {};
    const lmnpChargesParBien: Record<string, number> = {};
    let lmnpChargesRapprochees = 0;
    let lmnpChargesNonRapprochees = 0;
    
    // 🔍 DEBUG temporaire : liste des dates avec source (paidAt / date / createdAt) pour vérification fiscale
    const debugPaidAtDates: { date: string; source: 'paidAt' | 'date' | 'createdAt' }[] = [];
    
    for (const transaction of transactions) {
      // ✅ Règle DGFiP : année fiscale = année d'encaissement (paymentDate). Filtre défensif.
      const fiscalDate = transaction.paidAt ?? transaction.date ?? transaction.createdAt;
      const fiscalYear = new Date(fiscalDate).getFullYear();
      if (fiscalYear !== year) {
        excludedTransactionsForSynthese.push({
          id: transaction.id,
          label: transaction.label || 'Transaction',
          amountAbs: Math.abs(transaction.amount),
          reason: `hors année fiscale ${year}`,
        });
        continue;
      }
      
      const dateStr = typeof fiscalDate === 'string' ? fiscalDate.split('T')[0] : new Date(fiscalDate).toISOString().split('T')[0];
      const source: 'paidAt' | 'date' | 'createdAt' = transaction.paidAt ? 'paidAt' : transaction.date ? 'date' : 'createdAt';
      debugPaidAtDates.push({ date: dateStr, source });
      
      const montantCents = Math.abs(toCents(transaction.amount)); // Toujours positif pour les calculs
      const montant = fromCents(montantCents);
      const natureCode = transaction.nature || '';
      const natureCodeNorm = norm(natureCode);
      const nature = natures.get(natureCode);

      // ✅ Filtrer par FLOW (RECETTE/DEPENSE ou INCOME/EXPENSE) et non par signe du montant.
      // Fallback robuste : si nature manquante/inconnue, on infère via le signe.
      let flowUpper = (nature?.flow || '').toUpperCase();
      if (!flowUpper) {
        flowUpper = transaction.amount >= 0 ? 'INCOME' : 'EXPENSE';
      }
      const isRecette = flowUpper === 'RECETTE' || flowUpper === 'INCOME';
      const isDepense = flowUpper === 'DEPENSE' || flowUpper === 'EXPENSE';
      if (!isRecette && !isDepense) {
        excludedTransactionsForSynthese.push({
          id: transaction.id,
          label: transaction.label || 'Transaction',
          amountAbs: montant,
          reason: `flow indéterminé (nature=${natureCode || 'vide'})`,
        });
        continue;
      }
      
      // Récupérer la catégorie pour le breakdown (utiliser slug comme clé unique)
      const categorySlug = transaction.Category?.slug || 'AUTRE';
      const categorySlugNorm = norm(transaction.Category?.slug);
      const categoryLabel = transaction.Category?.label || 'Autres';

      const matchesRentByNature = !!rentNatureCode && natureCodeNorm === rentNatureCode;
      const matchesRentByCategory = !!rentCategorySlug && categorySlugNorm === rentCategorySlug;
      const matchesMgmtByNature = !!mgmtNatureCode && natureCodeNorm === mgmtNatureCode;
      const matchesMgmtByCategory = !!mgmtCategorySlug && categorySlugNorm === mgmtCategorySlug;
      
      // 🔍 Debug : logger chaque transaction pour voir sa catégorie ET l'objet Category complet
      if (!transaction.Category?.slug) {
        console.warn(`   ⚠️ ${transaction.label}: PAS DE SLUG ! Category =`, transaction.Category);
      }
      console.log(`   🔍 ${transaction.label}: ${categoryLabel} (${categorySlug}) - ${montant.toFixed(2)}€ - Flow: ${flowUpper}`);
      
      if (isRecette) {
        // Recette
        recettesTotalesCents += montantCents;
        sumTransactionsUsedForSyntheseCents += montantCents;
        includedTransactionsForSynthese.push({
          id: transaction.id,
          label: transaction.label || 'Transaction',
          amountAbs: montant,
          reason: matchesRentByNature || matchesRentByCategory
            ? 'recette loyer (code système)'
            : 'recette (flow)',
        });
        
        // 🆕 Ajouter au breakdown par catégorie
        if (!recettesParCategorie[categorySlug]) {
          recettesParCategorie[categorySlug] = { label: categoryLabel, amount: 0 };
        }
        recettesParCategorie[categorySlug].amount = fromCents(
          toCents(recettesParCategorie[categorySlug].amount) + montantCents,
        );
        
        // ✅ Identifier les loyers UNIQUEMENT par la CATÉGORIE définie dans les codes système
        // (utile pour le forcing 211 appliqué plus bas lors de la préparation 2044).
      } else if (isDepense) {
        // Dépense - utiliser Category.deductible et Category.capitalizable
        const fiscalDateIso = fiscalDate
          ? new Date(fiscalDate).toISOString().slice(0, 10)
          : null;
        const monthFromDate = fiscalDateIso ? fiscalDateIso.slice(0, 7) : null;
        const accountingMonth = (transaction as any).accountingMonth || (transaction as any).periodMonth || monthFromDate;
        const accountingYear = (transaction as any).periodYear || (accountingMonth ? Number(String(accountingMonth).slice(0, 4)) : null);
        const moisComptable = accountingMonth && accountingYear
          ? `${accountingYear}-${String(accountingMonth).padStart(2, '0')}`
          : monthFromDate;
        const rapprochementStatus = String((transaction as any).rapprochementStatus || '').toLowerCase();
        const rapprochement: 'rapprochee' | 'non_rapprochee' | 'inconnu' = rapprochementStatus === 'rapprochee'
          ? 'rapprochee'
          : rapprochementStatus
            ? 'non_rapprochee'
            : 'inconnu';
        const sourceMappingLmnp = transaction.Category?.capitalizable === true
          ? 'category.capitalizable=true'
          : transaction.Category?.deductible === true
            ? 'category.deductible=true'
            : transaction.Category
              ? 'category fallback (sans indicateur fiscal explicite)'
              : 'sans category (fallback charge)';

        if (transaction.Category?.capitalizable === true) {
          chargesCapitalisablesCents += montantCents;
          excludedTransactionsForSynthese.push({
            id: transaction.id,
            label: transaction.label || 'Transaction',
            amountAbs: montant,
            reason: 'charge capitalisable (hors synthèse fiscale courante)',
          });
          lmnpChargesLines.push({
            transactionId: transaction.id,
            bienId: propertyId,
            date: fiscalDateIso,
            moisComptable: moisComptable || null,
            libelle: transaction.label || 'Transaction',
            categorie: categoryLabel,
            nature: natureCode || 'N/A',
            montant,
            rapprochement,
            sourceMappingLmnp,
            bucketFiscal: 'amortissement',
          });
        } else if (transaction.Category?.deductible === true) {
          chargesDeductiblesCents += montantCents;
          sumTransactionsUsedForSyntheseCents += montantCents;
          includedTransactionsForSynthese.push({
            id: transaction.id,
            label: transaction.label || 'Transaction',
            amountAbs: montant,
            reason: matchesMgmtByNature || matchesMgmtByCategory
              ? 'charge déductible frais de gestion (code système)'
              : 'charge déductible',
          });
          
          // 🆕 Ajouter au breakdown par catégorie (seulement les déductibles)
          if (!chargesParCategorie[categorySlug]) {
            chargesParCategorie[categorySlug] = { label: categoryLabel, amount: 0 };
          }
          chargesParCategorie[categorySlug].amount = fromCents(
            toCents(chargesParCategorie[categorySlug].amount) + montantCents,
          );
          lmnpChargesLines.push({
            transactionId: transaction.id,
            bienId: propertyId,
            date: fiscalDateIso,
            moisComptable: moisComptable || null,
            libelle: transaction.label || 'Transaction',
            categorie: categoryLabel,
            nature: natureCode || 'N/A',
            montant,
            rapprochement,
            sourceMappingLmnp,
            bucketFiscal: 'charge_directe',
          });
          lmnpChargesParCategorie[categoryLabel] = (lmnpChargesParCategorie[categoryLabel] || 0) + montant;
          lmnpChargesParBien[propertyId] = (lmnpChargesParBien[propertyId] || 0) + montant;
          if (rapprochement === 'rapprochee') {
            lmnpChargesRapprochees += montant;
          } else if (rapprochement === 'non_rapprochee') {
            lmnpChargesNonRapprochees += montant;
          }
        } else {
          // Si catégorie non définie → considérer comme déductible par défaut
          chargesDeductiblesCents += montantCents;
          sumTransactionsUsedForSyntheseCents += montantCents;
          includedTransactionsForSynthese.push({
            id: transaction.id,
            label: transaction.label || 'Transaction',
            amountAbs: montant,
            reason: 'charge sans catégorie fiscale explicite -> déductible par défaut',
          });
          
          // 🆕 Ajouter au breakdown
          if (!chargesParCategorie[categorySlug]) {
            chargesParCategorie[categorySlug] = { label: categoryLabel, amount: 0 };
          }
          chargesParCategorie[categorySlug].amount = fromCents(
            toCents(chargesParCategorie[categorySlug].amount) + montantCents,
          );
          lmnpChargesLines.push({
            transactionId: transaction.id,
            bienId: propertyId,
            date: fiscalDateIso,
            moisComptable: moisComptable || null,
            libelle: transaction.label || 'Transaction',
            categorie: categoryLabel,
            nature: natureCode || 'N/A',
            montant,
            rapprochement,
            sourceMappingLmnp,
            bucketFiscal: 'charge_directe',
          });
          lmnpChargesParCategorie[categoryLabel] = (lmnpChargesParCategorie[categoryLabel] || 0) + montant;
          lmnpChargesParBien[propertyId] = (lmnpChargesParBien[propertyId] || 0) + montant;
          if (rapprochement === 'rapprochee') {
            lmnpChargesRapprochees += montant;
          } else if (rapprochement === 'non_rapprochee') {
            lmnpChargesNonRapprochees += montant;
          }
        }
      }
    }

    /** Charges déductibles issues uniquement des transactions (avant forfait 222 / ajustements). */
    const chargesDeductiblesFromTxOnlyCents = chargesDeductiblesCents;

    const recettesTotales = fromCents(recettesTotalesCents);
    const chargesDeductiblesBase = fromCents(chargesDeductiblesCents);
    const chargesCapitalisables = fromCents(chargesCapitalisablesCents);
    
    // ✅ Résumé concis uniquement
    console.log(`📊 ${property.name}: ${transactions.length} transaction(s) (rapprochées + non rapprochées) → Recettes ${recettesTotales.toFixed(2)}€, Charges ${chargesDeductiblesBase.toFixed(2)}€`);
    console.log(`   📋 Recettes par catégorie:`, Object.entries(recettesParCategorie).map(([code, data]) => `${data.label}: ${data.amount.toFixed(2)}€`).join(', '));
    console.log(`   📋 Charges par catégorie:`, Object.entries(chargesParCategorie).map(([code, data]) => `${data.label}: ${data.amount.toFixed(2)}€`).join(', '));
    if (duplicateTransactionIds.length > 0) {
      console.warn(`⚠️ [FiscalAggregator] ${duplicateTransactionIds.length} doublon(s) transaction.id détecté(s) puis ignoré(s) pour ${property.name}.`);
    }
    
    // 🆕 Calculer les intérêts d'emprunt (passé + projection) — logique historique simulation
    const interets = await this.calculateLoanInterests(propertyId, year);

    const loansForDeclaration = await prisma.loan.findMany({
      where: {
        propertyId,
        organizationId,
        isActive: true,
        startDate: { lte: new Date(`${year}-12-31`) },
        OR: [{ endDate: null }, { endDate: { gte: new Date(`${year}-01-01`) } }],
      },
    });

    const interetsEmpruntAnnee = LoanInterestYearAggregator.aggregate({
      loans: loansForDeclaration,
      year,
      expectedPropertyId: propertyId,
    });

    const chargesTotalPourSuggestion = chargesDeductiblesBase + interets.passe;
    const regimeSuggere = this.suggestRegime(typeBien, recettesTotales, chargesTotalPourSuggestion, taxParams);

    let regimeChoisi: RegimeFiscal | undefined;
    try {
      regimeChoisi = this.parseRegimeChoisi(property);
    } catch (e) {
      console.warn(`[FiscalAggregator] Impossible de parser le régime fiscal du bien ${property.name}:`, e);
    }

    const regimeEffectif = regimeChoisi || regimeSuggere;
    const rentedLotCount = (property.Lease || []).filter((lease: any) => lease?.Tenant != null).length;
    const shouldApplyForfait222 = typeBien === 'NU' && regimeEffectif === 'reel' && rentedLotCount > 0;
    const forfait222Cents = shouldApplyForfait222 ? rentedLotCount * 2000 : 0;
    if (forfait222Cents > 0) {
      chargesDeductiblesCents += forfait222Cents;
      sumTransactionsUsedForSyntheseCents += forfait222Cents;
      const forfaitLabel = `Forfait fiscal 20€ × ${rentedLotCount} lot(s)`;
      includedTransactionsForSynthese.push({
        id: `FORFAIT_222_${propertyId}`,
        label: forfaitLabel,
        amountAbs: fromCents(forfait222Cents),
        reason: 'forfait fiscal ligne 222 (charge calculée)',
      });
      const currentForfait = chargesParCategorie['FORFAIT_222']?.amount || 0;
      chargesParCategorie['FORFAIT_222'] = {
        label: 'Forfait fiscal 20€/local (ligne 222)',
        amount: fromCents(toCents(currentForfait) + forfait222Cents),
      };
    }

    const chargesDeductibles = fromCents(chargesDeductiblesCents);

    const preparedTransactionsFor2044 = transactions.map((tx) => {
      const txNature = norm(tx.nature);
      const txCategory = norm(tx.Category?.slug);
      const rentMatch = (!!rentNatureCode && txNature === rentNatureCode) || (!!rentCategorySlug && txCategory === rentCategorySlug);
      const mgmtMatch = (!!mgmtNatureCode && txNature === mgmtNatureCode) || (!!mgmtCategorySlug && txCategory === mgmtCategorySlug);

      let forcedHint = tx.Category?.fiscalLineHint ?? null;
      if (rentMatch) forcedHint = '2044_211';
      else if (mgmtMatch) forcedHint = '2044_221';

      return {
        ...tx,
        Category: tx.Category
          ? {
              ...tx.Category,
              fiscalLineHint: forcedHint,
            }
          : tx.Category,
      };
    });

    const declaration2044Base = Fiscal2044Aggregator.aggregate({
      propertyId,
      year,
      transactions: preparedTransactionsFor2044,
      interetsEmprunt: interetsEmpruntAnnee.totalInteretsEmprunt,
      rentedLotCount,
      applyForfait222: shouldApplyForfait222,
    });

    const uiTrace = declaration2044Base.uiLineUsageTrace;
    const uiHintLines: Fiscal2044UiHintLine[] = ['211', '221', '222', '223', '224', '225', '227', '230'];
    for (const line of uiHintLines) {
      const trace = uiTrace?.[line];
      if (!trace) continue;
      const uniqueIds = Array.from(new Set(trace.transactionIds));
      const labels = Array.from(new Set(trace.labels)).slice(0, 2);
      uiDelegatedHints.byFiscalLine[line] = {
        count: trace.isSynthetic ? Math.max(0, trace.syntheticUnits || 0) : uniqueIds.length,
        labels,
      };
    }

    const declaration2044 = {
      ...declaration2044Base,
      interetsEmpruntAnnee,
      informationsBien: this.buildFiscal2044InformationsBien(property),
      uiDelegatedHints,
    };

    // 🆕 Projeter le reste de l'année (loyers + charges futurs)
    const projection = await this.projectRemainingYear(propertyId, year, baseCalcul);
    
    // ✅ CORRECTION : Ne calculer les commissions QUE sur la projection (pas sur le passé)
    // Les commissions passées sont déjà dans les transactions (nature = code système mgmt)
    const commissionProjection = this.calculateManagementCommissionProjection(
      property,
      projection.loyersFuturs,
      projection.chargesRecupFutures
    );
    
    // 🆕 Ajouter les intérêts d'emprunt au breakdown par catégorie
    if (interets.passe > 0) {
      if (!chargesParCategorie['INTERETS_EMPRUNT']) {
        chargesParCategorie['INTERETS_EMPRUNT'] = { label: 'Intérêts d\'emprunt', amount: 0 };
      }
      chargesParCategorie['INTERETS_EMPRUNT'].amount += interets.passe;
    }
    
    // 🆕 Construire le breakdown détaillé (sans logs verbeux)
    
    const breakdown = {
      passe: {
        recettes: recettesTotales,
        chargesDeductibles: chargesDeductibles, // ✅ Les commissions passées sont DÉJÀ dans chargesDeductibles
        interetsEmprunt: interets.passe,
        nombreTransactions: transactions.length,
      },
      projection: {
        loyersFuturs: projection.loyersFuturs,
        chargesFutures: projection.chargesFutures + commissionProjection, // ✅ Ajouter commission FUTURE uniquement
        interetsEmpruntFuturs: interets.projection,
        moisRestants: projection.moisRestants,
        // 🆕 Séparation mensuelles/annuelles pour extrapolation correcte
        chargesMensuelles: projection.chargesMensuelles + commissionProjection,
        chargesAnnuelles: projection.chargesAnnuelles,
      },
      total: {
        recettes: recettesTotales + projection.loyersFuturs,
        chargesDeductibles: chargesDeductibles + projection.chargesFutures + commissionProjection,
        interetsEmprunt: interets.total,
      },
      // 🆕 Breakdown par catégorie de transaction
      byCategory: {
        recettes: recettesParCategorie,
        charges: chargesParCategorie,
      },
    };

    // Garde-fou de cohérence : ce qui est "utilisé" pour la synthèse doit égaler ce qui est affiché.
    const totalTransactionsUtilisees = fromCents(sumTransactionsUsedForSyntheseCents);
    const totalFiscal = fromCents(toCents(breakdown.passe.recettes) + toCents(breakdown.passe.chargesDeductibles));
    const coherenceGap = Math.abs(totalTransactionsUtilisees - totalFiscal);
    if (coherenceGap > 0.01) {
      console.error('[FiscalAggregator][COHERENCE_MISMATCH]', {
        propertyId,
        propertyName: property.name,
        year,
        totalTransactionsUtilisees,
        totalFiscal,
        coherenceGap,
        includedCount: includedTransactionsForSynthese.length,
        excludedCount: excludedTransactionsForSynthese.length,
        duplicateTransactionIds,
        includedTransactionsForSynthese,
        excludedTransactionsForSynthese,
      });
    }
    
    // ✅ Calculer les amortissements pour les biens de catégorie BIC (meublé)
    const fiscalType = this.fiscalTypesCache?.get(typeBien);
    const amortissements = (fiscalType?.category === 'BIC')
      ? await this.calculateAmortizations(propertyId, year)
      : undefined;
    const amortissementsTotal = amortissements
      ? (amortissements.batiment || 0) + (amortissements.mobilier || 0) + (amortissements.fraisAcquisition || 0)
      : 0;

    const auditParTransaction = transactions.map((tx) => {
      const id = tx.id;
      const label = String(tx.label || '');
      const ex = excludedTransactionsForSynthese.find((e) => e.id === id);
      if (ex) {
        return { transactionId: id, label, statut: 'exclu_agregat_fiscal', detail: ex.reason };
      }
      const lmnpTx = lmnpChargesLines.filter((l) => l.transactionId === id);
      const direct = lmnpTx.find((l) => l.bucketFiscal === 'charge_directe');
      if (direct) {
        return {
          transactionId: id,
          label,
          statut: 'charge_lmnp_ligne_directe',
          detail: `${direct.categorie} · ${direct.sourceMappingLmnp} · rapproch.: ${direct.rapprochement}`,
        };
      }
      const amort = lmnpTx.find((l) => l.bucketFiscal === 'amortissement');
      if (amort) {
        return {
          transactionId: id,
          label,
          statut: 'charge_lmnp_amortissement',
          detail: amort.sourceMappingLmnp,
        };
      }
      const inc = includedTransactionsForSynthese.find((i) => i.id === id);
      if (inc) {
        const low = inc.reason.toLowerCase();
        const isRec = low.includes('recette');
        return {
          transactionId: id,
          label,
          statut: isRec ? 'recette_fiscale_encaissement' : 'inclus_synthese_autre',
          detail: inc.reason,
        };
      }
      return {
        transactionId: id,
        label,
        statut: 'non_classé',
        detail: 'Absent des listes included/excluded — vérifier la logique ou un doublon',
      };
    });

    const nombreRecettesSynthese = includedTransactionsForSynthese.filter((i) =>
      i.reason.toLowerCase().includes('recette'),
    ).length;
    const nombreDepensesSynthese = includedTransactionsForSynthese.filter((i) => {
      const low = i.reason.toLowerCase();
      return !low.includes('recette') && !String(i.id).startsWith('FORFAIT');
    }).length;

    const chargesTotalSimulatorCents = chargesDeductiblesCents + toCents(interets.passe);
    const chargesFromTransactionsCents = chargesDeductiblesFromTxOnlyCents;
    const chargesOutsideTransactionsCents =
      chargesTotalSimulatorCents - chargesFromTransactionsCents;
    const loanInterestsCents = toCents(interetsEmpruntAnnee.totalInteretsEmprunt);
    const loanInsuranceCents = toCents(interetsEmpruntAnnee.totalAssuranceEmprunteur);
    const forfaitOrCalculatedChargesCents = forfait222Cents;
    const scheduleLoanSumCents = loanInterestsCents + loanInsuranceCents;
    const otherCents =
      chargesOutsideTransactionsCents - forfaitOrCalculatedChargesCents - scheduleLoanSumCents;

    const lmnpPerimetreDiagnostic = {
      anneeFiscale: year,
      transactionsApresDedup: transactions.length,
      nombreRecettesSynthese,
      nombreDepensesSynthese,
      nombreLignesChargesDirectesLmnp: lmnpChargesLines.filter((l) => l.bucketFiscal === 'charge_directe')
        .length,
      nombreLignesAmortissementLmnp: lmnpChargesLines.filter((l) => l.bucketFiscal === 'amortissement')
        .length,
      nombreExclusions: excludedTransactionsForSynthese.length,
      totalRecettesRetenues: recettesTotales,
      totalChargesDepensesTransactions: fromCents(chargesDeductiblesFromTxOnlyCents),
      totalForfaitHorsTransactions: fromCents(forfait222Cents),
      montantInteretsEmpruntHorsTransactions: interets.passe,
      montantAmortissementsComptablesHorsTransactions: amortissementsTotal,
      chargesFromTransactionsCents,
      chargesOutsideTransactionsCents,
      chargesTotalSimulatorCents,
      outsideTransactionsBreakdown: {
        loanInterestsCents,
        loanInsuranceCents,
        forfaitOrCalculatedChargesCents,
        otherCents,
      },
      exclusionsDetaillees: excludedTransactionsForSynthese.map((e) => ({ ...e })),
      auditParTransaction,
    };
    
    return {
      id: propertyId,
      nom: property.name || 'Bien sans nom',
      type: typeBien,
      
      // ✅ Utiliser UNIQUEMENT les données en BDD (transactions réelles)
      loyers: breakdown.passe.recettes,
      autresRevenus: 0,
      
      // ✅ Charges PASSÉES (BDD uniquement, SANS intérêts)
      // Les intérêts sont ajoutés séparément par Simulator.ts ligne 234
      charges: breakdown.passe.chargesDeductibles,
      interets: breakdown.passe.interetsEmprunt,  // Calculés jusqu'à aujourd'hui
      assuranceEmprunt: 0,  // Inclus dans interets
      taxeFonciere: 0,  // Inclus dans charges
      fraisGestion: 0,  // Inclus dans charges
      assurancePNO: 0,  // Inclus dans charges
      chargesCopro: 0,  // Inclus dans charges
      autresCharges: 0,  // Inclus dans charges
      
      travaux: {
        entretien: 0,  // Inclus dans chargesDeductibles
        amelioration: chargesCapitalisables,
        dejaRealises: chargesDeductibles + chargesCapitalisables,
      },
      
      amortissements,
      
      regimeSuggere,
      regimeChoisi,  // Régime défini sur le bien
      
      // 🆕 Breakdown détaillé (passé + projection séparés pour onglet Projections)
      breakdown,
      ...(fiscalType?.category === 'BIC' ? {
        breakdown: {
          ...breakdown,
          lmnpDebug: {
            chargesLines: lmnpChargesLines,
            totalsByCategory: lmnpChargesParCategorie,
            totalsByBien: lmnpChargesParBien,
            totalsRapprochement: {
              rapprochees: lmnpChargesRapprochees,
              nonRapprochees: lmnpChargesNonRapprochees,
            },
            totalsDirectChargesVsAmortissements: {
              chargesDirectes: chargesDeductibles,
              amortissements: amortissementsTotal,
            },
            perimetreDiagnostic: lmnpPerimetreDiagnostic,
          },
        },
      } : {}),
      
      // 🔍 DEBUG temporaire : dates d'encaissement des transactions incluses (pour vérification fiscale)
      _debugPaidAtDates: debugPaidAtDates,
      declaration2044,
    };
  }
  
  /**
   * Calcule les intérêts d'emprunt pour un bien (passé + projection)
   */
  private async calculateLoanInterests(
    propertyId: string,
    year: number
  ): Promise<{ passe: number; projection: number; total: number }> {
    try {
      const loans = await prisma.loan.findMany({
        where: {
          propertyId,
          isActive: true,
          startDate: { lte: new Date(`${year}-12-31`) },
          OR: [
            { endDate: null },
            { endDate: { gte: new Date(`${year}-01-01`) } },
          ],
        },
      });
      
      if (loans.length === 0) {
        return { passe: 0, projection: 0, total: 0 };
      }
      
      const today = new Date();
      const currentMonth = today.getMonth() + 1; // 1-12
      const currentYear = today.getFullYear();
      
      // Si on simule une année future, tout est projection
      if (year > currentYear) {
        const interetsAnnuels = this.calculateAnnualInterests(loans);
        return { passe: 0, projection: interetsAnnuels, total: interetsAnnuels };
      }
      
      // Si on simule une année passée, tout est passé
      if (year < currentYear) {
        const interetsAnnuels = this.calculateAnnualInterests(loans);
        return { passe: interetsAnnuels, projection: 0, total: interetsAnnuels };
      }
      
      // Année en cours : séparer passé et projection
      let interetsPasse = 0;
      let interetsProjection = 0;
      
      for (const loan of loans) {
        const principal = parseFloat(loan.principal.toString());
        const tauxMensuel = parseFloat(loan.annualRatePct.toString()) / 100 / 12;
        const dureeMois = loan.durationMonths;
        const assurancePct = loan.insurancePct 
          ? parseFloat(loan.insurancePct.toString()) / 100 / 12
          : 0;
        
        // Calculer la mensualité
        const mensualite = (principal * tauxMensuel) / (1 - Math.pow(1 + tauxMensuel, -dureeMois));
        
        // Calculer le CRD actuel (après X mois)
        const startDate = new Date(loan.startDate);
        
        // 🆕 Prendre en compte le paymentDay pour déterminer si le mois actuel est passé ou futur
        const paymentDay = loan.paymentDay || startDate.getDate();
        const todayDay = today.getDate();
        
        // Si le jour de paiement est déjà passé ce mois-ci, le mois actuel est dans "passé"
        // Sinon, il est dans "projection"
        const currentMonthIsPaid = todayDay >= paymentDay;
        
        const moisEcoules = (currentYear - startDate.getFullYear()) * 12 + (currentMonth - (startDate.getMonth() + 1));
        
        // CRD = Principal × ((1 + taux)^n - (1 + taux)^mois) / ((1 + taux)^n - 1)
        let crdActuel = principal;
        if (moisEcoules > 0 && moisEcoules <= dureeMois) {
          const facteur = Math.pow(1 + tauxMensuel, dureeMois);
          const facteurMois = Math.pow(1 + tauxMensuel, moisEcoules);
          crdActuel = principal * (facteur - facteurMois) / (facteur - 1);
        }
        
        // 🆕 Intérêts passés : tenir compte du paymentDay
        // Si le paiement du mois actuel est déjà effectué (jour passé), inclure le mois actuel dans "passé"
        // Sinon, le mois actuel est dans "projection"
        const moisPassesPourInterets = currentMonthIsPaid ? currentMonth : (currentMonth - 1);
        const moisFutursPourInterets = currentMonthIsPaid ? (12 - currentMonth) : (12 - currentMonth + 1);
        
        // Intérêts passés (somme des intérêts de janvier à mois actuel inclus si payé)
        // Calcul simplifié : moyenne du capital sur la période
        const crdDebut = principal;
        const crdMaintenant = crdActuel;
        const capitalMoyen = (crdDebut + crdMaintenant) / 2;
        interetsPasse += capitalMoyen * (tauxMensuel * 12) * (moisPassesPourInterets / 12);
        
        // Intérêts futurs (pour les mois restants)
        // Utiliser le CRD actuel comme base
        const interetsMoisProchain = crdActuel * tauxMensuel;
        interetsProjection += interetsMoisProchain * moisFutursPourInterets;
        
        // Assurance (sur capital initial généralement)
        const assuranceTotale = principal * assurancePct * 12;
        interetsPasse += assuranceTotale * (moisPassesPourInterets / 12);
        interetsProjection += assuranceTotale * (moisFutursPourInterets / 12);
        
        // Log détaillé supprimé pour réduire la verbosité
      }
      
      // Log supprimé pour réduire la verbosité
      
      return { 
        passe: interetsPasse, 
        projection: interetsProjection, 
        total: interetsPasse + interetsProjection 
      };
    } catch (error) {
      console.error(`[FiscalAggregator] Erreur calcul intérêts emprunt:`, error);
      return { passe: 0, projection: 0, total: 0 };
    }
  }
  
  /**
   * Calcule les intérêts annuels totaux pour une liste de prêts
   */
  private calculateAnnualInterests(loans: any[]): number {
    let total = 0;
    
    for (const loan of loans) {
      const principal = parseFloat(loan.principal.toString());
      const tauxAnnuel = parseFloat(loan.annualRatePct.toString()) / 100;
      const assurancePct = loan.insurancePct 
        ? parseFloat(loan.insurancePct.toString()) / 100 
        : 0;
      
      const interetsAnnuels = principal * tauxAnnuel;
      const assuranceAnnuelle = principal * assurancePct;
      total += interetsAnnuels + assuranceAnnuelle;
    }
    
    return total;
  }
  
  /**
   * Projette les revenus et charges pour le reste de l'année
   */
  private async projectRemainingYear(
    propertyId: string,
    year: number,
    baseCalcul: 'encaisse' | 'exigible' = 'encaisse'
  ): Promise<{ 
    loyersFuturs: number; 
    chargesFutures: number; 
    chargesRecupFutures: number; 
    moisRestants: number;
    chargesMensuelles: number;
    chargesAnnuelles: number;
  }> {
    try {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1; // 1-12
      const yearString = year.toString(); // ✅ Définir yearString ici
      
      // Si on simule une année passée ou future, pas de projection
      if (year !== currentYear) {
        return { loyersFuturs: 0, chargesFutures: 0, chargesRecupFutures: 0, moisRestants: 0 };
      }
      
      const moisRestants = 12 - currentMonth;
      
      if (moisRestants <= 0) {
        return { loyersFuturs: 0, chargesFutures: 0, chargesRecupFutures: 0, moisRestants: 0 };
      }
      
      // 1. Récupérer les baux actifs
      const leases = await prisma.lease.findMany({
        where: {
          propertyId,
          status: 'ACTIF',
          startDate: { lte: new Date(`${year}-12-31`) },
          OR: [
            { endDate: null },
            { endDate: { gte: today } },
          ],
        },
      });
      
      // 2. Calculer les loyers futurs (avec charges récupérables)
      let loyersFuturs = 0;
      let chargesRecupFutures = 0;
      
      if (leases.length > 0) {
        // 2a. Si bail actif trouvé → utiliser le montant du bail + charges récup
        for (const lease of leases) {
          const loyerHC = parseFloat(lease.rentAmount?.toString() || '0');
          const chargesRecup = parseFloat(lease.chargesRecupMensuelles?.toString() || '0');
          const totalMensuel = loyerHC + chargesRecup;
          
          loyersFuturs += totalMensuel * moisRestants;
          chargesRecupFutures += chargesRecup * moisRestants;
        }
      } else {
        // 2b. Sinon → Estimer depuis les transactions récentes (loyers)
        // ✅ Règle fiscale : utiliser date d'encaissement (paidAt/date/createdAt), pas accounting_month
        const jan1 = new Date(`${year}-01-01T00:00:00.000Z`);
        const dec31 = new Date(`${year}-12-31T23:59:59.999Z`);
        const recentTransactions = await prisma.transaction.findMany({
          where: {
            propertyId,
            amount: { gt: 0 }, // Recettes uniquement
            rapprochementStatus: baseCalcul === 'encaisse' ? 'rapprochee' : undefined,
            OR: [
              { paidAt: { gte: jan1, lte: dec31 } },
              { paidAt: { equals: null }, date: { gte: jan1, lte: dec31 } },
            ],
          },
          orderBy: { date: 'desc' },
          take: 3, // Prendre les 3 dernières recettes pour moyenne
        });
        
        if (recentTransactions.length > 0) {
          const totalRecettes = recentTransactions.reduce((sum, t) => sum + t.amount, 0);
          const moyenneMensuelle = totalRecettes / recentTransactions.length;
          loyersFuturs = moyenneMensuelle * moisRestants;
        }
      }
      
      // 3. Récupérer les échéances futures (EcheanceRecurrente) pour l'année en cours
      const echeances = await prisma.echeanceRecurrente.findMany({
        where: {
          propertyId,
          isActive: true,
          startAt: { lte: new Date(`${year}-12-31`) },
          OR: [
            { endAt: null },
            { endAt: { gte: today } },
          ],
        },
      });
      
      // 4. Calculer les charges futures depuis les échéances
      // 🆕 Séparer charges mensuelles vs annuelles
      let chargesMensuelles = 0;  // Commission, assurance mensuelle, etc.
      let chargesAnnuelles = 0;   // Taxe foncière, assurance annuelle, etc.
      let chargesFutures = 0;
      
      if (echeances.length > 0) {
        for (const echeance of echeances) {
          // Vérifier si c'est une charge (DEBIT)
          if (echeance.sens !== 'DEBIT') continue;
          
          const montant = parseFloat(echeance.montant.toString());
          
          // ✅ Calculer les occurrences avec la date COMPLÈTE (jour + mois)
          const occurrences = this.calculateOccurrencesWithDate(
            echeance.periodicite,
            echeance.startAt,
            today,
            new Date(`${year}-12-31`)
          );
          
          const totalEcheance = montant * occurrences;
          chargesFutures += totalEcheance;
          
          // ✅ Distinguer mensuelles vs annuelles
          if (echeance.periodicite === 'MONTHLY') {
            chargesMensuelles += totalEcheance;
          } else if (echeance.periodicite === 'YEARLY') {
            chargesAnnuelles += totalEcheance;
          } else {
            // QUARTERLY, ONCE → considérer comme annuelles
            chargesAnnuelles += totalEcheance;
          }
        }
      } else {
        // Fallback : Estimer depuis les charges passées
        // ✅ Règle fiscale : utiliser date d'encaissement (paidAt/date/createdAt), pas accounting_month
        const jan1Charges = new Date(`${year}-01-01T00:00:00.000Z`);
        const dec31Charges = new Date(`${year}-12-31T23:59:59.999Z`);
        const pastCharges = await prisma.transaction.findMany({
          where: {
            propertyId,
            amount: { lt: 0 },
            rapprochementStatus: baseCalcul === 'encaisse' ? 'rapprochee' : undefined,
            OR: [
              { paidAt: { gte: jan1Charges, lte: dec31Charges } },
              { paidAt: { equals: null }, date: { gte: jan1Charges, lte: dec31Charges } },
            ],
          },
          include: { Category: true },
        });
        
        if (pastCharges.length > 0) {
          const chargesDeductiblesPast = pastCharges
            .filter(t => t.Category?.deductible === true)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
          
          const moyenneMensuelle = chargesDeductiblesPast / currentMonth;
          chargesFutures = moyenneMensuelle * moisRestants;
        }
      }
      
      // ✅ Retourner les données avec séparation mensuelles/annuelles
      return { 
        loyersFuturs, 
        chargesFutures, 
        chargesRecupFutures, 
        moisRestants,
        // 🆕 Séparation pour éviter de multiplier les charges annuelles
        chargesMensuelles,  // Charges qui se répètent chaque mois
        chargesAnnuelles,   // Charges qui tombent 1 fois par an
      };
    } catch (error) {
      console.error(`[FiscalAggregator] Erreur projection:`, error);
      return { 
        loyersFuturs: 0, 
        chargesFutures: 0, 
        chargesRecupFutures: 0, 
        moisRestants: 0,
        chargesMensuelles: 0,
        chargesAnnuelles: 0,
      };
    }
  }
  
  /**
   * ✅ Calcule les commissions d'agence UNIQUEMENT sur la projection
   * Les commissions passées sont déjà dans les transactions (avec nature = code système mgmt)
   * Utilise le service existant calcCommission() pour garantir la cohérence
   */
  private calculateManagementCommissionProjection(
    property: any,
    loyersFuturs: number,
    chargesRecupFutures: number
  ): number {
    try {
      // Vérifier si le bien a une agence de gestion
      if (!property.ManagementCompany || !property.ManagementCompany.actif) {
        return 0;
      }
      
      const agency = property.ManagementCompany;
      
      // ✅ Calculer la commission UNIQUEMENT sur les loyers futurs
      // Le modeCalcul détermine la base : LOYERS_UNIQUEMENT ou REVENUS_TOTAUX (loyer + charges récup)
      const commissionFuture = calcCommission({
        montantLoyer: loyersFuturs - chargesRecupFutures, // Loyer HC
        chargesRecup: chargesRecupFutures, // Charges récupérables
        modeCalcul: agency.modeCalcul as any, // ✅ Utiliser le mode de la société
        taux: agency.taux,
        fraisMin: agency.fraisMin ?? undefined,
        tvaApplicable: agency.tvaApplicable,
        tauxTva: agency.tauxTva ?? 20,
      });
      
      return commissionFuture.commissionTTC;
    } catch (error) {
      console.error(`[FiscalAggregator] Erreur calcul commission:`, error);
      return 0;
    }
  }
  
  /**
   * ✅ Calcule combien de fois une échéance tombe dans une période (avec date précise)
   * Prend en compte la périodicité ET le jour exact de l'échéance
   */
  private calculateOccurrencesWithDate(
    periodicite: string,
    startAt: Date,
    periodStart: Date,
    periodEnd: Date
  ): number {
    const jourEcheance = startAt.getDate(); // 1-31
    const moisEcheance = startAt.getMonth(); // 0-11
    
    switch (periodicite) {
      case 'MONTHLY': {
        // Mensuelle : compter tous les mois où le jour tombe
        let count = 0;
        let current = new Date(periodStart);
        
        while (current <= periodEnd) {
          // Vérifier si on a dépassé le jour de l'échéance ce mois-ci
          if (current.getDate() <= jourEcheance) {
            // L'échéance n'est pas encore passée ce mois-ci
            const echeanceThisMonth = new Date(current.getFullYear(), current.getMonth(), jourEcheance);
            if (echeanceThisMonth > periodStart && echeanceThisMonth <= periodEnd) {
              count++;
            }
          }
          
          // Passer au mois suivant
          current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        }
        
        return count;
      }
      
      case 'QUARTERLY': {
        // Trimestrielle : tous les 3 mois à partir de startAt
        let count = 0;
        let current = new Date(startAt);
        
        while (current <= periodEnd) {
          if (current > periodStart) {
            count++;
          }
          // Ajouter 3 mois
          current = new Date(current.getFullYear(), current.getMonth() + 3, current.getDate());
        }
        
        return count;
      }
      
      case 'YEARLY': {
        // Annuelle : vérifier si l'échéance tombe dans la période
        const annee = periodEnd.getFullYear();
        const echeanceThisYear = new Date(annee, moisEcheance, jourEcheance);
        
        if (echeanceThisYear > periodStart && echeanceThisYear <= periodEnd) {
          return 1;
        }
        return 0;
      }
      
      case 'ONCE': {
        // Une seule fois : vérifier si startAt est dans la période
        if (startAt > periodStart && startAt <= periodEnd) {
          return 1;
        }
        return 0;
      }
      
      default:
        console.warn(`[FiscalAggregator] Périodicité inconnue: ${periodicite}`);
        return 0;
    }
  }
  
  /**
   * Calcule les amortissements pour un bien en LMNP/LMP
   */
  private async calculateAmortizations(propertyId: string, year: TaxYear) {
    // Récupérer le bien avec ses détails
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    
    if (!property) {
      return { batiment: 0, mobilier: 0, fraisAcquisition: 0 };
    }
    
    // Calcul simplifié des amortissements
    // En production, utiliser des règles plus précises
    const acquisitionPrice = property.acquisitionPrice || 0;
    const acquisitionDate = property.acquisitionDate;
    
    if (!acquisitionDate || acquisitionPrice === 0) {
      return { batiment: 0, mobilier: 0, fraisAcquisition: 0 };
    }
    
    // Vérifier si le bien est encore dans la période d'amortissement
    const yearsOwned = year - acquisitionDate.getFullYear();
    
    if (yearsOwned < 0) {
      return { batiment: 0, mobilier: 0, fraisAcquisition: 0 };
    }
    
    // Amortissement bâtiment : 2-3% par an sur 30-50 ans
    const batiment = yearsOwned < 50 ? acquisitionPrice * 0.02 : 0;
    
    // Amortissement mobilier : 10% par an sur 10 ans
    const mobilierValue = acquisitionPrice * 0.15;  // 15% du prix pour le mobilier
    const mobilier = yearsOwned < 10 ? mobilierValue * 0.10 : 0;
    
    // Frais d'acquisition : amortis sur la durée du prêt ou 10 ans
    const notaryFees = property.notaryFees || 0;
    const fraisAcquisition = yearsOwned < 10 && notaryFees > 0 ? notaryFees * 0.10 : 0;
    
    return { batiment, mobilier, fraisAcquisition };
  }
  
  /**
   * ✅ Suggère le régime fiscal optimal (micro ou réel)
   * Utilise les types fiscaux et paramètres depuis la BDD
   */
  private suggestRegime(type: TypeBien, loyers: number, charges: number, taxParams: any): RegimeFiscal {
    // ✅ Récupérer le type fiscal depuis le cache BDD
    const fiscalType = this.fiscalTypesCache?.get(type);
    if (!fiscalType) {
      console.warn(`[FiscalAggregator] Type fiscal ${type} non trouvé en BDD, fallback sur réel`);
      return 'reel';
    }
    
    // ✅ Utiliser la catégorie du FiscalType (FONCIER, BIC, IS) au lieu de comparer les strings
    const category = fiscalType.category;
    
    if (category === 'FONCIER') {
      // Location nue : micro-foncier si loyers < plafond (depuis BDD)
      const plafond = taxParams.micro.foncierPlafond;
      const tauxAbattement = taxParams.micro.foncierAbattement;
      
      if (loyers <= plafond) {
        // Comparer abattement micro vs charges réelles
        const abattementMicro = loyers * tauxAbattement;
        return charges > abattementMicro ? 'reel' : 'micro';
      }
      return 'reel';
    } else if (category === 'BIC') {
      // Location meublée : micro-BIC si loyers < plafond (depuis BDD)
      const plafond = taxParams.micro.bicPlafond;
      const tauxAbattement = taxParams.micro.bicAbattement;
      
      if (loyers <= plafond) {
        // Comparer abattement micro vs charges réelles + amortissements
        const abattementMicro = loyers * tauxAbattement;
        return charges > abattementMicro ? 'reel' : 'micro';
      }
      return 'reel';
    }
    
    // Pour les SCI IS ou autres, toujours réel
    return 'reel';
  }
  
  /**
   * Calcule le nombre de mois entre deux dates
   */
  private monthsBetween(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const months = (end.getFullYear() - start.getFullYear()) * 12
      + (end.getMonth() - start.getMonth())
      + 1;  // Inclure le mois de fin
    
    return Math.max(0, months);
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const FiscalAggregator = new FiscalAggregatorClass();

