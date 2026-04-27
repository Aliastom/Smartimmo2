'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';

type Activity = {
  id: string;
  name: string;
  siret: string;
  fiscalRegime: 'micro_bic' | 'reel_simplifie';
  createdAt: string;
  updatedAt: string;
  _count?: { Properties: number };
  Properties?: Array<{
    id: string;
    name: string;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    fiscalTypeId?: string | null;
    fiscalRegimeId?: string | null;
  }>;
};

const emptyForm = {
  name: '',
  siret: '',
  fiscalRegime: 'reel_simplifie' as const,
};

export default function LmnpActivitiesPageClient() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Activity[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [viewPropertiesTarget, setViewPropertiesTarget] = useState<Activity | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/lmnp/activities?includeProperties=true');
      const json = await res.json();
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'Erreur lors du chargement des activités LMNP');
        return;
      }
      setRows((json.data || []) as Activity[]);
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchActivities();
  }, [fetchActivities]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setEditOpen(true);
  };

  const openEdit = (row: Activity) => {
    setEditing(row);
    setForm({
      name: row.name,
      siret: row.siret,
      fiscalRegime: row.fiscalRegime,
    });
    setEditOpen(true);
  };

  const propertyCountOf = (row: Activity) => row._count?.Properties ?? row.Properties?.length ?? 0;

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Le nom de l’activité est requis');
      return;
    }
    if (!/^\d{14}$/.test(form.siret)) {
      toast.error('Le SIRET doit contenir exactement 14 chiffres');
      return;
    }
    try {
      setSaving(true);
      const method = editing ? 'PATCH' : 'POST';
      const url = editing ? `/api/lmnp/activities/${editing.id}` : '/api/lmnp/activities';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          siret: form.siret,
          fiscalRegime: form.fiscalRegime,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'Impossible de sauvegarder l’activité');
        return;
      }
      toast.success(editing ? 'Activité LMNP modifiée' : 'Activité LMNP créée');
      setEditOpen(false);
      await fetchActivities();
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/lmnp/activities/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error || 'Suppression impossible');
        return;
      }
      toast.success('Activité LMNP supprimée');
      setDeleteTarget(null);
      await fetchActivities();
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setDeleting(false);
    }
  };

  const sortedRows = useMemo(() => [...rows].sort((a, b) => a.name.localeCompare(b.name, 'fr')), [rows]);
  const shortAddress = (p: NonNullable<Activity['Properties']>[number]) =>
    [p.address, p.postalCode, p.city].filter(Boolean).join(', ');

  return (
    <div className="space-y-6 p-6 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/parametres" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="h-4 w-4" /> Paramètres
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Activités LMNP (SIRET)</h1>
          <p className="text-sm text-gray-600 mt-1">Gérez vos activités LMNP (SIRET) pour vos locations meublées.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => fetchActivities()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle activité
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{loading ? 'Chargement…' : `${sortedRows.length} activité(s)`}</CardTitle>
          <CardDescription>Suppression autorisée uniquement sans bien rattaché.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Nom activité</TableHeaderCell>
                <TableHeaderCell>SIRET</TableHeaderCell>
                <TableHeaderCell>Régime</TableHeaderCell>
                <TableHeaderCell>Biens rattachés</TableHeaderCell>
                <TableHeaderCell>Mise à jour</TableHeaderCell>
                <TableHeaderCell className="w-[240px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => {
                const count = propertyCountOf(row);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="font-mono text-xs">{row.siret}</TableCell>
                    <TableCell>
                      <Badge variant={row.fiscalRegime === 'reel_simplifie' ? 'success' : 'info'}>
                        {row.fiscalRegime === 'reel_simplifie' ? 'Réel simplifié' : 'Micro BIC'}
                      </Badge>
                    </TableCell>
                    <TableCell>{count}</TableCell>
                    <TableCell className="text-sm text-gray-600">{new Date(row.updatedAt).toLocaleString('fr-FR')}</TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-end">
                        <Button type="button" size="sm" variant="outline" onClick={() => setViewPropertiesTarget(row)}>
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Voir les biens
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => openEdit(row)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Modifier
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-700 border-red-200 hover:bg-red-50"
                          onClick={() => setDeleteTarget(row)}
                          disabled={count > 0}
                          title={count > 0 ? 'Suppression impossible : biens rattachés' : 'Supprimer'}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Supprimer
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(o) => !o && setEditOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier activité LMNP' : 'Créer activité LMNP'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Nom activité</label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: LMNP Thomas" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">SIRET</label>
              <Input
                value={form.siret}
                onChange={(e) => setForm((p) => ({ ...p, siret: e.target.value.replace(/\D/g, '').slice(0, 14) }))}
                placeholder="14 chiffres"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Régime fiscal</label>
              <Select
                value={form.fiscalRegime}
                onChange={(e) => setForm((p) => ({ ...p, fiscalRegime: e.target.value as 'micro_bic' | 'reel_simplifie' }))}
                options={[
                  { value: 'reel_simplifie', label: 'Réel simplifié' },
                  { value: 'micro_bic', label: 'Micro BIC' },
                ]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? 'Sauvegarde…' : editing ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewPropertiesTarget} onOpenChange={(o) => !o && setViewPropertiesTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Biens rattachés - {viewPropertiesTarget?.name || ''}</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {(viewPropertiesTarget?.Properties || []).map((p) => (
              <li key={p.id} className="rounded border border-gray-200 px-3 py-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{shortAddress(p) || 'Adresse non renseignée'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Type fiscal: {p.fiscalTypeId || '—'} · Régime: {p.fiscalRegimeId || '—'}
                    </p>
                  </div>
                  <Link href={`/biens/${p.id}`}>
                    <Button type="button" size="sm" variant="outline">
                      Ouvrir le bien
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
            {(viewPropertiesTarget?.Properties || []).length === 0 && <li className="text-gray-500">Aucun bien rattaché.</li>}
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewPropertiesTarget(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer l’activité LMNP</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700">
            Confirmer la suppression de l’activité <span className="font-medium">{deleteTarget?.name}</span> ?
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Annuler
            </Button>
            <Button type="button" variant="danger" onClick={remove} disabled={deleting}>
              {deleting ? 'Suppression…' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
