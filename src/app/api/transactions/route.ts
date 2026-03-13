import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { createTransactionServicePrisma } from '@/domain/services/transactionServiceFactory';
import { getGestionSettings, mapTransactionServiceErrorToHttpStatus } from '@/domain/services/transactionServiceHelpers';
// Logs désactivés pour réduire la verbosité
// import { logDebug } from '@/lib/utils/logger';

// Fonction pour normaliser une chaîne (enlever les accents, minuscules)

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

function normalizeString(str: string): string {
  return str
    .normalize('NFD') // Décomposer les caractères accentués
    .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
    .toLowerCase();
}

// Convertir un mois comptable (YYYY-MM) en texte lisible (ex: "2025-02" → "février 2025")
function formatAccountingMonthForSearch(yyyymm: string | null): string {
  if (!yyyymm) return '';
  const [year, month] = yyyymm.split('-');
  const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const monthIndex = parseInt(month) - 1;
  return `${monthNames[monthIndex] || month} ${year}`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { searchParams } = new URL(request.url);
    
    // Paramètres de pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Tri global : appliqué AVANT LIMIT/OFFSET pour cohérence pagination
    const sortBy = searchParams.get('sortBy') || 'accounting_month';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const orderByField = sortBy === 'accountingMonth' ? 'accounting_month' : sortBy;
    const validSortFields = ['accounting_month', 'date', 'amount', 'nature'];
    const orderByKey = validSortFields.includes(orderByField) ? orderByField : 'accounting_month';

    // Paramètres de filtres
    const search = searchParams.get('search') || '';
    const propertyId = searchParams.get('propertyId') || '';
    const leaseId = searchParams.get('leaseId') || '';
    const tenantId = searchParams.get('tenantId') || '';
    const natureId = searchParams.get('natureId') || '';
    const flowFilter = searchParams.get('flow') || ''; // NOUVEAU: filtre par flow (INCOME/EXPENSE)
    const categoryId = searchParams.get('categoryId') || '';
    const amountMin = searchParams.get('amountMin') || '';
    const amountMax = searchParams.get('amountMax') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const hasDocument = searchParams.get('hasDocument') || '';
    const accountingMonthStart = searchParams.get('accountingMonthStart') || '';
    const accountingMonthEnd = searchParams.get('accountingMonthEnd') || '';
    const status = searchParams.get('status') || ''; // rapprochée/non rapprochée
    const groupByParent = searchParams.get('groupByParent') === 'true'; // Vue groupée parent/enfant
    const includeArchived = searchParams.get('includeArchived') === 'true'; // Inclure biens archivés
    const includeManagementFees = searchParams.get('includeManagementFees') !== 'false'; // Inclure frais de gestion (par défaut true)

    // Construction des filtres
    const where: any = { organizationId };

    // NOTE: La recherche textuelle sera appliquée APRÈS la récupération
    // car SQLite + Prisma ne gèrent pas bien les accents avec mode: 'insensitive'
    const searchTerm = search; // Sauvegarde pour filtrage post-requête

    // Filtres spécifiques
    if (propertyId) {
      where.propertyId = propertyId;
    } else if (!includeArchived) {
      // Si pas de bien spécifique, filtrer les biens archivés par défaut
      where.Property = {
        isArchived: false
      };
    }
    if (leaseId) where.leaseId = leaseId;
    if (tenantId) {
      // Filtrer par locataire : trouver les baux de ce locataire
      where.Lease = {
        tenantId: tenantId
      };
    }
    if (categoryId) where.categoryId = categoryId;
    
    // Filtre nature - sera traité après la récupération des natures
    // car nous devons mapper natureId (ex: LOYER) vers natureCode (ex: RECETTE_LOYER)

    // Filtres de montant
    if (amountMin || amountMax) {
      where.amount = {};
      if (amountMin) where.amount.gte = parseFloat(amountMin);
      if (amountMax) where.amount.lte = parseFloat(amountMax);
    }

    // Filtres de date
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    // Filtre de période comptable (accounting_month format YYYY-MM)
    if (accountingMonthStart || accountingMonthEnd) {
      where.accounting_month = {};
      if (accountingMonthStart) {
        where.accounting_month.gte = accountingMonthStart;
        // Log supprimé
      }
      if (accountingMonthEnd) {
        where.accounting_month.lte = accountingMonthEnd;
        // Log supprimé
      }
    }

    // Filtre document (rapprochée/non rapprochée) - sera traité après la récupération des transactions
    // car nous devons utiliser DocumentLink au lieu de la relation documents
    // Le paramètre 'status' peut contenir 'rapprochee' ou 'non_rapprochee'

    
    // Récupération des transactions
    // Fetch all natures to map transaction.nature (code) to its flow and label
    const natures = await prisma.natureEntity.findMany({
      select: {
        code: true,
        label: true,
        flow: true,
      },
    });
    const natureMap = new Map(natures.map(n => [n.code, n]));
    // Log supprimé
    
    // Appliquer le filtre flow si spécifié (INCOME ou EXPENSE)
    if (flowFilter) {
      // Trouver toutes les natures avec ce flow
      const matchingNatures = natures.filter(n => n.flow === flowFilter);
      if (matchingNatures.length > 0) {
        where.nature = { in: matchingNatures.map(n => n.code) };
        // Log supprimé
      } else {
        // Log supprimé
        return NextResponse.json({
          data: [],
          pagination: { page: 1, limit: 50, total: 0, pages: 0 }
        });
      }
    }
    // Appliquer le filtre nature si spécifié (priorité sur flow)
    else if (natureId) {
      // Trouver le natureCode correspondant au natureId
      const matchingNature = natures.find(n => 
        n.code.includes(natureId.toUpperCase()) || 
        n.label.toLowerCase().includes(natureId.toLowerCase())
      );
      if (matchingNature) {
        where.nature = matchingNature.code;
        // Log supprimé
      } else {
        // Log supprimé
        return NextResponse.json({
          data: [],
          pagination: { page: 1, limit: 50, total: 0, pages: 0 }
        });
      }
    }

    // Si recherche textuelle, récupérer TOUTES les transactions (sans pagination)
    // car on doit filtrer côté serveur pour gérer les accents
    const shouldFetchAll = !!searchTerm;
    
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        select: {
          id: true,
          date: true,
          label: true,
          amount: true,
          reference: true,
          paidAt: true,
          method: true,
          notes: true,
          accounting_month: true,
          monthsCovered: true,
          nature: true,
          propertyId: true, // ⚠️ CRITIQUE: Ajouter propertyId pour la sync App Shell
          leaseId: true, // ⚠️ CRITIQUE: Ajouter leaseId pour la sync App Shell
          bailId: true, // ⚠️ CRITIQUE: Ajouter bailId pour la sync App Shell
          categoryId: true, // ⚠️ CRITIQUE: Ajouter categoryId pour la sync App Shell
          // Champs de série pour afficher les badges
          parentTransactionId: true,
          moisIndex: true,
          moisTotal: true,
          // Champs de rapprochement bancaire
          rapprochementStatus: true,
          dateRapprochement: true,
          bankRef: true,
          // ⚙️ GESTION DÉLÉGUÉE: Champs pour afficher le badge "Auto (Gestion)"
          isAuto: true,
          autoSource: true,
          managementCompanyId: true,
          // Champs supplémentaires pour cohérence complète avec IndexedDB
          source: true,
          idempotencyKey: true,
          externalId: true,
          externalType: true,
          montantLoyer: true,
          chargesRecup: true,
          chargesNonRecup: true,
          isAutoAmount: true,
          Property: {
            select: {
              id: true,
              name: true,
              address: true
            }
          },
          Lease_Transaction_leaseIdToLease: {
            select: {
              id: true,
              status: true,
              Tenant: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          Category: {
            select: {
              id: true,
              label: true
            }
          }
        },
        // Tri appliqué sur tout le dataset AVANT skip/take (cohérence pagination)
        orderBy: { [orderByKey]: sortOrder },
        // Ne paginer QUE si pas de recherche textuelle
        ...(!shouldFetchAll && { skip: offset, take: limit })
      }),
      prisma.transaction.count({ where })
    ]);

    // ⚙️ GROUPAGE PARENT/ENFANT: Si groupByParent=true, charger TOUS les enfants ET parents des transactions
    let allTransactions = transactions;
    let childrenCount = 0;
    let parentsCount = 0;
    
    if (groupByParent) {
      // Étape 1: Charger les enfants des transactions initiales
      const parentIds = transactions.map(t => t.id);
      if (parentIds.length > 0) {
        // Log supprimé
        const children = await prisma.transaction.findMany({
          where: {
            parentTransactionId: { in: parentIds },
            organizationId
          },
          select: {
            id: true,
            date: true,
            label: true,
            amount: true,
            reference: true,
            paidAt: true,
            method: true,
            notes: true,
            accounting_month: true,
            monthsCovered: true,
            nature: true,
            propertyId: true, // ⚠️ CRITIQUE: Ajouter propertyId pour la sync App Shell
            leaseId: true, // ⚠️ CRITIQUE: Ajouter leaseId pour la sync App Shell
            bailId: true, // ⚠️ CRITIQUE: Ajouter bailId pour la sync App Shell
            categoryId: true, // ⚠️ CRITIQUE: Ajouter categoryId pour la sync App Shell
            parentTransactionId: true,
            moisIndex: true,
            moisTotal: true,
            rapprochementStatus: true,
            dateRapprochement: true,
            bankRef: true,
            isAuto: true,
            autoSource: true,
            managementCompanyId: true,
            Property: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            Lease_Transaction_leaseIdToLease: {
              select: {
                id: true,
                status: true,
                Tenant: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            Category: {
              select: {
                id: true,
                label: true
              }
            }
          }
        });
        
        if (children.length > 0) {
          // Log supprimé
          // Ajouter les enfants sans doublons
          const existingIds = new Set(allTransactions.map(t => t.id));
          const newChildren = children.filter(c => !existingIds.has(c.id));
          allTransactions = [...allTransactions, ...newChildren];
          childrenCount = newChildren.length;
        }
      }
      
      // Étape 2: Charger les parents des transactions initiales qui sont elles-mêmes des enfants
      const childParentIds = transactions
        .filter(t => t.parentTransactionId)
        .map(t => t.parentTransactionId)
        .filter((id): id is string => id !== null && id !== undefined);
      
      if (childParentIds.length > 0) {
        // Log supprimé
        const parents = await prisma.transaction.findMany({
          where: {
            id: { in: childParentIds },
            organizationId
          },
          select: {
            id: true,
            date: true,
            label: true,
            amount: true,
            reference: true,
            paidAt: true,
            method: true,
            notes: true,
            accounting_month: true,
            monthsCovered: true,
            nature: true,
            propertyId: true, // ⚠️ CRITIQUE: Ajouter propertyId pour la sync App Shell
            leaseId: true, // ⚠️ CRITIQUE: Ajouter leaseId pour la sync App Shell
            bailId: true, // ⚠️ CRITIQUE: Ajouter bailId pour la sync App Shell
            categoryId: true, // ⚠️ CRITIQUE: Ajouter categoryId pour la sync App Shell
            parentTransactionId: true,
            moisIndex: true,
            moisTotal: true,
            rapprochementStatus: true,
            dateRapprochement: true,
            bankRef: true,
            isAuto: true,
            autoSource: true,
            managementCompanyId: true,
            Property: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            Lease_Transaction_leaseIdToLease: {
              select: {
                id: true,
                status: true,
                Tenant: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            },
            Category: {
              select: {
                id: true,
                label: true
              }
            }
          }
        });
        
        if (parents.length > 0) {
          // Log supprimé
          // Ajouter les parents sans doublons
          const existingIds = new Set(allTransactions.map(t => t.id));
          const newParents = parents.filter(p => !existingIds.has(p.id));
          allTransactions = [...allTransactions, ...newParents];
          parentsCount = newParents.length;
        }
      }
    }
    
    // ⚙️ FILTRAGE EN MÉMOIRE: Si on a des filtres flow/status, filtrer les transactions
    let filteredTransactions = allTransactions;
    let filteredTransactionsBeforePagination = allTransactions; // Sauvegarder pour calcul des sommes
    if (groupByParent && (flowFilter || status)) {
      // Log supprimé
      
      // Étape 1: Identifier les transactions qui correspondent aux filtres
      const matchingTransactionIds = new Set<string>();
      allTransactions.forEach(t => {
        const matchesFlow = !flowFilter || (natureMap.get(t.nature)?.flow === flowFilter);
        const matchesStatus = !status || (t.rapprochementStatus === status);
        
        if (matchesFlow && matchesStatus) {
          matchingTransactionIds.add(t.id);
        }
      });
      
      // Log supprimé
      
      // Étape 2: Inclure les parents des transactions correspondantes (pour contexte visuel)
      const parentIdsToInclude = new Set<string>();
      allTransactions.forEach(t => {
        if (matchingTransactionIds.has(t.id) && t.parentTransactionId) {
          parentIdsToInclude.add(t.parentTransactionId);
        }
      });
      
      // Log supprimé
      
      // Étape 3: Filtrer pour ne garder que les transactions correspondantes + leurs parents
      filteredTransactions = allTransactions.filter(t => 
        matchingTransactionIds.has(t.id) || parentIdsToInclude.has(t.id)
      );
      filteredTransactionsBeforePagination = filteredTransactions; // Sauvegarder avant pagination
      
      // Logs supprimés
    }
    
    let filteredTotal = groupByParent && (flowFilter || status) ? filteredTransactions.length : (total + childrenCount + parentsCount);
    // Log supprimé
    
    if (searchTerm) {
      const normalizedSearch = normalizeString(searchTerm);
      // Log supprimé
      
      filteredTransactions = allTransactions.filter(transaction => {
        const normalizedLabel = normalizeString(transaction.label || '');
        const normalizedNotes = normalizeString(transaction.notes || '');
        const normalizedReference = normalizeString(transaction.reference || '');
        
        // Recherche dans le mois comptable (format texte + format brut)
        const accountingMonthText = formatAccountingMonthForSearch(transaction.accountingMonth);
        const normalizedAccountingMonth = normalizeString(accountingMonthText);
        const normalizedAccountingMonthRaw = normalizeString(transaction.accountingMonth || '');
        
        const match = normalizedLabel.includes(normalizedSearch) || 
                      normalizedNotes.includes(normalizedSearch) ||
                      normalizedReference.includes(normalizedSearch) ||
                      normalizedAccountingMonth.includes(normalizedSearch) ||
                      normalizedAccountingMonthRaw.includes(normalizedSearch);
        
        if (match) {
          // Log supprimé
        }
        
        return match;
      });
      
      // Inclure les parents des transactions enfants trouvées (pour la vue groupée)
      const parentIds = new Set<string>();
      filteredTransactions.forEach(t => {
        if (t.parentTransactionId && t.parentTransactionId !== t.id) {
          parentIds.add(t.parentTransactionId);
        }
      });
      
      if (parentIds.size > 0) {
        // Log supprimé
        const parents = allTransactions.filter(t => parentIds.has(t.id));
        // Ajouter les parents aux résultats (sans doublons)
        const existingIds = new Set(filteredTransactions.map(t => t.id));
        parents.forEach(parent => {
          if (!existingIds.has(parent.id)) {
            filteredTransactions.push(parent);
          }
        });
      }
      
      filteredTotal = filteredTransactions.length; // Total AVANT pagination manuelle
      // Log supprimé
      
      // Appliquer la pagination manuellement après le filtrage
      filteredTransactions = filteredTransactions.slice(offset, offset + limit);
      // Log supprimé
    } else if (!searchTerm && (groupByParent && (flowFilter || status))) {
      // Pagination pour vue groupée avec filtres (sans recherche textuelle)
      // Log supprimé
      filteredTransactions = filteredTransactions.slice(offset, offset + limit);
      // Log supprimé
    }
    
    // Calculer les sommes totales sur toutes les transactions filtrées (avant pagination)
    // Pour cela, on doit récupérer TOUTES les transactions filtrées (sans pagination)
    // car allTransactions peut être paginé si shouldFetchAll est false
    let transactionsForSumCalculation: typeof allTransactions = [];
    
    // Récupérer toutes les transactions filtrées (sans pagination) pour le calcul des sommes
    const allFilteredTransactions = await prisma.transaction.findMany({
      where,
      select: {
        id: true,
        amount: true,
        nature: true,
        autoSource: true,
        parentTransactionId: true,
        accounting_month: true,
        rapprochementStatus: true,
        label: true,
        notes: true,
        reference: true
      },
      // Pas de pagination pour le calcul des sommes
    });
    
    // Appliquer les filtres en mémoire (recherche textuelle, flow, status)
    let filteredForSum = allFilteredTransactions;
    
    // Filtre par recherche textuelle
    if (searchTerm) {
      const normalizedSearch = normalizeString(searchTerm);
      filteredForSum = filteredForSum.filter(transaction => {
        const normalizedLabel = normalizeString(transaction.label || '');
        const normalizedNotes = normalizeString(transaction.notes || '');
        const normalizedReference = normalizeString(transaction.reference || '');
        const accountingMonthText = formatAccountingMonthForSearch(transaction.accounting_month || '');
        const normalizedAccountingMonth = normalizeString(accountingMonthText);
        const normalizedAccountingMonthRaw = normalizeString(transaction.accounting_month || '');
        
        return normalizedLabel.includes(normalizedSearch) || 
               normalizedNotes.includes(normalizedSearch) ||
               normalizedReference.includes(normalizedSearch) ||
               normalizedAccountingMonth.includes(normalizedSearch) ||
               normalizedAccountingMonthRaw.includes(normalizedSearch);
      });
      
      // Inclure les parents si groupByParent
      if (groupByParent) {
        const parentIds = new Set<string>();
        filteredForSum.forEach(t => {
          if (t.parentTransactionId && t.parentTransactionId !== t.id) {
            parentIds.add(t.parentTransactionId);
          }
        });
        if (parentIds.size > 0) {
          const parents = allFilteredTransactions.filter(t => parentIds.has(t.id));
          const existingIds = new Set(filteredForSum.map(t => t.id));
          parents.forEach(parent => {
            if (!existingIds.has(parent.id)) {
              filteredForSum.push(parent);
            }
          });
        }
      }
    }
    
    // Appliquer les filtres flow et status
    if (flowFilter || status) {
      filteredForSum = filteredForSum.filter(t => {
        const matchesFlow = !flowFilter || (natureMap.get(t.nature)?.flow === flowFilter);
        const matchesStatus = !status || (t.rapprochementStatus === status);
        return matchesFlow && matchesStatus;
      });
      
      // Inclure les parents si groupByParent
      if (groupByParent) {
        const parentIds = new Set<string>();
        filteredForSum.forEach(t => {
          if (t.parentTransactionId && t.parentTransactionId !== t.id) {
            parentIds.add(t.parentTransactionId);
          }
        });
        if (parentIds.size > 0) {
          const parents = allFilteredTransactions.filter(t => parentIds.has(t.id));
          const existingIds = new Set(filteredForSum.map(t => t.id));
          parents.forEach(parent => {
            if (!existingIds.has(parent.id)) {
              filteredForSum.push(parent);
            }
          });
        }
      }
    }
    
    transactionsForSumCalculation = filteredForSum;
    
    let positiveSum = 0;
    let negativeSum = 0;
    transactionsForSumCalculation.forEach(transaction => {
      // Exclure les transactions de gestion si includeManagementFees est false
      if (!includeManagementFees && transaction.autoSource === 'gestion') {
        return;
      }
      
      const natureData = natureMap.get(transaction.nature);
      if (natureData) {
        const adjustedAmount = natureData.flow === 'INCOME' 
          ? Math.abs(transaction.amount) 
          : -Math.abs(transaction.amount);
        
        if (adjustedAmount > 0) {
          positiveSum += adjustedAmount;
        } else if (adjustedAmount < 0) {
          negativeSum += Math.abs(adjustedAmount); // Stocker la valeur absolue
        }
      }
    });
    
    const transactionIds = filteredTransactions.map(t => t.id);
    const documentLinks = await prisma.documentLink.findMany({
      where: {
        linkedType: 'transaction',
        linkedId: { in: transactionIds }
      },
      include: {
        Document: {
          select: {
            id: true,
            filenameOriginal: true,
            url: true,
            createdAt: true,
            documentTypeId: true,
            detectedTypeId: true,
            DocumentType: {
              select: {
                label: true
              }
            }
          }
        }
      }
    });

    // Grouper les liens par transaction
    const linksByTransaction = new Map();
    documentLinks.forEach(link => {
      if (!linksByTransaction.has(link.linkedId)) {
        linksByTransaction.set(link.linkedId, []);
      }
      // Transformer le document pour correspondre à l'interface
      const transformedDocument = {
        id: link.Document.id,
        name: link.Document.filenameOriginal,
        type: link.Document.DocumentType?.label || 'Non classé',
        createdAt: link.Document.createdAt.toISOString()
      };
      linksByTransaction.get(link.linkedId).push(transformedDocument);
    });

    // Appliquer le filtre de statut (rapprochée/non rapprochée) sur les transactions déjà filtrées
    // SEULEMENT si on n'a pas déjà fait le filtrage en mémoire (groupByParent)
    const statusFilter = status;
    const alreadyFilteredInMemory = groupByParent && (flowFilter || status);
    
    if (statusFilter && !alreadyFilteredInMemory) {
      if (statusFilter === 'rapprochee') {
        filteredTransactions = filteredTransactions.filter(t => t.rapprochementStatus === 'rapprochee');
        filteredTotal = filteredTransactions.length;
        // Log supprimé
      } else if (statusFilter === 'non_rapprochee') {
        filteredTransactions = filteredTransactions.filter(t => t.rapprochementStatus === 'non_rapprochee');
        filteredTotal = filteredTransactions.length;
        // Log supprimé
      }
    } else if (alreadyFilteredInMemory) {
      // Log supprimé
    }
    
    // Filtre hasDocument (séparé du statut de rapprochement)
    // NE PAS appliquer si on est en vue groupée avec filtres, car cela retire les parents pour le contexte
    if (hasDocument && !alreadyFilteredInMemory) {
      if (hasDocument === 'true') {
        filteredTransactions = filteredTransactions.filter(t => (linksByTransaction.get(t.id) || []).length > 0);
        filteredTotal = filteredTransactions.length;
        // Log supprimé
      } else if (hasDocument === 'false') {
        filteredTransactions = filteredTransactions.filter(t => (linksByTransaction.get(t.id) || []).length === 0);
        filteredTotal = filteredTransactions.length;
        // Log supprimé
      }
    } else if (hasDocument && alreadyFilteredInMemory) {
      // Log supprimé
    }


    // Logs supprimés
    
    // Transformation des données
    // Créer un Map des transactions par ID pour hériter accountingMonth des parents
    const transactionsMap = new Map(filteredTransactions.map(t => [t.id, t]));
    
    const transformedTransactions = filteredTransactions.map(transaction => {
      const natureData = natureMap.get(transaction.nature); // Get nature object using code
      const natureType = transaction.nature?.includes('RECETTE') ? 'RECETTE' : 'DEPENSE'; // Determine type from code
      const natureLabel = natureData?.label || transaction.nature;
      
      // Récupérer les documents liés à cette transaction
      const linkedDocuments = linksByTransaction.get(transaction.id) || [];

      // Log supprimé pour réduire la verbosité

      return {
        id: transaction.id,
        organizationId: organizationId, // ⚠️ CRITIQUE: Ajouter organizationId pour la sync App Shell
        propertyId: transaction.propertyId, // ⚠️ CRITIQUE: Ajouter propertyId pour la sync App Shell
        leaseId: transaction.leaseId || null, // ⚠️ CRITIQUE: Ajouter leaseId pour la sync App Shell
        bailId: transaction.bailId || null, // ⚠️ CRITIQUE: Ajouter bailId pour la sync App Shell
        categoryId: transaction.categoryId || null, // ⚠️ CRITIQUE: Ajouter categoryId pour la sync App Shell
        date: transaction.date.toISOString().split('T')[0],
        label: transaction.label,
        Property: transaction.Property,
        lease: transaction.Lease_Transaction_leaseIdToLease,
        tenant: transaction.Lease_Transaction_leaseIdToLease?.Tenant || null,
        nature: {
          id: transaction.nature || '', // Use code as ID
          label: natureLabel,
          type: natureType
        },
        Category: transaction.Category,
        amount: transaction.amount,
        reference: transaction.reference || '',
        paymentDate: transaction.paidAt?.toISOString().split('T')[0],
        paymentMethod: transaction.method || '',
        paidAt: transaction.paidAt?.toISOString().split('T')[0],
        method: transaction.method || '',
        notes: transaction.notes || '',
        accountingMonth: transaction.accounting_month || 
          // Si pas de mois comptable ET c'est une transaction fille, hériter du parent
          (transaction.parentTransactionId && transactionsMap.has(transaction.parentTransactionId)
            ? transactionsMap.get(transaction.parentTransactionId)!.accounting_month || ''
            : ''),
        monthsCovered: transaction.monthsCovered ? parseInt(transaction.monthsCovered) : 1,
        autoDistribution: false,
        hasDocument: linkedDocuments.length > 0,
        documentsCount: linkedDocuments.length,
        status: transaction.rapprochementStatus === 'rapprochee' ? 'rapprochee' as const : 'nonRapprochee' as const,
        rapprochementStatus: transaction.rapprochementStatus,
        dateRapprochement: transaction.dateRapprochement?.toISOString() || null,
        bankRef: transaction.bankRef || null,
        documents: linkedDocuments,
        // IMPORTANT: Conserver les champs de série
        parentTransactionId: transaction.parentTransactionId,
        moisIndex: transaction.moisIndex,
        moisTotal: transaction.moisTotal,
        // ⚙️ GESTION DÉLÉGUÉE: Champs pour le badge "Auto (Gestion)"
        isAuto: transaction.isAuto,
        autoSource: transaction.autoSource,
        managementCompanyId: transaction.managementCompanyId,
        // ⚠️ CRITIQUE SYNC APP-SHELL: Inclure les champs utilisés par transformToLocal (sinon overwrite écrase avec null)
        montantLoyer: transaction.montantLoyer ?? null,
        chargesRecup: transaction.chargesRecup ?? null,
        chargesNonRecup: transaction.chargesNonRecup ?? null,
        isAutoAmount: transaction.isAutoAmount ?? null,
        // Pour la sync: nature en clé string (transformToLocal utilise item.nature string ou item.nature.id)
        accounting_month: transaction.accounting_month ?? null,
      };
    });

    return NextResponse.json({
      data: transformedTransactions,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        pages: Math.ceil(filteredTotal / limit)
      },
      sums: {
        positiveSum,
        negativeSum
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des transactions:', error);
    console.error('Stack trace:', error.stack);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des transactions', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const body = await request.json();

    // Validation basique du payload (validation métier dans TransactionService)
    if (!body.propertyId) {
      return NextResponse.json({ error: 'PropertyId est requis' }, { status: 400 });
    }
    if (!body.nature && !body.natureId) {
      return NextResponse.json({ error: 'Nature est requise' }, { status: 400 });
    }
    if (!body.categoryId) {
      return NextResponse.json({ error: 'CategoryId est requis' }, { status: 400 });
    }
    if (!body.amount) {
      return NextResponse.json({ error: 'Amount est requis' }, { status: 400 });
    }
    const paidAtValue = body.paidAt ?? body.paymentDate;
    if (!paidAtValue || (typeof paidAtValue === 'string' && !paidAtValue.trim())) {
      return NextResponse.json({ error: 'La date de paiement est obligatoire.' }, { status: 400 });
    }

    // Extraire les documentIds depuis stagedLinkItemIds (UploadStagedItem → Document)
    let stagedLinkDocumentIds: string[] = [];
    if (body.stagedLinkItemIds && body.stagedLinkItemIds.length > 0) {
      const stagedLinks = await prisma.uploadStagedItem.findMany({
        where: {
          id: { in: body.stagedLinkItemIds },
          kind: 'link',
          organizationId,
        },
        include: {
          Document: {
            select: {
              id: true,
            },
          },
        },
      });
      
      stagedLinkDocumentIds = stagedLinks
        .filter(item => item.Document)
        .map(item => item.Document!.id);
    }

    // Récupérer les settings de gestion déléguée
    const gestionSettings = await getGestionSettings();

    // Créer TransactionService avec repos Prisma
    const transactionService = createTransactionServicePrisma();

    // Construire accountingMonth à partir des champs de période
    let accountingMonth: string | null = null;
    if (body.accountingMonth) {
      accountingMonth = body.accountingMonth;
    } else if (body.periodStart) {
      accountingMonth = body.periodStart;
    } else if (body.periodMonth && body.periodYear) {
      const month = String(body.periodMonth).padStart(2, '0');
      accountingMonth = `${body.periodYear}-${month}`;
    }

    // Appeler TransactionService (logique métier centralisée)
    const result = await transactionService.createTransaction({
      organizationId,
      propertyId: body.propertyId,
      leaseId: body.leaseId || null,
      bailId: body.bailId || null,
      categoryId: body.categoryId,
      natureId: body.natureId,
      nature: body.nature,
      label: body.label || 'Transaction',
      amount: parseFloat(body.amount),
      date: body.date,
      reference: body.reference || null,
      notes: body.notes || null,
      paidAt: body.paidAt || body.paymentDate || null,
      method: body.method || body.paymentMethod || null,
      accountingMonth: accountingMonth || null,
      periodStart: body.periodStart || null,
      periodMonth: body.periodMonth || null,
      periodYear: body.periodYear || null,
      monthsCovered: body.monthsCovered || 1,
      rapprochementStatus: body.rapprochementStatus || 'non_rapprochee',
      bankRef: body.bankRef || null,
      montantLoyer: body.montantLoyer != null && body.montantLoyer !== '' ? parseFloat(String(body.montantLoyer)) : null,
      chargesRecup: body.chargesRecup != null && body.chargesRecup !== '' ? parseFloat(String(body.chargesRecup)) : null,
      chargesNonRecup: body.chargesNonRecup != null && body.chargesNonRecup !== '' ? parseFloat(String(body.chargesNonRecup)) : null,
      isAutoAmount: body.isAutoAmount !== undefined ? body.isAutoAmount : null,
      stagedDocumentIds: body.stagedDocumentIds || [],
      stagedLinkItemIds: stagedLinkDocumentIds, // DocumentIds extraits depuis UploadStagedItem
      factures: body.factures || undefined,
      ...gestionSettings,
    });

    // Gestion spécifique API : Migration des fichiers (tmp/ → documents/)
    // TransactionService a déjà créé les liens DocumentLink, on migre juste les fichiers
    if (body.stagedDocumentIds && body.stagedDocumentIds.length > 0) {
      const { getStorageService } = await import('@/services/storage.service');
      const storageService = getStorageService();
      
      // Finaliser chaque document : migrer de tmp/ vers documents/
      for (const docId of body.stagedDocumentIds) {
        const doc = await prisma.document.findFirst({
          where: { id: docId, organizationId },
          select: {
            id: true,
            bucketKey: true,
            filenameOriginal: true,
            fileName: true,
            mime: true
          }
        });
        
        if (!doc || !doc.bucketKey) {
          continue;
        }
        
        // Si le bucketKey est déjà dans documents/, pas besoin de migrer
        if (doc.bucketKey.startsWith('documents/')) {
          continue;
        }
        
        // Lire le fichier temporaire
        let fileBuffer: Buffer;
        try {
          fileBuffer = await storageService.downloadDocument(doc.bucketKey);
        } catch (error: any) {
          console.error(`[API] Erreur lecture fichier temporaire pour ${docId}:`, error);
          continue;
        }
        
        // Générer le nom de fichier final
        const fileExtension = doc.filenameOriginal?.split('.').pop() || 'pdf';
        const finalFilename = `${doc.id}.${fileExtension}`;
        
        // Upload vers le stockage permanent
        try {
          const uploadResult = await storageService.uploadDocument(
            fileBuffer,
            doc.id,
            finalFilename,
            doc.mime || 'application/octet-stream'
          );
          
          // Supprimer l'ancien fichier temporaire
          try {
            await storageService.deleteDocument(doc.bucketKey);
          } catch (deleteError) {
            console.warn(`[API] Impossible de supprimer l'ancien fichier ${doc.bucketKey}:`, deleteError);
          }
          
          // Mettre à jour le document avec le nouveau bucketKey
          await prisma.document.update({
            where: { id: doc.id },
            data: {
              bucketKey: uploadResult.key,
              url: `/api/documents/${doc.id}/file`
            }
          });
        } catch (uploadError: any) {
          console.error(`[API] ❌ Erreur upload document final pour ${docId}:`, uploadError);
        }
      }
    }

    // Supprimer les UploadStagedItem après traitement (TransactionService a déjà créé les liens)
    if (body.stagedLinkItemIds && body.stagedLinkItemIds.length > 0) {
      await prisma.uploadStagedItem.deleteMany({
        where: { id: { in: body.stagedLinkItemIds } }
      });
    }

    // Construire le message de succès avec les mois créés
    let successMessage = 'Transaction créée avec succès';
    if (result.totalCreated > 1) {
      const months = result.allTransactions
        .filter(tx => tx.accounting_month) // Filtrer les transactions sans mois comptable
        .map(tx => {
          const [year, month] = (tx.accounting_month || '').split('-');
          const monthNames = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
          const monthName = monthNames[parseInt(month) - 1];
          return monthName ? `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}` : '';
        })
        .filter(Boolean);
      
      if (months.length > 0) {
        successMessage = `${result.totalCreated} transactions créées (${months.join(', ')})`;
      } else {
        successMessage = `${result.totalCreated} transactions créées`;
      }
    }

    return NextResponse.json({
      transaction: result.transaction,
      totalCreated: result.totalCreated,
      allTransactions: result.allTransactions,
      successMessage
    });

  } catch (error: any) {
    console.error('Erreur lors de la création de la transaction:', error);
    
    // Mapper l'erreur TransactionService vers le bon status HTTP
    const status = mapTransactionServiceErrorToHttpStatus(error);
    const errorMessage = error.message || 'Erreur lors de la création de la transaction';
    
    return NextResponse.json(
      { error: errorMessage },
      { status }
    );
  }
}