import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addMonthsYYYYMM, formatMonthlyLabel, extractBaseLabel } from '@/lib/utils/monthUtils';
import { createManagementCommission } from '@/lib/services/managementCommissionService';

// Fonction pour normaliser une chaîne (enlever les accents, minuscules)
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
    const { searchParams } = new URL(request.url);
    
    // Paramètres de pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

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

    // Construction des filtres
    const where: any = {};

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
        console.log('[API] Filtre période comptable début:', accountingMonthStart);
      }
      if (accountingMonthEnd) {
        where.accounting_month.lte = accountingMonthEnd;
        console.log('[API] Filtre période comptable fin:', accountingMonthEnd);
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
    console.log('[API] Natures chargées:', natures.length, 'natures');
    
    // Appliquer le filtre flow si spécifié (INCOME ou EXPENSE)
    if (flowFilter) {
      // Trouver toutes les natures avec ce flow
      const matchingNatures = natures.filter(n => n.flow === flowFilter);
      if (matchingNatures.length > 0) {
        where.nature = { in: matchingNatures.map(n => n.code) };
        console.log(`[API] Filtre flow appliqué: ${flowFilter} -> ${matchingNatures.length} natures`);
      } else {
        console.log(`[API] Aucune nature trouvée pour flow: ${flowFilter}`);
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
        console.log(`[API] Filtre nature appliqué: ${natureId} -> ${matchingNature.code}`);
      } else {
        console.log(`[API] Nature non trouvée pour: ${natureId}`);
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
        orderBy: { date: 'desc' },
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
        console.log(`[API GROUPAGE] Recherche des enfants pour ${parentIds.length} parents...`);
        const children = await prisma.transaction.findMany({
          where: {
            parentTransactionId: { in: parentIds }
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
          console.log(`[API GROUPAGE] ${children.length} enfants trouvés et ajoutés aux résultats`);
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
        console.log(`[API GROUPAGE] Recherche des parents pour ${childParentIds.length} enfants...`);
        const parents = await prisma.transaction.findMany({
          where: {
            id: { in: childParentIds }
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
          console.log(`[API GROUPAGE] ${parents.length} parents trouvés et ajoutés aux résultats`);
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
    if (groupByParent && (flowFilter || status)) {
      console.log(`[API FILTRAGE] Application des filtres en mémoire: flow=${flowFilter}, status=${status}`);
      
      // Étape 1: Identifier les transactions qui correspondent aux filtres
      const matchingTransactionIds = new Set<string>();
      allTransactions.forEach(t => {
        const matchesFlow = !flowFilter || (natureMap.get(t.nature)?.flow === flowFilter);
        const matchesStatus = !status || (t.rapprochementStatus === status);
        
        if (matchesFlow && matchesStatus) {
          matchingTransactionIds.add(t.id);
        }
      });
      
      console.log(`[API FILTRAGE] ${matchingTransactionIds.size} transactions correspondent aux filtres`);
      
      // Étape 2: Inclure les parents des transactions correspondantes (pour contexte visuel)
      const parentIdsToInclude = new Set<string>();
      allTransactions.forEach(t => {
        if (matchingTransactionIds.has(t.id) && t.parentTransactionId) {
          parentIdsToInclude.add(t.parentTransactionId);
        }
      });
      
      console.log(`[API FILTRAGE] ${parentIdsToInclude.size} parents à inclure pour le contexte`);
      
      // Étape 3: Filtrer pour ne garder que les transactions correspondantes + leurs parents
      filteredTransactions = allTransactions.filter(t => 
        matchingTransactionIds.has(t.id) || parentIdsToInclude.has(t.id)
      );
      
      console.log(`[API FILTRAGE] ${filteredTransactions.length} transactions après filtrage (avec parents)`);
      console.log(`[API FILTRAGE] IDs des transactions filtrées:`, filteredTransactions.map(t => ({ id: t.id, label: t.label, nature: t.nature })));
    }
    
    let filteredTotal = groupByParent && (flowFilter || status) ? filteredTransactions.length : (total + childrenCount + parentsCount);
    console.log(`[API] filteredTotal calculé: ${filteredTotal}, groupByParent: ${groupByParent}, flowFilter: ${flowFilter}, status: ${status}, childrenCount: ${childrenCount}, parentsCount: ${parentsCount}`);
    
    if (searchTerm) {
      const normalizedSearch = normalizeString(searchTerm);
      console.log('[API SEARCH] Recherche avec:', searchTerm, '(normalisé:', normalizedSearch + ')');
      
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
          console.log('[API SEARCH] Match trouvé:', transaction.label);
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
        console.log(`[API SEARCH] Chargement de ${parentIds.size} parents pour la vue groupée`);
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
      console.log(`[API SEARCH] ${filteredTotal} transactions trouvées après filtrage (avec parents)`);
      
      // Appliquer la pagination manuellement après le filtrage
      filteredTransactions = filteredTransactions.slice(offset, offset + limit);
      console.log(`[API SEARCH] ${filteredTransactions.length} transactions après pagination`);
    } else if (!searchTerm && (groupByParent && (flowFilter || status))) {
      // Pagination pour vue groupée avec filtres (sans recherche textuelle)
      console.log(`[API PAGINATION GROUPÉE] ${filteredTransactions.length} transactions avant pagination`);
      filteredTransactions = filteredTransactions.slice(offset, offset + limit);
      console.log(`[API PAGINATION GROUPÉE] ${filteredTransactions.length} transactions après pagination`);
    }
    
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
        console.log('[API] Filtre rapprochée appliqué:', filteredTotal, 'transactions');
      } else if (statusFilter === 'non_rapprochee') {
        filteredTransactions = filteredTransactions.filter(t => t.rapprochementStatus === 'non_rapprochee');
        filteredTotal = filteredTransactions.length;
        console.log('[API] Filtre non rapprochée appliqué:', filteredTotal, 'transactions');
      }
    } else if (alreadyFilteredInMemory) {
      console.log('[API] Filtrage de statut déjà effectué en mémoire, skip');
    }
    
    // Filtre hasDocument (séparé du statut de rapprochement)
    // NE PAS appliquer si on est en vue groupée avec filtres, car cela retire les parents pour le contexte
    if (hasDocument && !alreadyFilteredInMemory) {
      if (hasDocument === 'true') {
        filteredTransactions = filteredTransactions.filter(t => (linksByTransaction.get(t.id) || []).length > 0);
        filteredTotal = filteredTransactions.length;
        console.log('[API] Filtre avec documents appliqué:', filteredTotal, 'transactions');
      } else if (hasDocument === 'false') {
        filteredTransactions = filteredTransactions.filter(t => (linksByTransaction.get(t.id) || []).length === 0);
        filteredTotal = filteredTransactions.length;
        console.log('[API] Filtre sans documents appliqué:', filteredTotal, 'transactions');
      }
    } else if (hasDocument && alreadyFilteredInMemory) {
      console.log('[API] Filtrage hasDocument skip en vue groupée (pour préserver les parents pour contexte)');
    }


    console.log(`[API AVANT TRANSFORMATION] ${filteredTransactions.length} transactions à transformer`);
    console.log(`[API AVANT TRANSFORMATION] IDs:`, filteredTransactions.map(t => t.id));
    
    // Transformation des données
    // Créer un Map des transactions par ID pour hériter accountingMonth des parents
    const transactionsMap = new Map(filteredTransactions.map(t => [t.id, t]));
    
    const transformedTransactions = filteredTransactions.map(transaction => {
      const natureData = natureMap.get(transaction.nature); // Get nature object using code
      const natureType = transaction.nature?.includes('RECETTE') ? 'RECETTE' : 'DEPENSE'; // Determine type from code
      const natureLabel = natureData?.label || transaction.nature;
      
      // Récupérer les documents liés à cette transaction
      const linkedDocuments = linksByTransaction.get(transaction.id) || [];

      console.log('[API] Transaction nature debug:', {
        id: transaction.id,
        natureCode: transaction.nature, // This is the code
        natureType: natureType,
        natureLabel: natureLabel,
        amount: transaction.amount,
        hasDocument: linkedDocuments.length > 0
      });

      return {
        id: transaction.id,
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
        managementCompanyId: transaction.managementCompanyId
      };
    });

    return NextResponse.json({
      data: transformedTransactions,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        pages: Math.ceil(filteredTotal / limit)
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
    const body = await request.json();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🆕 [API POST] CRÉATION TRANSACTION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[API] Données reçues:', {
      stagedDocumentIds: body.stagedDocumentIds,
      stagedLinkItemIds: body.stagedLinkItemIds,
      hasStagedDocuments: !!(body.stagedDocumentIds && body.stagedDocumentIds.length > 0),
      hasStagedLinks: !!(body.stagedLinkItemIds && body.stagedLinkItemIds.length > 0),
      nature: body.nature,
      natureId: body.natureId,
      categoryId: body.categoryId,
      propertyId: body.propertyId,
      amount: body.amount
    });
    console.log('[API] 💰 GESTION DÉLÉGUÉE - Breakdown loyer:', {
      montantLoyer: body.montantLoyer,
      chargesRecup: body.chargesRecup,
      chargesNonRecup: body.chargesNonRecup,
      isAutoAmount: body.isAutoAmount
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Validation des données requises
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

    // Vérifier que la catégorie existe
    const category = await prisma.category.findUnique({
      where: { id: body.categoryId },
      select: { id: true, label: true, type: true }
    });
    
    if (!category) {
      return NextResponse.json({ error: 'Catégorie introuvable' }, { status: 400 });
    }

    console.log('[API] Catégorie validée:', category);

    // Construire accountingMonth à partir des champs de période
    let accountingMonth = null;
    if (body.accountingMonth) {
      accountingMonth = body.accountingMonth;
    } else if (body.periodStart) {
      accountingMonth = body.periodStart;
    } else if (body.periodMonth && body.periodYear) {
      // Construire à partir de periodMonth et periodYear
      const month = String(body.periodMonth).padStart(2, '0');
      const year = body.periodYear;
      accountingMonth = `${year}-${month}`;
    }

    console.log('[API] Champs de période:', {
      accountingMonth,
      periodStart: body.periodStart,
      periodMonth: body.periodMonth,
      periodYear: body.periodYear,
      monthsCovered: body.monthsCovered
    });

    // Extraire le baseLabel propre (sans les dates/mois qui peuvent déjà être présents)
    const rawLabel = body.label || 'Transaction';
    const baseLabel = extractBaseLabel(rawLabel);
    const startMonth = accountingMonth || `${body.periodYear}-${String(body.periodMonth).padStart(2, '0')}`;
    
    console.log('[API] Label processing:', {
      rawLabel,
      baseLabel,
      startMonth
    });
    
    // Utiliser une transaction Prisma pour garantir la cohérence (timeout augmenté)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Créer les transactions (1 ou N selon monthsCovered)
      const monthsCovered = body.monthsCovered ? parseInt(body.monthsCovered) : 1;
      const transactions = [];

      for (let i = 0; i < monthsCovered; i++) {
        // Calculer la période pour ce mois (YYYY-MM)
        const currentMonth = addMonthsYYYYMM(startMonth, i);
        
        // Générer le libellé avec le mois/année correspondant
        const label = formatMonthlyLabel(baseLabel, currentMonth);

        const transaction = await tx.transaction.create({
          data: {
            Property: {
              connect: { id: body.propertyId }
            },
            Lease_Transaction_leaseIdToLease: body.leaseId ? {
              connect: { id: body.leaseId }
            } : undefined,
            Lease_Transaction_bailIdToLease: body.bailId ? {
              connect: { id: body.bailId }
            } : undefined,
            date: new Date(body.date),
            nature: body.natureId || body.nature, // Support both formats for compatibility
            Category: {
              connect: { id: body.categoryId }
            },
            label: label,
            amount: parseFloat(body.amount),
            reference: body.reference || null,
            notes: body.notes || null,
            // Champs de paiement
            paidAt: body.paidAt ? new Date(body.paidAt) : (body.paymentDate ? new Date(body.paymentDate) : null),
            method: body.method || body.paymentMethod || null,
            // Champs de période - utiliser la période calculée
            accounting_month: currentMonth,
            monthsCovered: body.monthsCovered ? String(body.monthsCovered) : '1',
            // Champs de série : AUCUN lien entre les loyers récurrents
            // Chaque loyer est un parent indépendant, seules les commissions auront un parentTransactionId
            parentTransactionId: null,
            moisIndex: monthsCovered > 1 ? i + 1 : null,
            moisTotal: monthsCovered > 1 ? monthsCovered : null,
            // Champs de rapprochement
            rapprochementStatus: body.rapprochementStatus || 'non_rapprochee',
            dateRapprochement: body.rapprochementStatus === 'rapprochee' ? new Date() : null,
            bankRef: body.bankRef || null,
            // Gestion déléguée - Breakdown loyer
            montantLoyer: body.montantLoyer ? parseFloat(body.montantLoyer) : null,
            chargesRecup: body.chargesRecup ? parseFloat(body.chargesRecup) : null,
            chargesNonRecup: body.chargesNonRecup ? parseFloat(body.chargesNonRecup) : null,
            isAutoAmount: body.isAutoAmount !== undefined ? body.isAutoAmount : null
          },
          include: {
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
        
        console.log('[API] ✅ Transaction créée:', {
          id: transaction.id,
          isAutoAmount: transaction.isAutoAmount,
          montantLoyer: transaction.montantLoyer,
          chargesRecup: transaction.chargesRecup
        });
        
        transactions.push(transaction);

        // ⚙️ GESTION DÉLÉGUÉE: Créer la commission si applicable
        // Note: Utilise maintenant les settings configurables au lieu de .env
        const { isGestionDelegueEnabled, getGestionCodes } = await import('@/lib/settings/appSettings');
        const gestionEnabled = await isGestionDelegueEnabled();
        
        if (gestionEnabled) {
          const codes = await getGestionCodes();
          const isRentNature = 
            transaction.nature === codes.rentNature ||
            transaction.nature?.includes('LOYER') || 
            transaction.nature?.includes('RECETTE_LOYER');
          
          if (isRentNature && body.montantLoyer) {
            try {
              // S'assurer que accountingMonth est défini
              const accountingMonth = transaction.accounting_month || currentMonth;
              
              const commissionResult = await createManagementCommission({
                transactionId: transaction.id,
                propertyId: transaction.propertyId,
                montantLoyer: body.montantLoyer,
                chargesRecup: body.chargesRecup || 0,
                date: transaction.date,
                accountingMonth: accountingMonth,
                leaseId: transaction.leaseId || undefined,
                bailId: transaction.bailId || undefined,
                // Copier les champs de paiement de la transaction parent
                reference: body.reference || undefined,
                paidAt: body.paidAt ? new Date(body.paidAt) : (body.paymentDate ? new Date(body.paymentDate) : undefined),
                method: body.method || body.paymentMethod || undefined,
                notes: body.notes || undefined,
                rapprochementStatus: body.rapprochementStatus || 'non_rapprochee',
                bankRef: body.bankRef || undefined,
              }, tx);
              
              if (commissionResult.commissionTransaction) {
                transactions.push(commissionResult.commissionTransaction);
                console.log(`[Commission] Créée automatiquement pour transaction ${transaction.id}`);
              }
            } catch (error) {
              console.error('[Commission] Erreur lors de la création automatique:', error);
              // Ne pas bloquer la création de la transaction en cas d'erreur de commission
            }
          }
        }
      }

      // La première transaction est celle qui recevra les documents
      const primaryTransaction = transactions[0];

      // 2. Finaliser les documents en staging si présents
      if (body.stagedDocumentIds && body.stagedDocumentIds.length > 0) {
        console.log('[API] Finalisation des documents en staging:', body.stagedDocumentIds);
        
        // Vérifier que les documents existent
        const existingDocs = await tx.Document.findMany({
          where: { 
            id: { in: body.stagedDocumentIds },
            status: 'draft'
          },
          select: { id: true, fileName: true, status: true, fileSha256: true, textSha256: true }
        });
        console.log('[API] Documents draft trouvés:', existingDocs);

        // Re-vérifier les doublons avant finalisation
        const { DocumentsService } = await import('@/lib/services/documents');
        for (const doc of existingDocs) {
          if (doc.fileSha256) {
            const duplicateCheck = await DocumentsService.checkDuplicates({ 
              fileSha256: doc.fileSha256, 
              textSha256: doc.textSha256 || undefined 
            });
            if (duplicateCheck.hasExactDuplicate) {
              return NextResponse.json({
                success: false,
                error: `Document "${doc.fileName}" est maintenant un doublon exact`,
                duplicate: duplicateCheck.exactDuplicate
              }, { status: 409 });
            }
          }
        }

        // Mettre à jour le statut des documents de 'draft' à 'active'
        await tx.Document.updateMany({
          where: { 
            id: { in: body.stagedDocumentIds },
            status: 'draft'
          },
          data: {
            status: 'active',
            uploadSessionId: null,
            intendedContextType: null,
            intendedContextTempKey: null
          }
        });

        console.log('Documents finalisés (liens créés après la transaction):', primaryTransaction.id);
      }

      // 3. Traiter les liens vers documents existants si présents
      if (body.stagedLinkItemIds && body.stagedLinkItemIds.length > 0) {
        console.log('[API] Traitement des liens vers documents existants:', body.stagedLinkItemIds);
        
        // Récupérer les staged items de type 'link'
        const stagedLinks = await tx.UploadStagedItem.findMany({
          where: {
            id: { in: body.stagedLinkItemIds },
            kind: 'link'
          },
          include: {
            Document: {
              select: {
                id: true,
                filenameOriginal: true
              }
            }
          }
        });

        console.log('[API] Staged links trouvés:', stagedLinks.length);
        // Note : Les liens seront créés APRÈS la transaction via createDocumentLinks()
      }

      // Retourner la première transaction et le nombre total créé
      return {
        transaction: transactions[0],
        totalCreated: transactions.length,
        allTransactions: transactions
      };
    }, {
      maxWait: 10000, // 10 secondes max d'attente
      timeout: 15000, // 15 secondes timeout
    });

    // Créer les liens APRÈS la transaction pour éviter le timeout
    if (body.stagedDocumentIds && body.stagedDocumentIds.length > 0) {
      console.log('[API] Création des liens pour les documents finalisés...');
      const { createDocumentLinks } = await import('@/lib/services/documentLinkService');
      
      // Lier les documents à TOUTES les transactions créées
      for (const transaction of result.allTransactions) {
        await Promise.all(body.stagedDocumentIds.map(async (docId: string) => {
          await createDocumentLinks(docId, transaction);
        }));
      }
      console.log(`Documents finalisés et liés à ${result.allTransactions.length} transactions`);
    }

    if (body.stagedLinkItemIds && body.stagedLinkItemIds.length > 0) {
      console.log('[API] Création des liens pour les documents existants...');
      
      // Récupérer les staged items de type 'link'
      const stagedLinks = await prisma.uploadStagedItem.findMany({
        where: {
          id: { in: body.stagedLinkItemIds },
          kind: 'link'
        },
        include: {
          Document: {
            select: {
              id: true,
              filenameOriginal: true
            }
          }
        }
      });

      const { createDocumentLinks } = await import('@/lib/services/documentLinkService');
      
      // Lier les documents existants à TOUTES les transactions créées
      for (const transaction of result.allTransactions) {
        for (const stagedLink of stagedLinks) {
          if (!stagedLink.Document) continue;
          const docId = stagedLink.Document.id;
          await createDocumentLinks(docId, transaction);
          console.log(`[API] Liens créés pour document existant: ${stagedLink.Document.filenameOriginal} → ${transaction.id}`);
        }
      }

      // Supprimer les staged items après traitement
      await prisma.uploadStagedItem.deleteMany({
        where: { id: { in: body.stagedLinkItemIds } }
      });

      console.log(`Liens vers documents existants créés pour ${result.allTransactions.length} transactions`);
    }

    // Construire le message de succès avec les mois créés
    let successMessage = 'Transaction créée avec succès';
    if (result.totalCreated > 1) {
      const months = result.allTransactions
        .filter(tx => tx.accountingMonth) // Filtrer les transactions sans mois comptable
        .map(tx => {
          const [year, month] = tx.accountingMonth.split('-');
          const monthNames = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
          const monthName = monthNames[parseInt(month) - 1];
          return monthName ? `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}` : '';
        })
        .filter(Boolean); // Retirer les chaînes vides
      
      if (months.length > 0) {
        successMessage = `${result.totalCreated} transactions créées (${months.join(', ')})`;
      } else {
        successMessage = `${result.totalCreated} transactions créées`;
      }
    }

    return NextResponse.json({
      ...result,
      successMessage
    });

  } catch (error) {
    console.error('Erreur lors de la création de la transaction:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la transaction' },
      { status: 500 }
    );
  }
}