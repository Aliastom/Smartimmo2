'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Label } from '@/ui/shared/label';
import { Select } from '@/components/ui/Select';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Textarea } from '@/ui/shared/textarea';
import { ArrowLeft, RefreshCw, Wrench } from 'lucide-react';
import { toast } from 'sonner';

interface AnomalyRow {
  id: string;
  runId: string;
  entityType: string;
  entityId: string;
  severity: string;
  message: string;
  resolutionStatus: 'non_resolu' | 'override_presente';
  run: {
    exerciseYear: number;
    propertyId: string;
    propertyName: string | null;
    createdAt: string;
  };
}

interface Meta {
  properties: { id: string; name: string }[];
  exerciseYears: number[];
  recentRuns: { id: string; label: string }[];
}

export default function LmnpAnomaliesAdminClient() {
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AnomalyRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);

  const [severity, setSeverity] = useState<string>('all');
  const [exerciseYear, setExerciseYear] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [runId, setRunId] = useState(() => searchParams.get('runId') ?? '');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<AnomalyRow | null>(null);
  const [bucket, setBucket] = useState('');
  const [label, setLabel] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (severity === 'blocking' || severity === 'warning') params.set('severity', severity);
      if (exerciseYear.trim()) params.set('exerciseYear', exerciseYear.trim());
      if (propertyId) params.set('propertyId', propertyId);
      if (runId) params.set('runId', runId);

      const res = await fetch(`/api/admin/lmnp/anomalies?${params.toString()}`);
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
  }, [severity, exerciseYear, propertyId, runId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const r = searchParams.get('runId');
    if (r) setRunId(r);
  }, [searchParams]);

  const openOverrideDialog = (row: AnomalyRow) => {
    setSelected(row);
    setBucket('A_CLASSER');
    setLabel(`Override export LMNP (${row.entityType})`);
    setReason(`Créé depuis anomalie ${row.id.slice(0, 8)}…`);
    setDialogOpen(true);
  };

  const submitOverride = async () => {
    if (!selected) return;
    if (!bucket.trim() || !label.trim()) {
      toast.error('Bucket et libellé sont requis');
      return;
    }
    try {
      setSaving(true);
      const res = await fetch('/api/admin/lmnp/overrides/from-anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anomalyId: selected.id,
          lmnpBucket: bucket.trim(),
          lmnpLabel: label.trim(),
          reason: reason.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Échec de la création');
        return;
      }
      toast.success('Override enregistré (la transaction source n’a pas été modifiée)');
      setDialogOpen(false);
      setSelected(null);
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error('Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  const resolutionBadge = (status: AnomalyRow['resolutionStatus']) => {
    if (status === 'override_presente') {
      return <Badge variant="success">Override présent</Badge>;
    }
    return <Badge variant="gray">Non résolu</Badge>;
  };

  const severityBadge = (sev: string) => {
    if (sev === 'blocking') return <Badge variant="danger">Bloquant</Badge>;
    if (sev === 'warning') return <Badge variant="warning">Avertissement</Badge>;
    return <Badge>{sev}</Badge>;
  };

  const yearOptions = [
    { value: '', label: 'Tous les exercices' },
    ...(meta?.exerciseYears ?? []).map((y) => ({ value: String(y), label: String(y) })),
  ];

  const propertyOptions = [
    { value: '', label: 'Tous les biens' },
    ...(meta?.properties ?? []).map((p) => ({ value: p.id, label: p.name })),
  ];

  const runOptions = [
    { value: '', label: 'Tous les runs' },
    ...(meta?.recentRuns ?? []).map((r) => ({ value: r.id, label: r.label })),
  ];

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="h-4 w-4" /> Administration
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Anomalies export LMNP</h1>
          <p className="text-gray-600 text-sm mt-1">
            Liste des <code className="text-xs bg-gray-100 px-1 rounded">LmnpExportAnomaly</code> ; résolution déduite d&apos;un{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">LmnpExportOverride</code> sur la même entité.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/lmnp/mapping-rules">
            <Button variant="outline" type="button">
              Règles de mapping
            </Button>
          </Link>
          <Link href="/admin/lmnp/overrides">
            <Button variant="outline" type="button">
              Overrides
            </Button>
          </Link>
          <Link href="/admin/lmnp/runs">
            <Button variant="outline" type="button">
              Historique runs
            </Button>
          </Link>
          <Button type="button" variant="soft" onClick={() => fetchData()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
          <CardDescription>Sévérité, exercice, bien, run d&apos;export</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="a-sev">Sévérité</Label>
            <Select
              id="a-sev"
              className="mt-1"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              options={[
                { value: 'all', label: 'Toutes' },
                { value: 'blocking', label: 'Bloquant' },
                { value: 'warning', label: 'Avertissement' },
              ]}
            />
          </div>
          <div>
            <Label htmlFor="a-year">Exercice</Label>
            <Select
              id="a-year"
              className="mt-1"
              value={exerciseYear}
              onChange={(e) => setExerciseYear(e.target.value)}
              options={yearOptions}
            />
          </div>
          <div>
            <Label htmlFor="a-prop">Bien</Label>
            <Select
              id="a-prop"
              className="mt-1"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              options={propertyOptions}
            />
          </div>
          <div>
            <Label htmlFor="a-run">Run</Label>
            <Select id="a-run" className="mt-1" value={runId} onChange={(e) => setRunId(e.target.value)} options={runOptions} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{loading ? 'Chargement…' : `${rows.length} anomalie(s)`}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Run</TableHeaderCell>
                <TableHeaderCell>Exercice / bien</TableHeaderCell>
                <TableHeaderCell>Entité</TableHeaderCell>
                <TableHeaderCell>Sévérité</TableHeaderCell>
                <TableHeaderCell>Message</TableHeaderCell>
                <TableHeaderCell>Résolution</TableHeaderCell>
                <TableHeaderCell className="w-[120px]">Action</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs max-w-[100px] truncate" title={r.runId}>
                    {r.runId}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{r.run.exerciseYear}</div>
                    <div className="text-gray-500 truncate max-w-[180px]" title={r.run.propertyName ?? r.run.propertyId}>
                      {r.run.propertyName ?? r.run.propertyId}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="font-medium">{r.entityType}</span>
                    <div className="font-mono text-xs truncate max-w-[140px]" title={r.entityId}>
                      {r.entityId}
                    </div>
                  </TableCell>
                  <TableCell>{severityBadge(r.severity)}</TableCell>
                  <TableCell className="text-sm max-w-[320px] whitespace-pre-wrap break-words">{r.message}</TableCell>
                  <TableCell>{resolutionBadge(r.resolutionStatus)}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="whitespace-nowrap"
                      onClick={() => openOverrideDialog(r)}
                    >
                      <Wrench className="h-3 w-3 mr-1" />
                      Override
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Créer un override LMNP</DialogTitle>
            <DialogDescription>
              Enregistre un <code className="text-xs">LmnpExportOverride</code> pour l&apos;entité de l&apos;anomalie. Aucune modification sur la transaction ou le document source.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <p className="text-gray-600">
                <strong>Entité :</strong> {selected.entityType} / {selected.entityId}
              </p>
              <div>
                <Label htmlFor="ov-bucket">lmnpBucket</Label>
                <Input id="ov-bucket" className="mt-1" value={bucket} onChange={(e) => setBucket(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ov-label">lmnpLabel</Label>
                <Input id="ov-label" className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ov-reason">Raison (optionnel)</Label>
                <Textarea id="ov-reason" className="mt-1" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="button" onClick={submitOverride} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
