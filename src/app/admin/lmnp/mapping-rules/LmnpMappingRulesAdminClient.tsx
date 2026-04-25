'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/ui/shared/label';
import { Select } from '@/components/ui/Select';
import { NatureCombobox } from '@/components/gestion/NatureCombobox';
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
import { ArrowLeft, Copy, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface MappingRuleRow {
  id: string;
  organizationId: string;
  organizationName?: string;
  exerciseYear: number;
  propertyId: string | null;
  propertyName?: string | null;
  natureCode: string | null;
  categoryId: string | null;
  categoryLabel?: string | null;
  categorySlug?: string | null;
  lmnpBucket: string;
  lmnpLabel: string;
  priority: number;
  mappingVersion: string;
  active: boolean;
}

interface MetaProperty {
  id: string;
  name: string;
}
interface MetaCategory {
  id: string;
  label: string;
  slug: string;
}
interface MetaNature {
  code: string;
  label: string;
}

interface FormState {
  exerciseYear: number;
  propertyId: string;
  natureCode: string;
  categoryId: string;
  lmnpBucket: string;
  lmnpLabel: string;
  priority: number;
  active: boolean;
  mappingVersion: string;
}

const emptyForm = (yearHint: number): FormState => ({
  exerciseYear: yearHint,
  propertyId: '',
  natureCode: '',
  categoryId: '',
  lmnpBucket: '',
  lmnpLabel: '',
  priority: 100,
  active: true,
  mappingVersion: '1',
});

function rowToForm(r: MappingRuleRow): FormState {
  return {
    exerciseYear: r.exerciseYear,
    propertyId: r.propertyId ?? '',
    natureCode: r.natureCode ?? '',
    categoryId: r.categoryId ?? '',
    lmnpBucket: r.lmnpBucket,
    lmnpLabel: r.lmnpLabel,
    priority: r.priority,
    active: r.active,
    mappingVersion: r.mappingVersion,
  };
}

export default function LmnpMappingRulesAdminClient() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MappingRuleRow[]>([]);
  const [meta, setMeta] = useState<{ properties: MetaProperty[]; categories: MetaCategory[]; natures: MetaNature[]; popularNatureCodes: { code: string }[] }>({
    properties: [],
    categories: [],
    natures: [],
    popularNatureCodes: [],
  });

  const [exerciseYear, setExerciseYear] = useState('');
  const [active, setActive] = useState<string>('all');
  const [natureCode, setNatureCode] = useState('');
  const [mappingVersion, setMappingVersion] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(new Date().getFullYear() - 1));
  const [natureInputMode, setNatureInputMode] = useState<'list' | 'free'>('list');
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [dupOpen, setDupOpen] = useState(false);
  const [dupSource, setDupSource] = useState('');
  const [dupTarget, setDupTarget] = useState('');
  const [dupRunning, setDupRunning] = useState(false);

  const yearHint = useMemo(() => {
    const y = parseInt(exerciseYear.trim(), 10);
    if (!Number.isNaN(y)) return y;
    const fromRows = rows.map((r) => r.exerciseYear);
    if (fromRows.length) return Math.max(...fromRows);
    return new Date().getFullYear() - 1;
  }, [exerciseYear, rows]);

  const distinctSourceYears = useMemo(() => {
    const s = new Set(rows.map((r) => r.exerciseYear));
    return Array.from(s).sort((a, b) => b - a);
  }, [rows]);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (exerciseYear.trim()) params.set('exerciseYear', exerciseYear.trim());
      if (active === 'true' || active === 'false') params.set('active', active);
      if (natureCode.trim()) params.set('natureCode', natureCode.trim());
      if (mappingVersion.trim()) params.set('mappingVersion', mappingVersion.trim());

      const res = await fetch(`/api/admin/lmnp/mapping-rules?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Erreur lors du chargement');
        return;
      }
      setRows(json.data);
      setMeta(
        json.meta ?? {
          properties: [],
          categories: [],
          natures: [],
          popularNatureCodes: [],
        },
      );
    } catch (e) {
      console.error(e);
      toast.error('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, [exerciseYear, active, natureCode, mappingVersion]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(yearHint));
    setNatureInputMode('list');
    setEditOpen(true);
  };

  const openEdit = (r: MappingRuleRow) => {
    setEditingId(r.id);
    setForm(rowToForm(r));
    // UX: en édition, si nature vide on propose la combobox par défaut.
    if (!r.natureCode) {
      setNatureInputMode('list');
    } else {
      const known = meta.natures.some((n) => n.code === r.natureCode);
      setNatureInputMode(known ? 'list' : 'free');
    }
    setEditOpen(true);
  };

  const saveRule = async () => {
    if (!form.lmnpBucket.trim() || !form.lmnpLabel.trim()) {
      toast.error('Bucket et libellé LMNP sont requis');
      return;
    }
    try {
      setSaving(true);
      const body = {
        exerciseYear: form.exerciseYear,
        propertyId: form.propertyId.trim() || undefined,
        natureCode: form.natureCode.trim() || undefined,
        categoryId: form.categoryId.trim() || undefined,
        lmnpBucket: form.lmnpBucket.trim(),
        lmnpLabel: form.lmnpLabel.trim(),
        priority: form.priority,
        active: form.active,
        mappingVersion: form.mappingVersion.trim() || '1',
      };

      const url = editingId ? `/api/admin/lmnp/mapping-rules/${editingId}` : '/api/admin/lmnp/mapping-rules';
      const method = editingId ? 'PATCH' : 'POST';
      const patchBody = editingId
        ? {
            exerciseYear: body.exerciseYear,
            propertyId: body.propertyId ?? null,
            natureCode: body.natureCode ?? null,
            categoryId: body.categoryId ?? null,
            lmnpBucket: body.lmnpBucket,
            lmnpLabel: body.lmnpLabel,
            priority: body.priority,
            active: body.active,
            mappingVersion: body.mappingVersion,
          }
        : body;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? patchBody : body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Enregistrement impossible');
        return;
      }
      toast.success(editingId ? 'Règle mise à jour' : 'Règle créée');
      setEditOpen(false);
      fetchRules();
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
      const res = await fetch(`/api/admin/lmnp/mapping-rules/${deleteId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Suppression impossible');
        return;
      }
      toast.success('Règle supprimée');
      setDeleteId(null);
      fetchRules();
    } catch (e) {
      console.error(e);
      toast.error('Erreur réseau');
    } finally {
      setDeleting(false);
    }
  };

  const runDuplicate = async () => {
    const sy = parseInt(dupSource, 10);
    const ty = parseInt(dupTarget, 10);
    if (Number.isNaN(sy) || Number.isNaN(ty)) {
      toast.error('Exercices source et cible invalides');
      return;
    }
    try {
      setDupRunning(true);
      const res = await fetch('/api/admin/lmnp/mapping-rules/duplicate-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceYear: sy, targetYear: ty }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Duplication impossible');
        return;
      }
      const { summary, skipped, errors } = json;
      toast.success(
        `Duplication : ${summary.createdCount} créée(s), ${summary.skippedCount} ignorée(s), ${summary.errorCount} erreur(s).`,
      );
      if (skipped?.length) {
        console.info('[LMNP duplicate skipped]', skipped);
      }
      if (errors?.length) {
        console.warn('[LMNP duplicate errors]', errors);
      }
      setDupOpen(false);
      fetchRules();
    } catch (e) {
      console.error(e);
      toast.error('Erreur réseau');
    } finally {
      setDupRunning(false);
    }
  };

  const propertyOptions = useMemo(
    () => [{ value: '', label: '— Tous les biens (règle globale au sens bien) —' }, ...meta.properties.map((p) => ({ value: p.id, label: p.name }))],
    [meta.properties],
  );

  const categoryOptions = useMemo(
    () => [{ value: '', label: '— Aucune catégorie —' }, ...meta.categories.map((c) => ({ value: c.id, label: `${c.label} (${c.slug})` }))],
    [meta.categories],
  );
  const natureOptions = useMemo(() => meta.natures, [meta.natures]);
  const popularNatureCodes = useMemo(
    () => meta.popularNatureCodes.map((x) => x.code).filter((c) => !!c),
    [meta.popularNatureCodes],
  );

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="h-4 w-4" /> Administration
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Règles d&apos;export LMNP</h1>
          <p className="text-gray-600 text-sm mt-1">
            Gestion des <code className="text-xs bg-gray-100 px-1 rounded">LmnpExportMappingRule</code> (CRUD + duplication d&apos;exercice). Tri : priorité puis code nature.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="soft" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle règle
          </Button>
          <Button type="button" variant="outline" onClick={() => { setDupSource(String(distinctSourceYears[0] ?? yearHint)); setDupTarget(String((distinctSourceYears[0] ?? yearHint) + 1)); setDupOpen(true); }}>
            <Copy className="h-4 w-4 mr-2" />
            Dupliquer un exercice
          </Button>
          <Link href="/admin/lmnp/anomalies">
            <Button variant="outline" type="button">
              Anomalies
            </Button>
          </Link>
          <Link href="/admin/lmnp/overrides">
            <Button variant="outline" type="button">
              Overrides
            </Button>
          </Link>
          <Link href="/admin/lmnp/runs">
            <Button variant="outline" type="button">
              Runs
            </Button>
          </Link>
          <Button type="button" variant="soft" onClick={() => fetchRules()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
          <CardDescription>Exercice, actif, code nature, version de mapping</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="f-year">Exercice</Label>
            <Input
              id="f-year"
              placeholder="ex. 2024"
              value={exerciseYear}
              onChange={(e) => setExerciseYear(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="f-active">Actif</Label>
            <Select
              id="f-active"
              className="mt-1"
              value={active}
              onChange={(e) => setActive(e.target.value)}
              options={[
                { value: 'all', label: 'Tous' },
                { value: 'true', label: 'Actifs' },
                { value: 'false', label: 'Inactifs' },
              ]}
            />
          </div>
          <div>
            <Label htmlFor="f-nature">Code nature</Label>
            <Input
              id="f-nature"
              placeholder="ex. RECETTE_LOYER"
              value={natureCode}
              onChange={(e) => setNatureCode(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="f-version">Version mapping</Label>
            <Input
              id="f-version"
              placeholder="ex. 1"
              value={mappingVersion}
              onChange={(e) => setMappingVersion(e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{loading ? 'Chargement…' : `${rows.length} règle(s)`}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Organisation</TableHeaderCell>
                <TableHeaderCell>Exercice</TableHeaderCell>
                <TableHeaderCell>Bien</TableHeaderCell>
                <TableHeaderCell>Nature</TableHeaderCell>
                <TableHeaderCell>Catégorie</TableHeaderCell>
                <TableHeaderCell>Bucket</TableHeaderCell>
                <TableHeaderCell>Libellé</TableHeaderCell>
                <TableHeaderCell>Priorité</TableHeaderCell>
                <TableHeaderCell>Ver.</TableHeaderCell>
                <TableHeaderCell>Actif</TableHeaderCell>
                <TableHeaderCell className="w-[220px] sticky right-0 z-20 bg-white border-l border-gray-200">
                  Actions
                </TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm max-w-[180px]" title={`ID : ${r.organizationId}`}>
                    <span className="font-medium text-gray-900">{r.organizationName ?? r.organizationId}</span>
                  </TableCell>
                  <TableCell>{r.exerciseYear}</TableCell>
                  <TableCell className="text-sm max-w-[160px] truncate" title={r.propertyId ?? ''}>
                    {r.propertyName ?? (r.propertyId ? `ID : ${r.propertyId}` : '—')}
                  </TableCell>
                  <TableCell className="text-sm">{r.natureCode ?? '—'}</TableCell>
                  <TableCell
                    className="text-sm max-w-[200px]"
                    title={
                      r.categoryId
                        ? r.categoryLabel
                          ? `ID : ${r.categoryId}`
                          : `Catégorie introuvable — ID : ${r.categoryId}`
                        : ''
                    }
                  >
                    {r.categoryLabel ? (
                      <>
                        <span className="font-medium text-gray-900">{r.categoryLabel}</span>
                        {r.categorySlug ? (
                          <span className="block text-xs text-gray-500 font-normal">{r.categorySlug}</span>
                        ) : null}
                      </>
                    ) : r.categoryId ? (
                      <span className="text-amber-700 text-xs">ID orphelin</span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{r.lmnpBucket}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate" title={r.lmnpLabel}>
                    {r.lmnpLabel}
                  </TableCell>
                  <TableCell>{r.priority}</TableCell>
                  <TableCell>{r.mappingVersion}</TableCell>
                  <TableCell>
                    {r.active ? (
                      <Badge variant="success">Oui</Badge>
                    ) : (
                      <Badge variant="gray">Non</Badge>
                    )}
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 bg-white border-l border-gray-200">
                    <div className="flex items-center gap-2 justify-end min-w-[200px]">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(r)}>
                        Modifier
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setDeleteId(r.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1 text-red-600" />
                        Supprimer
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier la règle' : 'Nouvelle règle'}</DialogTitle>
            <DialogDescription>
              Règles par exercice. Laisser bien / nature / catégorie vides pour des règles plus globales (voir priorité dans le moteur LMNP).
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div>
              <Label>Exercice</Label>
              <Input
                type="number"
                className="mt-1"
                value={form.exerciseYear}
                onChange={(e) => setForm((f) => ({ ...f, exerciseYear: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div>
              <Label>Bien (optionnel)</Label>
              <Select
                className="mt-1"
                value={form.propertyId}
                onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))}
                options={propertyOptions}
              />
            </div>
            <div>
              <Label>Code nature (optionnel)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button
                  type="button"
                  size="sm"
                  variant={natureInputMode === 'list' ? 'soft' : 'outline'}
                  onClick={() => setNatureInputMode('list')}
                >
                  Liste NatureEntity
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={natureInputMode === 'free' ? 'soft' : 'outline'}
                  onClick={() => setNatureInputMode('free')}
                >
                  Saisie libre
                </Button>
              </div>

              {natureInputMode === 'list' ? (
                <NatureCombobox
                  className="mt-2"
                  value={form.natureCode}
                  onChange={(code) => setForm((f) => ({ ...f, natureCode: code }))}
                />
              ) : (
                <Input
                  className="mt-2"
                  value={form.natureCode}
                  onChange={(e) => setForm((f) => ({ ...f, natureCode: e.target.value }))}
                  placeholder="Code exact (ex. DEPENSE_LOYER)"
                />
              )}

              <p className="text-xs text-gray-500 mt-1">
                Mode liste recommandé pour éviter les fautes de code.
              </p>
              {popularNatureCodes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {popularNatureCodes.slice(0, 8).map((code) => (
                    <button
                      key={code}
                      type="button"
                      className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50"
                      onClick={() => setForm((f) => ({ ...f, natureCode: code }))}
                      title="Code fréquent dans les transactions"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Catégorie (optionnel)</Label>
              <Select
                className="mt-1"
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                options={categoryOptions}
              />
            </div>
            <div>
              <Label>lmnpBucket</Label>
              <Input className="mt-1" value={form.lmnpBucket} onChange={(e) => setForm((f) => ({ ...f, lmnpBucket: e.target.value }))} />
            </div>
            <div>
              <Label>lmnpLabel</Label>
              <Input className="mt-1" value={form.lmnpLabel} onChange={(e) => setForm((f) => ({ ...f, lmnpLabel: e.target.value }))} />
            </div>
            <div>
              <Label>Priorité</Label>
              <Input
                type="number"
                className="mt-1"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div>
              <Label>Version mapping</Label>
              <Input className="mt-1" value={form.mappingVersion} onChange={(e) => setForm((f) => ({ ...f, mappingVersion: e.target.value }))} />
            </div>
            <div>
              <Label>Actif</Label>
              <Select
                className="mt-1"
                value={form.active ? 'true' : 'false'}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === 'true' }))}
                options={[
                  { value: 'true', label: 'Oui' },
                  { value: 'false', label: 'Non' },
                ]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="button" onClick={saveRule} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dupliquer les règles d&apos;un exercice</DialogTitle>
            <DialogDescription>
              Copie uniquement les <code className="text-xs">LmnpExportMappingRule</code> de votre organisation. Les règles déjà présentes sur l&apos;exercice cible avec la même combinaison (bien, nature, catégorie, version) sont ignorées.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Exercice source</Label>
              <Select
                className="mt-1"
                value={dupSource}
                onChange={(e) => setDupSource(e.target.value)}
                options={distinctSourceYears.length ? distinctSourceYears.map((y) => ({ value: String(y), label: String(y) })) : [{ value: String(yearHint), label: String(yearHint) }]}
              />
            </div>
            <div>
              <Label>Exercice cible</Label>
              <Input type="number" className="mt-1" value={dupTarget} onChange={(e) => setDupTarget(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDupOpen(false)} disabled={dupRunning}>
              Annuler
            </Button>
            <Button type="button" onClick={runDuplicate} disabled={dupRunning}>
              {dupRunning ? 'Duplication…' : 'Dupliquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer cette règle ?</DialogTitle>
            <DialogDescription>Action irréversible. Les exports LMNP futurs ne prendront plus cette règle en compte.</DialogDescription>
          </DialogHeader>
          {deleteId && <p className="text-xs font-mono break-all bg-gray-50 p-2 rounded">{deleteId}</p>}
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
