/**
 * Liaisons échéance ↔ transaction (phase 2 : manuel, IDB + API best-effort).
 */

import { v4 as uuidv4 } from 'uuid';
import { getLocalDB, type LocalEcheanceTransactionLink } from '@/lib/offline/db';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import type { LocalTransaction } from '@/lib/offline/db';

export type EcheanceTransactionLinkRow = LocalEcheanceTransactionLink;

export async function getLinksByEcheanceIds(
  echeanceIds: string[]
): Promise<Map<string, EcheanceTransactionLinkRow[]>> {
  const map = new Map<string, EcheanceTransactionLinkRow[]>();
  if (!echeanceIds.length) return map;
  const db = await getLocalDB();
  if (!db) return map;
  const set = new Set(echeanceIds);
  const all = await db.EcheanceTransactionLink.toArray();
  for (const row of all) {
    if (!set.has(row.echeanceId)) continue;
    const arr = map.get(row.echeanceId) || [];
    arr.push(row);
    map.set(row.echeanceId, arr);
  }
  return map;
}

/** Transactions locales liées à une échéance (pour affichage / KPI offline). */
export async function getLinkedTransactions(
  echeanceId: string,
  organizationId: string
): Promise<LocalTransaction[]> {
  const links = (await getLinksByEcheanceIds([echeanceId])).get(echeanceId) || [];
  const repo = getTransactionRepositoryOffline();
  const out: LocalTransaction[] = [];
  for (const l of links) {
    const t = await repo.getById(l.transactionId, organizationId);
    if (t) out.push(t);
  }
  return out;
}

export async function getLinkByTransactionId(
  transactionId: string
): Promise<EcheanceTransactionLinkRow | undefined> {
  const db = await getLocalDB();
  if (!db) return undefined;
  return db.EcheanceTransactionLink.where('transactionId').equals(transactionId).first();
}

/** Fusionne les liens serveur dans IDB (même id si présent, sinon upsert par echeanceId+transactionId) */
export async function mergeServerLinksIntoIdb(
  organizationId: string,
  items: Array<{
    id: string;
    echeanceId: string;
    transactionId: string;
    matchType: string;
    confidenceScore?: number | null;
    occurrenceDate?: string | null;
    createdAt: string;
    updatedAt: string;
  }>
): Promise<void> {
  const db = await getLocalDB();
  if (!db) return;
  for (const it of items) {
    const row: EcheanceTransactionLinkRow = {
      id: it.id,
      organizationId,
      echeanceId: it.echeanceId,
      transactionId: it.transactionId,
      matchType: it.matchType,
      confidenceScore: it.confidenceScore ?? null,
      occurrenceDate: it.occurrenceDate ?? null,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
      _syncedAt: new Date().toISOString(),
    };
    await db.EcheanceTransactionLink.put(row);
  }
}

export async function fetchAndMergeLinksForProperty(
  organizationId: string,
  propertyId: string
): Promise<void> {
  try {
    const res = await fetch(`/api/echeance-transaction-links?propertyId=${encodeURIComponent(propertyId)}`, {
      credentials: 'include',
    });
    if (!res.ok) return;
    const data = await res.json();
    const items = (data.items || []).map((l: any) => ({
      id: l.id,
      echeanceId: l.echeanceId,
      transactionId: l.transactionId,
      matchType: l.matchType || 'manual',
      confidenceScore: l.confidenceScore,
      occurrenceDate: l.occurrenceDate,
      createdAt: typeof l.createdAt === 'string' ? l.createdAt : new Date(l.createdAt).toISOString(),
      updatedAt: typeof l.updatedAt === 'string' ? l.updatedAt : new Date(l.updatedAt).toISOString(),
    }));
    await mergeServerLinksIntoIdb(organizationId, items);
  } catch {
    /* hors ligne ou API indispo */
  }
}

