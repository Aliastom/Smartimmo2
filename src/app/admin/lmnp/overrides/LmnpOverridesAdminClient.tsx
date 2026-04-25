'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/ui/shared/label';
import { Select } from '@/components/ui/Select';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Textarea } from '@/ui/shared/textarea';
import { Drawer } from '@/components/ui/Drawer';
import { ArrowLeft, Eye, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface OverrideListRow {
  id: string;
  organizationId: string;
  transactionId: string | null;
  documentId: string | null;
  loanId: string | null;
  entityType: string;
  lmnpBucket: string;
  lmnpLabel: string;
  reason: string | null;
  createdAt: string;
  exerciseHint: number | null;
}

interface OverrideDetail {
  id: string;
  organizationId: string;
  transactionId: string | null;
  documentId: string | null;
  loanId: string | null;
  lmnpBucket: string;
  lmnpLabel: string;
  reason: string | null;
  createdAt: string;
  Transaction: { year: number | null; accounting_month: string | null; date: string; label: string } | null;
  Document: { uploadedAt: string; fileName: string } | null;
  Loan: { startDate: string; label: string } | null;
}

interface Meta {
  exerciseYears: number[];
}

export default function LmnpOverridesAdminClient() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OverrideListRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);

  const [exerciseYear, setExerciseYear] = useState('');
  const [entityType, setEntityType] = useState('all');
  const [lmnpBucket, setLmnpBucket] = useState('');
  const [q, setQ] = useState('');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [detail, setDetail] = useState<OverrideDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editBucket, setEditBucket] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editReason, setEditReason] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (exerciseYear) params.set('exerciseYear', exerciseYear);
      if (entityType !== 'all') params.set('entityType', entityType);
      if (lmnpBucket.trim()) params.set('lmnpBucket', lmnpBucket.trim());
      if (q.trim()) params.set('q', q.trim());

      const res = await fetch(`/api/admin/lmnp/overrides?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Erreur lors du chargement');
        return;
      }
      setRows(json.data);
      setMeta(json.meta ?? null);
    } catch (e) {
      console.error(e);
      toast.error('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, [exerciseYear, entityType, lmnpBucket, q]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const openDetail = async (id: string) => {
    setSheetOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/lmnp/overrides/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Détail introuvable');
        setSheetOpen(false);
        return;
      }
      const d = json.data as OverrideDetail;
      setDetail(d);
      setEditBucket(d.lmnpBucket);
      setEditLabel(d.lmnpLabel);
      setEditReason(d.reason ?? '');
    } catch (e) {
      console.error(e);
      toast.error('Erreur réseau');
      setSheetOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveDetail = async () => {
    if (!detail) return;
    if (!editBucket.trim() || !editLabel.trim()) {
      toast.error('Bucket et libellé requis');
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(`/api/admin/lmnp/overrides/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lmnpBucket: editBucket.trim(),
          lmnpLabel: editLabel.trim(),
          reason: editReason.trim() === '' ? null : editReason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Échec de la mise à jour');
        return;
      }
      toast.success('Override mis à jour');
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              lmnpBucket: json.data.lmnpBucket,
              lmnpLabel: json.data.lmnpLabel,
              reason: json.data.reason,
            }
          : null,
      );
      fetchList();
    } catch (e) {
      console.error(e);
      toast.error('Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/admin/lmnp/overrides/${deleteId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Suppression impossible');
        return;
      }
      toast.success('Override supprimé');
      setDeleteId(null);
      if (detail?.id === deleteId) {
        setSheetOpen(false);
        setDetail(null);
      }
      fetchList();
    } catch (e) {
      console.error(e);
      toast.error('Erreur réseau');
    } finally {
      setDeleting(false);
    }
  };

  const entityBadge = (t: string) => {
    if (t === 'transaction') return <Badge variant="primary">Transaction</Badge>;
    if (t === 'document') return <Badge variant="info">Document</Badge>;
    if (t === 'loan') return <Badge variant="gray">Prêt</Badge>;
    return <Badge variant="gray">{t}</Badge>;
  };

  const yearOptions = [{ value: '', label: 'Tous' }, ...(meta?.exerciseYears ?? []).map((y) => ({ value: String(y), label: String(y) }))];

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="h-4 w-4" /> Administration
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Overrides export LMNP</h1>
          <p className="text-gray-600 text-sm mt-1">
            Gestion des <code className="text-xs bg-gray-100 px-1 rounded">LmnpExportOverride</code> — aucune modification des transactions sources.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/lmnp/anomalies">
            <Button variant="outline" type="button">
              Anomalies
            </Button>
          </Link>
          <Link href="/admin/lmnp/runs">
            <Button variant="outline" type="button">
              Historique des runs
            </Button>
          </Link>
          <Button type="button" variant="soft" onClick={() => fetchList()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
          <CardDescription>Exercice (via entités liées), type, bucket, recherche libre</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="o-year">Exercice</Label>
            <Select
              id="o-year"
              className="mt-1"
              value={exerciseYear}
              onChange={(e) => setExerciseYear(e.target.value)}
              options={yearOptions}
            />
          </div>
          <div>
            <Label htmlFor="o-entity">Type d&apos;entité</Label>
            <Select
              id="o-entity"
              className="mt-1"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              options={[
                { value: 'all', label: 'Tous' },
                { value: 'transaction', label: 'Transaction' },
                { value: 'document', label: 'Document' },
                { value: 'loan', label: 'Prêt' },
              ]}
            />
          </div>
          <div>
            <Label htmlFor="o-bucket">lmnpBucket (contient)</Label>
            <Input id="o-bucket" className="mt-1" value={lmnpBucket} onChange={(e) => setLmnpBucket(e.target.value)} placeholder="ex. LOYER" />
          </div>
          <div>
            <Label htmlFor="o-q">Texte libre</Label>
            <Input
              id="o-q"
              className="mt-1"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="id, libellé, raison…"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{loading ? 'Chargement…' : `${rows.length} override(s)`}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Org.</TableHeaderCell>
                <TableHeaderCell>Entité</TableHeaderCell>
                <TableHeaderCell>Ids</TableHeaderCell>
                <TableHeaderCell>Ex. (indice)</TableHeaderCell>
                <TableHeaderCell>Bucket</TableHeaderCell>
                <TableHeaderCell>Libellé</TableHeaderCell>
                <TableHeaderCell>Raison</TableHeaderCell>
                <TableHeaderCell>Créé le</TableHeaderCell>
                <TableHeaderCell className="w-[100px]">Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs max-w-[90px] truncate" title={r.organizationId}>
                    {r.organizationId}
                  </TableCell>
                  <TableCell>{entityBadge(r.entityType)}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[160px]">
                    {r.transactionId && <div title={r.transactionId}>tx: {r.transactionId.slice(0, 10)}…</div>}
                    {r.documentId && <div title={r.documentId}>doc: {r.documentId.slice(0, 10)}…</div>}
                    {r.loanId && <div title={r.loanId}>loan: {r.loanId.slice(0, 10)}…</div>}
                  </TableCell>
                  <TableCell>{r.exerciseHint ?? '—'}</TableCell>
                  <TableCell className="text-sm font-medium">{r.lmnpBucket}</TableCell>
                  <TableCell className="text-sm max-w-[180px] truncate" title={r.lmnpLabel}>
                    {r.lmnpLabel}
                  </TableCell>
                  <TableCell className="text-sm max-w-[160px] truncate" title={r.reason ?? ''}>
                    {r.reason ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(r.createdAt).toLocaleString('fr-FR')}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant="outline" title="Détail et modification" onClick={() => openDetail(r.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="sm" variant="outline" title="Supprimer" onClick={() => setDeleteId(r.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Drawer
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Détail override"
        size="md"
      >
        <p className="text-sm text-gray-500 pb-4">
          Lecture des liens métier ; seuls bucket, libellé et raison sont modifiables ici.
        </p>
        {detailLoading && <p className="text-sm text-gray-500 py-6">Chargement…</p>}
        {!detailLoading && detail && (
          <div className="space-y-4 text-sm">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-1">
                <div>
                  <span className="text-gray-500">id</span>{' '}
                  <span className="font-mono text-xs break-all">{detail.id}</span>
                </div>
                <div>
                  <span className="text-gray-500">organizationId</span>{' '}
                  <span className="font-mono text-xs">{detail.organizationId}</span>
                </div>
                <div>
                  <span className="text-gray-500">transactionId</span>{' '}
                  <span className="font-mono text-xs break-all">{detail.transactionId ?? '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">documentId</span>{' '}
                  <span className="font-mono text-xs break-all">{detail.documentId ?? '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">loanId</span>{' '}
                  <span className="font-mono text-xs break-all">{detail.loanId ?? '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">createdAt</span> {new Date(detail.createdAt).toLocaleString('fr-FR')}
                </div>
                {detail.Transaction && (
                  <div className="pt-2 border-t text-xs">
                    <strong>Transaction liée :</strong> {detail.Transaction.label} (année {detail.Transaction.year ?? '—'}, mois compta{' '}
                    {detail.Transaction.accounting_month ?? '—'})
                  </div>
                )}
                {detail.Document && (
                  <div className="pt-2 border-t text-xs">
                    <strong>Document lié :</strong> {detail.Document.fileName}
                  </div>
                )}
                {detail.Loan && (
                  <div className="pt-2 border-t text-xs">
                    <strong>Prêt lié :</strong> {detail.Loan.label}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="ed-bucket">lmnpBucket</Label>
                <Input id="ed-bucket" className="mt-1" value={editBucket} onChange={(e) => setEditBucket(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ed-label">lmnpLabel</Label>
                <Input id="ed-label" className="mt-1" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ed-reason">reason</Label>
                <Textarea id="ed-reason" className="mt-1" rows={3} value={editReason} onChange={(e) => setEditReason(e.target.value)} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" onClick={saveDetail} disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setDeleteId(detail.id)}>
                  Supprimer…
                </Button>
              </div>
          </div>
        )}
      </Drawer>

      <Dialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer cet override ?</DialogTitle>
            <DialogDescription>
              Cette action est définitive. Les transactions et documents ne sont pas modifiés.
            </DialogDescription>
          </DialogHeader>
          {deleteId && <p className="text-sm font-mono break-all bg-gray-50 p-2 rounded">{deleteId}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              Annuler
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Suppression…' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
