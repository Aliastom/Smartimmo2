/**
 * Interface pour le repository de transactions
 * Permet l'injection de dépendances et le mock pour les tests
 */

export interface Transaction {
  id: string;
  organizationId: string;
  propertyId: string;
  leaseId?: string | null;
  bailId?: string | null;
  categoryId?: string | null;
  label: string;
  amount: number;
  date: Date;
  reference?: string | null;
  month?: number | null;
  year?: number | null;
  accounting_month?: string | null;
  isRecurring?: boolean | null;
  nature?: string | null;
  paidAt?: Date | null;
  method?: string | null;
  notes?: string | null;
  source?: string;
  idempotencyKey?: string | null;
  externalId?: string | null;
  externalType?: string | null;
  monthsCovered?: string | null;
  parentTransactionId?: string | null;
  moisIndex?: number | null;
  moisTotal?: number | null;
  rapprochementStatus?: string;
  dateRapprochement?: Date | null;
  bankRef?: string | null;
  montantLoyer?: number | null;
  chargesRecup?: number | null;
  chargesNonRecup?: number | null;
  isAutoAmount?: boolean | null;
  managementCompanyId?: string | null;
  isAuto?: boolean;
  autoSource?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateTransactionData {
  organizationId: string;
  propertyId: string;
  leaseId?: string | null;
  bailId?: string | null;
  categoryId?: string | null;
  label: string;
  amount: number;
  date: Date;
  reference?: string | null;
  notes?: string | null;
  paidAt?: Date | null;
  method?: string | null;
  accounting_month?: string | null;
  monthsCovered?: string | null;
  moisIndex?: number | null;
  moisTotal?: number | null;
  rapprochementStatus?: string;
  dateRapprochement?: Date | null;
  bankRef?: string | null;
  montantLoyer?: number | null;
  chargesRecup?: number | null;
  chargesNonRecup?: number | null;
  isAutoAmount?: boolean | null;
  nature?: string | null;
  parentTransactionId?: string | null;
  managementCompanyId?: string | null;
  isAuto?: boolean;
  autoSource?: string | null;
  source?: string;
}

export interface UpdateTransactionData {
  propertyId?: string;
  leaseId?: string | null;
  categoryId?: string | null;
  label?: string;
  amount?: number;
  date?: Date;
  reference?: string | null;
  notes?: string | null;
  paidAt?: Date | null;
  method?: string | null;
  accounting_month?: string | null;
  monthsCovered?: string | null;
  rapprochementStatus?: string;
  dateRapprochement?: Date | null;
  bankRef?: string | null;
  montantLoyer?: number | null;
  chargesRecup?: number | null;
  chargesNonRecup?: number | null;
  isAutoAmount?: boolean | null;
  nature?: string | null;
}

export interface TransactionWhere {
  id?: string;
  organizationId?: string;
  propertyId?: string;
  leaseId?: string | null;
  categoryId?: string | null;
  nature?: string | { in: string[] } | string;
  parentTransactionId?: string | null;
  isAuto?: boolean;
  autoSource?: string;
  amount?: { gte?: number; lte?: number };
  date?: { gte?: Date; lte?: Date };
  accounting_month?: { gte?: string; lte?: string };
  Property?: { isArchived?: boolean };
  Lease?: { tenantId?: string };
}

/**
 * Contexte de transaction pour support atomicité (optionnel)
 */
export interface TransactionContext {
  // Implémentation spécifique (Prisma transaction, in-memory mock, etc.)
  [key: string]: any;
}

/**
 * Interface du repository de transactions
 */
export interface ITransactionRepository {
  // CRUD
  create(data: CreateTransactionData, ctx?: TransactionContext): Promise<Transaction>;
  update(id: string, data: UpdateTransactionData, ctx?: TransactionContext): Promise<Transaction>;
  delete(id: string, ctx?: TransactionContext): Promise<void>;
  deleteMany(where: TransactionWhere, ctx?: TransactionContext): Promise<void>;
  
  // ⚠️ Méthode optionnelle pour suppression locale uniquement (sans pendingOp)
  // Utilisée uniquement pour les commissions auto en app-shell (server-only, suppression en cascade gérée par le serveur)
  deleteLocalOnly?(id: string): Promise<void>;
  
  // Queries
  findById(id: string, ctx?: TransactionContext): Promise<Transaction | null>;
  findByPropertyId(propertyId: string, ctx?: TransactionContext): Promise<Transaction[]>;
  findMany(where: TransactionWhere, ctx?: TransactionContext): Promise<Transaction[]>;
  findFirst(where: TransactionWhere, ctx?: TransactionContext): Promise<Transaction | null>;
  
  // Support transaction (pour atomicité)
  // Les implémentations peuvent supporter ou non les transactions
  // Si supporté, beginTransaction() retourne un contexte utilisable dans les autres méthodes
  beginTransaction?(): Promise<TransactionContext>;
  commit?(ctx: TransactionContext): Promise<void>;
  rollback?(ctx: TransactionContext): Promise<void>;
}

