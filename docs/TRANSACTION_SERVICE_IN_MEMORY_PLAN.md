# Plan : TransactionService avec repositories in-memory

## Objectif

Prouver la conformité des règles métier TransactionService (Normal vs AppShell) sans dépendre de Dexie/fake-indexeddb, en utilisant des repositories in-memory.

## Analyse des dépendances TransactionService

### Entités utilisées

1. **Transaction** (CRUD + requêtes)
   - create, update, delete
   - findByPropertyId, findById
   - findMany (avec filtres)
   - findFirst (pour commissions liées)

2. **Property** (lecture seule pour validation)
   - findFirst (vérification ownership + organizationId)
   - include ManagementCompany (pour gestion déléguée)

3. **Lease** (lecture seule pour validation)
   - findFirst (vérification ownership + organizationId)

4. **Category** (lecture seule)
   - findUnique (validation categoryId)
   - findFirst (pour catégorie commission via slug)

5. **ManagementCompany** (lecture seule)
   - Via Property.ManagementCompany (pour calcul commission)

6. **Document** (CRUD partiel)
   - findMany (vérification doublons)
   - updateMany (finalisation staging → active)
   - delete (si mode delete_docs)

7. **DocumentLink** (CRUD)
   - findMany (liens transaction)
   - create (liens transaction/property/lease/global)
   - deleteMany (si mode keep_docs_globalize)

8. **NatureEntity** (lecture seule)
   - findMany (pour mapping nature code → flow)

## Interfaces de repositories

### ITransactionRepository

```typescript
interface ITransactionRepository {
  // CRUD
  create(data: CreateTransactionData): Promise<Transaction>;
  update(id: string, data: UpdateTransactionData): Promise<Transaction>;
  delete(id: string): Promise<void>;
  
  // Queries
  findById(id: string): Promise<Transaction | null>;
  findByPropertyId(propertyId: string): Promise<Transaction[]>;
  findMany(where: TransactionWhere): Promise<Transaction[]>;
  findFirst(where: TransactionWhere): Promise<Transaction | null>;
  findManyWithChildren(parentTransactionId: string): Promise<Transaction[]>;
  
  // Transaction support (pour atomicité)
  beginTransaction?(): Promise<TransactionContext>;
  commit?(ctx: TransactionContext): Promise<void>;
  rollback?(ctx: TransactionContext): Promise<void>;
}
```

### IPropertyRepository

```typescript
interface IPropertyRepository {
  findFirst(where: { id: string; organizationId: string }): Promise<Property | null>;
  findFirstWithManagementCompany(where: { id: string; organizationId: string }): Promise<PropertyWithCompany | null>;
}
```

### ILeaseRepository

```typescript
interface ILeaseRepository {
  findFirst(where: { id: string; organizationId: string }): Promise<Lease | null>;
}
```

### ICategoryRepository

```typescript
interface ICategoryRepository {
  findUnique(where: { id: string }): Promise<Category | null>;
  findFirst(where: { slug: string; actif: boolean }): Promise<Category | null>;
}
```

### IDocumentRepository

```typescript
interface IDocumentRepository {
  findMany(where: DocumentWhere): Promise<Document[]>;
  updateMany(where: DocumentWhere, data: Partial<Document>): Promise<void>;
  delete(id: string): Promise<void>;
  checkDuplicates(params: { fileSha256?: string; textSha256?: string; organizationId: string }): Promise<DuplicateCheckResult>;
}
```

### IDocumentLinkRepository

```typescript
interface IDocumentLinkRepository {
  findMany(where: { linkedType: string; linkedId: string }): Promise<DocumentLink[]>;
  create(data: CreateDocumentLinkData): Promise<DocumentLink>;
  deleteMany(where: DocumentLinkWhere): Promise<void>;
}
```

### INatureRepository

```typescript
interface INatureRepository {
  findMany(): Promise<NatureEntity[]>;
}
```

## Structure des fichiers

```
src/domain/
  services/
    TransactionService.ts          # Service métier (logique pure)
  repositories/
    interfaces/
      ITransactionRepository.ts
      IPropertyRepository.ts
      ILeaseRepository.ts
      ICategoryRepository.ts
      IDocumentRepository.ts
      IDocumentLinkRepository.ts
      INatureRepository.ts
    inMemory/
      InMemoryTransactionRepository.ts
      InMemoryPropertyRepository.ts
      InMemoryLeaseRepository.ts
      InMemoryCategoryRepository.ts
      InMemoryDocumentRepository.ts
      InMemoryDocumentLinkRepository.ts
      InMemoryNatureRepository.ts
    adapters/
      PrismaTransactionRepository.ts    # Adapter Prisma → ITransactionRepository
      PrismaPropertyRepository.ts
      # ... autres adapters Prisma
```

## TransactionService

```typescript
interface TransactionServiceDependencies {
  transactionRepo: ITransactionRepository;
  propertyRepo: IPropertyRepository;
  leaseRepo: ILeaseRepository;
  categoryRepo: ICategoryRepository;
  documentRepo: IDocumentRepository;
  documentLinkRepo: IDocumentLinkRepository;
  natureRepo: INatureRepository;
}

export function createTransactionService(deps: TransactionServiceDependencies): TransactionService {
  return {
    async createTransaction(params) {
      // Logique métier extraite de POST /api/transactions
    },
    async updateTransaction(id, params) {
      // Logique métier extraite de PUT /api/transactions/:id
    },
    async deleteTransaction(id, options) {
      // Logique métier extraite de DELETE /api/transactions/:id
    },
  };
}
```

## Tests de conformité

```typescript
describe('TransactionService Conformance (Normal vs AppShell)', () => {
  it('CREATE: même input => mêmes side-effects', async () => {
    // Dataset initial identique
    // Exécuter via service normal
    // Exécuter via service app-shell
    // Comparer : transactions créées + commissions + documents
  });
  
  it('UPDATE: même input => mêmes side-effects', async () => {
    // ...
  });
  
  it('DELETE: même input => mêmes side-effects', async () => {
    // ...
  });
  
  it('Gestion déléguée: création commission auto', async () => {
    // ...
  });
  
  it('Suppression cascade: commissions auto uniquement', async () => {
    // ...
  });
});
```

## Diff minimal

### Fichiers à créer

1. `src/domain/repositories/interfaces/*.ts` (7 interfaces)
2. `src/domain/repositories/inMemory/*.ts` (7 implémentations)
3. `src/domain/repositories/adapters/Prisma*.ts` (7 adapters)
4. `src/domain/services/TransactionService.ts` (service métier)
5. `tests/transaction-service-conformance-inmemory.test.ts` (nouveaux tests)

### Fichiers à modifier

1. `src/app/api/transactions/route.ts` → utiliser TransactionService
2. `src/app/api/transactions/[id]/route.ts` → utiliser TransactionService
3. `tests/transaction-service-conformance.test.ts` → marquer comme skipped avec note