export async function addEcheanceTransactionLink(params: {
  organizationId: string;
  echeanceId: string;
  transactionId: string;
  occurrenceDate?: string | null;
}): Promise<EcheanceTransactionLinkRow> {
  const db = await getLocalDB();
  if (!db) throw new Error('Base locale indisponible');

  const existingTx = await db.EcheanceTransactionLink.where('transactionId')
    .equals(params.transactionId)
    .first();
  if (existingTx) {
    throw new Error('Cette transaction est déjà liée à une échéance');
  }

  const dup = await db.EcheanceTransactionLink
    .where('echeanceId')
    .equals(params.echeanceId)
    .filter((l) => l.transactionId === params.transactionId)
    .first();
  if (dup) return dup;

  const now = new Date().toISOString();
  const id = uuidv4();
  const row: EcheanceTransactionLinkRow = {
    id,
    organizationId: params.organizationId,
    echeanceId: params.echeanceId,
    transactionId: params.transactionId,
    matchType: 'manual',
    confidenceScore: null,
    occurrenceDate: params.occurrenceDate ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.EcheanceTransactionLink.add(row);

  try {
    const res = await fetch('/api/echeance-transaction-links', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        echeanceId: params.echeanceId,
        transactionId: params.transactionId,
        matchType: 'manual',
        occurrenceDate: params.occurrenceDate,
      }),
    });
    if (res.ok) {
      const j = await res.json();
      if (j.item?.id && j.item.id !== id) {
        await db.EcheanceTransactionLink.delete(id);
        await db.EcheanceTransactionLink.put({
          ...row,
          id: j.item.id,
          createdAt: j.item.createdAt || row.createdAt,
          updatedAt: j.item.updatedAt || row.updatedAt,
          _syncedAt: now,
        });
        return (await db.EcheanceTransactionLink.get(j.item.id))!;
      }
      await db.EcheanceTransactionLink.update(id, { _syncedAt: now });
    }
  } catch {
    /* offline : lien local uniquement */
  }

  return row;
}

export async function removeEcheanceTransactionLink(linkId: string): Promise<void> {
  const db = await getLocalDB();
  if (!db) throw new Error('Base locale indisponible');
  const row = await db.EcheanceTransactionLink.get(linkId);
  if (!row) return;

  await db.EcheanceTransactionLink.delete(linkId);

  try {
    if (row._syncedAt || /^c[a-z0-9]{24}$/i.test(linkId)) {
      await fetch(`/api/echeance-transaction-links/${encodeURIComponent(linkId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    }
  } catch {
    /* best effort */
  }
}

/**
 * Supprime toute liaison échéance ↔ cette transaction (ex. après suppression de la transaction).
 * Idempotent ; no-op si pas de base locale (SSR).
 */
export async function removeEcheanceLinksForTransactionId(transactionId: string): Promise<void> {
  const db = await getLocalDB();
  if (!db) return;
  const links = await db.EcheanceTransactionLink.where('transactionId').equals(transactionId).toArray();
  for (const link of links) {
    try {
      await removeEcheanceTransactionLink(link.id);
    } catch {
      await db.EcheanceTransactionLink.delete(link.id);
    }
  }
}

/** Retire les liens dont la transaction n’existe plus localement (orphelins). */
export async function pruneOrphanEcheanceLinksForEcheanceIds(
  echeanceIds: string[],
  organizationId: string
): Promise<void> {
  if (!echeanceIds.length) return;
  const db = await getLocalDB();
  if (!db) return;
  const set = new Set(echeanceIds);
  const repo = getTransactionRepositoryOffline();
  const all = await db.EcheanceTransactionLink.toArray();
  for (const row of all) {
    if (!set.has(row.echeanceId)) continue;
    if (row.organizationId && row.organizationId !== organizationId) continue;
    const tx = await repo.getById(row.transactionId, organizationId);
    if (!tx) {
      try {
        await removeEcheanceTransactionLink(row.id);
      } catch {
        await db.EcheanceTransactionLink.delete(row.id);
      }
    }
  }
}
