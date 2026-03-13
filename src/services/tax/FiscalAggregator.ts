/**
 * FiscalAggregator - Service d'agrégation des données fiscales
 * 
 * Ce service récupère automatiquement toutes les données nécessaires pour les calculs fiscaux
 * depuis les différentes sources SmartImmo (transactions, baux, prêts, sociétés de gestion)
 */

import { prisma } from '@/lib/prisma';
import { calcCommission } from '@/lib/gestion/calcCommission'; // 🆕 Import du service de calcul de commission
import type {
  FiscalInputs,
  HouseholdInfo,
  RentalPropertyInput,
  PERInput,
  TaxYear,
  TypeBien,
  RegimeFiscal,
  TypeTravaux,
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
    
    // 🆕 Charger les paramètres fiscaux depuis la BDD (pour plafonds/abattements micro)
    const { TaxParamsService } = await import('./TaxParamsService');
    const taxParams = await TaxParamsService.get(year);
    console.log(`📋 TaxParams ${taxParams.version} chargés (micro foncier: ${taxParams.micro.foncierPlafond}€, ${taxParams.micro.foncierAbattement * 100}%)`);
    
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
    // Récupérer le bien avec son agence de gestion et configuration fiscale
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        ManagementCompany: true, // 🆕 Inclure l'agence de gestion
        FiscalType: true,         // ✅ Type fiscal du bien (NU, MEUBLE, etc.)
        FiscalRegime: true,       // ✅ Régime fiscal du bien (micro, réel)
        Lease: {
          where: {
            OR: [
              { status: 'ACTIF' },
              {
                AND: [
                  { startDate: { lte: new Date(`${year}-12-31`) } },
                  {
                    OR: [
                      { endDate: { gte: new Date(`${year}-01-01`) } },
                      { endDate: null },
                    ],
                  },
                ],
              },
            ],
          },
          orderBy: { startDate: 'desc' },
          take: 1,
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
    
    const whereClause: any = {
      propertyId,
      organizationId,
      OR: [
        { paidAt: { gte: jan1, lte: dec31 } },
        { paidAt: { equals: null }, date: { gte: jan1, lte: dec31 } },
      ],
    };
    
    // ✅ Pour base "encaissé", filtrer uniquement les transactions rapprochées
    if (baseCalcul === 'encaisse') {
      whereClause.rapprochementStatus = 'rapprochee';
    }
    
    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        Category: true,
        // Note: nature est un champ String, pas une relation
      },
      orderBy: { date: 'asc' },
    });
    
    // Log supprimé pour réduire la verbosité
    
    // logDebug(`📊 Bien ${property.name} : ${transactions.length} transaction(s) trouvée(s) pour ${year}`);
    
    // ✅ CORRECTION : Filtrer selon NatureEntity.flow (RECETTE/DEPENSE) et non amount > 0
    const natures = this.naturesCache!;
    const systemCodes = this.systemCodesCache!;
    
    let recettesTotales = 0;
    let recettesLoyer = 0; // 🆕 Séparer les loyers des autres recettes
    let chargesDeductibles = 0;
    let chargesCapitalisables = 0;
    
    // 🆕 Breakdown par catégorie
    const recettesParCategorie: Record<string, { label: string; amount: number }> = {};
    const chargesParCategorie: Record<string, { label: string; amount: number }> = {};
    
    // 🔍 DEBUG temporaire : liste des dates avec source (paidAt / date / createdAt) pour vérification fiscale
    const debugPaidAtDates: { date: string; source: 'paidAt' | 'date' | 'createdAt' }[] = [];
    
    for (const transaction of transactions) {
      // ✅ Règle DGFiP : année fiscale = année d'encaissement (paymentDate). Filtre défensif.
      const fiscalDate = transaction.paidAt ?? transaction.date ?? transaction.createdAt;
      const fiscalYear = new Date(fiscalDate).getFullYear();
      if (fiscalYear !== year) continue;
      
      const dateStr = typeof fiscalDate === 'string' ? fiscalDate.split('T')[0] : new Date(fiscalDate).toISOString().split('T')[0];
      const source: 'paidAt' | 'date' | 'createdAt' = transaction.paidAt ? 'paidAt' : transaction.date ? 'date' : 'createdAt';
      debugPaidAtDates.push({ date: dateStr, source });
      
      const montant = Math.abs(transaction.amount);  // Toujours positif pour les calculs
      const natureCode = transaction.nature || '';
      const nature = natures.get(natureCode);
      
      if (!nature) {
        console.warn(`⚠️ Nature inconnue: ${natureCode} pour transaction ${transaction.label}`);
        continue;
      }
      
      // ✅ Filtrer par FLOW (RECETTE/DEPENSE ou INCOME/EXPENSE) et non par signe du montant
      const flowUpper = (nature.flow || '').toUpperCase();
      const isRecette = flowUpper === 'RECETTE' || flowUpper === 'INCOME';
      const isDepense = flowUpper === 'DEPENSE' || flowUpper === 'EXPENSE';
      
      // Récupérer la catégorie pour le breakdown (utiliser slug comme clé unique)
      const categorySlug = transaction.Category?.slug || 'AUTRE';
      const categoryLabel = transaction.Category?.label || 'Autres';
      
      // 🔍 Debug : logger chaque transaction pour voir sa catégorie ET l'objet Category complet
      if (!transaction.Category?.slug) {
        console.warn(`   ⚠️ ${transaction.label}: PAS DE SLUG ! Category =`, transaction.Category);
      }
      console.log(`   🔍 ${transaction.label}: ${categoryLabel} (${categorySlug}) - ${montant.toFixed(2)}€ - Flow: ${flowUpper}`);
      
      if (isRecette) {
        // Recette
        recettesTotales += montant;
        
        // 🆕 Ajouter au breakdown par catégorie
        if (!recettesParCategorie[categorySlug]) {
          recettesParCategorie[categorySlug] = { label: categoryLabel, amount: 0 };
        }
        recettesParCategorie[categorySlug].amount += montant;
        
        // ✅ Identifier les loyers UNIQUEMENT par la CATÉGORIE définie dans les codes système
        // La commission s'applique sur les transactions de la catégorie loyer (pas juste la nature)
        if (categorySlug === systemCodes.rentCategory) {
          recettesLoyer += montant;
        }
      } else if (isDepense) {
        // Dépense - utiliser Category.deductible et Category.capitalizable
        if (transaction.Category?.capitalizable === true) {
          chargesCapitalisables += montant;
        } else if (transaction.Category?.deductible === true) {
          chargesDeductibles += montant;
          
          // 🆕 Ajouter au breakdown par catégorie (seulement les déductibles)
          if (!chargesParCategorie[categorySlug]) {
            chargesParCategorie[categorySlug] = { label: categoryLabel, amount: 0 };
          }
          chargesParCategorie[categorySlug].amount += montant;
        } else {
          // Si catégorie non définie → considérer comme déductible par défaut
          chargesDeductibles += montant;
          
          // 🆕 Ajouter au breakdown
          if (!chargesParCategorie[categorySlug]) {
            chargesParCategorie[categorySlug] = { label: categoryLabel, amount: 0 };
          }
          chargesParCategorie[categorySlug].amount += montant;
        }
      }
    }
    
    // ✅ Résumé concis uniquement
    console.log(`📊 ${property.name}: ${transactions.length} transaction(s) rapprochée(s) → Recettes ${recettesTotales.toFixed(2)}€, Charges ${chargesDeductibles.toFixed(2)}€`);
    console.log(`   📋 Recettes par catégorie:`, Object.entries(recettesParCategorie).map(([code, data]) => `${data.label}: ${data.amount.toFixed(2)}€`).join(', '));
    console.log(`   📋 Charges par catégorie:`, Object.entries(chargesParCategorie).map(([code, data]) => `${data.label}: ${data.amount.toFixed(2)}€`).join(', '));
    
    // 🆕 Calculer les intérêts d'emprunt (passé + projection)
    const interets = await this.calculateLoanInterests(propertyId, year);
    
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
    
    // ✅ Calculer les amortissements pour les biens de catégorie BIC (meublé)
    const fiscalType = this.fiscalTypesCache?.get(typeBien);
    const amortissements = (fiscalType?.category === 'BIC')
      ? await this.calculateAmortizations(propertyId, year)
      : undefined;
    
    // ✅ Suggérer le régime avec données PASSÉES uniquement (cohérent avec les calculs)
    // Note : chargesTotal = charges BDD + intérêts (car Simulator les additionne)
    const chargesTotal = breakdown.passe.chargesDeductibles + breakdown.passe.interetsEmprunt;
    const regimeSuggere = this.suggestRegime(typeBien, breakdown.passe.recettes, chargesTotal, taxParams);
    
    // 🆕 Récupérer le régime choisi sur le bien (s'il existe)
    let regimeChoisi: RegimeFiscal | undefined;
    try {
      // Lire directement fiscalRegimeId
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
    } catch (e) {
      // Ignorer les erreurs de parsing du régime
      console.warn(`[FiscalAggregator] Impossible de parser le régime fiscal du bien ${property.name}:`, e);
    }
    
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
      
      // 🔍 DEBUG temporaire : dates d'encaissement des transactions incluses (pour vérification fiscale)
      _debugPaidAtDates: debugPaidAtDates,
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

