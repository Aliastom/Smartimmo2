/**
 * Résolveur d'entités fuzzy
 * Mappe les noms en français → IDs via similarité trigram ou embeddings
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface EntityMatch {
  id: string;
  type: 'property' | 'tenant' | 'lease' | 'loan';
  name: string;
  score: number;
  metadata?: any;
}

/**
 * Résout une entité depuis un nom approximatif
 */
export async function resolveEntity(
  query: string,
  type: 'property' | 'tenant' | 'lease' | 'loan',
  minScore = 0.3
): Promise<EntityMatch[]> {
  console.log(`[EntityResolver] Résolution: "${query}" (type: ${type})`);

  const matches: EntityMatch[] = [];

  switch (type) {
    case 'property':
      matches.push(...await resolveProperty(query, minScore));
      break;

    case 'tenant':
      matches.push(...await resolveTenant(query, minScore));
      break;

    case 'lease':
      matches.push(...await resolveLease(query, minScore));
      break;

    case 'loan':
      matches.push(...await resolveLoan(query, minScore));
      break;
  }

  console.log(`[EntityResolver] ${matches.length} match(es) trouvé(s)`);

  return matches;
}

/**
 * Résout un bien immobilier
 */
async function resolveProperty(query: string, minScore: number): Promise<EntityMatch[]> {
  const properties = await prisma.property.findMany({
    where: {
      isArchived: false,
    },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
    },
    take: 100,
  });

  return properties
    .map(p => ({
      id: p.id,
      type: 'property' as const,
      name: p.name,
      score: calculateSimilarity(query, `${p.name} ${p.address} ${p.city}`),
      metadata: { address: p.address, city: p.city },
    }))
    .filter(m => m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/**
 * Résout un locataire
 */
async function resolveTenant(query: string, minScore: number): Promise<EntityMatch[]> {
  const tenants = await prisma.tenant.findMany({
    where: {
      status: { not: 'INACTIVE' },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
    take: 100,
  });

  return tenants
    .map(t => ({
      id: t.id,
      type: 'tenant' as const,
      name: `${t.firstName} ${t.lastName}`,
      score: calculateSimilarity(query, `${t.firstName} ${t.lastName} ${t.email}`),
      metadata: { email: t.email },
    }))
    .filter(m => m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/**
 * Résout un bail
 */
async function resolveLease(query: string, minScore: number): Promise<EntityMatch[]> {
  const leases = await prisma.lease.findMany({
    where: {
      status: { in: ['ACTIF', 'SIGNE', 'EN_COURS'] },
    },
    include: {
      Property: { select: { name: true } },
      Tenant: { select: { firstName: true, lastName: true } },
    },
    take: 100,
  });

  return leases
    .map(l => ({
      id: l.id,
      type: 'lease' as const,
      name: `${l.Property.name} - ${l.Tenant.firstName} ${l.Tenant.lastName}`,
      score: calculateSimilarity(query, `${l.Property.name} ${l.Tenant.firstName} ${l.Tenant.lastName}`),
      metadata: { property: l.Property.name, tenant: `${l.Tenant.firstName} ${l.Tenant.lastName}` },
    }))
    .filter(m => m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/**
 * Résout un prêt
 */
async function resolveLoan(query: string, minScore: number): Promise<EntityMatch[]> {
  const loans = await prisma.loan.findMany({
    where: {
      isActive: true,
    },
    include: {
      property: { select: { name: true } },
    },
    take: 50,
  });

  return loans
    .map(l => ({
      id: l.id,
      type: 'loan' as const,
      name: `${l.label} (${l.property.name})`,
      score: calculateSimilarity(query, `${l.label} ${l.property.name}`),
      metadata: { property: l.property.name },
    }))
    .filter(m => m.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/**
 * Calcule la similarité entre deux chaînes (simple)
 * Basé sur les trigrammes (sans extension PostgreSQL pg_trgm pour l'instant)
 */
function calculateSimilarity(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Similarité exacte
  if (t.includes(q)) {
    return 1.0;
  }

  // Similarité partielle (mots communs)
  const qWords = new Set(q.split(/\s+/));
  const tWords = new Set(t.split(/\s+/));

  let commonWords = 0;
  for (const word of qWords) {
    if (tWords.has(word)) {
      commonWords++;
    }
  }

  if (qWords.size === 0) return 0;

  return commonWords / qWords.size;
}

/**
 * Résout plusieurs entités en batch
 */
export async function resolveEntities(
  queries: Array<{ query: string; type: EntityMatch['type'] }>
): Promise<Record<string, EntityMatch[]>> {
  const results: Record<string, EntityMatch[]> = {};

  for (const { query, type } of queries) {
    const key = `${type}:${query}`;
    results[key] = await resolveEntity(query, type);
  }

  return results;
}

