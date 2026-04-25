'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Label } from '@/ui/shared/label';
import { Select } from '@/components/ui/Select';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Drawer';
import { ArrowLeft, FileJson, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/utils/cn';

interface RunRow {
  runId: string;
  id: string;
  organizationId: string;
  propertyId: string;
  propertyName: string | null;
  exerciseYear: number;
  mappingVersion: string;
  status: string;
  coverageRate: number;
  anomalyCount: number;
  createdAt: string;
  createdByUserId: string | null;
}

interface RunDetail extends RunRow {
  manifestJson: string;
  manifestParsed: unknown;
  anomalies: { id: string; entityType: string; entityId: string; severity: string; message: string }[];
}

interface Meta {
  properties: { id: string; name: string }[];
  exerciseYears: number[];
  statuses: string[];
}

type DrawerTab = 'resume' | 'manifest' | 'brut' | 'anomalies';

export default function LmnpRunsAdminClient() {
  const searchParams = useSearchParams();
  const deepLinkOpened = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RunRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);

  const [exerciseYear, setExerciseYear] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [status, setStatus] = useState('');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('resume');
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (exerciseYear) params.set('exerciseYear', exerciseYear);
      if (propertyId) params.set('propertyId', propertyId);
      if (status) params.set('status', status);

      const res = await fetch(`/api/admin/lmnp/runs?${params.toString()}`);
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
  }, [exerciseYear, propertyId, status]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const openRun = useCallback(async (id: string) => {
    setSheetOpen(true);
    setDrawerTab('resume');
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/lmnp/runs/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Détail introuvable');
        setSheetOpen(false);
        return;
      }
      setDetail(json.data as RunDetail);
    } catch (e) {
      console.error(e);
      toast.error('Erreur réseau');
      setSheetOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = searchParams.get('openRun');
    if (!id || deepLinkOpened.current === id) return;
    deepLinkOpened.current = id;
    void openRun(id);
  }, [searchParams, openRun]);

  const statusBadge = (s: string) => {
    if (s === 'completed') return <Badge variant="success">{s}</Badge>;
    if (s === 'failed') return <Badge variant="danger">{s}</Badge>;
    if (s === 'dry_run') return <Badge variant="info">{s}</Badge>;
    return <Badge variant="gray">{s}</Badge>;
  };

  const yearOptions = [{ value: '', label: 'Tous' }, ...(meta?.exerciseYears ?? []).map((y) => ({ value: String(y), label: String(y) }))];
  const propertyOptions = [{ value: '', label: 'Tous les biens' }, ...(meta?.properties ?? []).map((p) => ({ value: p.id, label: p.name }))];
  const statusOptions = [{ value: '', label: 'Tous les statuts' }, ...(meta?.statuses ?? []).map((s) => ({ value: s, label: s }))];

  const manifestPretty =
    detail?.manifestParsed !== undefined && detail?.manifestParsed !== null
      ? JSON.stringify(detail.manifestParsed, null, 2)
      : null;

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-primary-600 hover:underline inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="h-4 w-4" /> Administration
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Historique des runs LMNP</h1>
          <p className="text-gray-600 text-sm mt-1">
            Consultation des <code className="text-xs bg-gray-100 px-1 rounded">LmnpExportRun</code> et du manifeste JSON.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/lmnp/overrides">
            <Button variant="outline" type="button">
              Overrides
            </Button>
          </Link>
          <Link href="/admin/lmnp/anomalies">
            <Button variant="outline" type="button">
              Anomalies
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
          <CardDescription>Exercice, bien, statut du run</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="r-year">Exercice</Label>
            <Select id="r-year" className="mt-1" value={exerciseYear} onChange={(e) => setExerciseYear(e.target.value)} options={yearOptions} />
          </div>
          <div>
            <Label htmlFor="r-prop">Bien</Label>
            <Select id="r-prop" className="mt-1" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} options={propertyOptions} />
          </div>
          <div>
            <Label htmlFor="r-status">Statut</Label>
            <Select id="r-status" className="mt-1" value={status} onChange={(e) => setStatus(e.target.value)} options={statusOptions} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{loading ? 'Chargement…' : `${rows.length} run(s)`}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Date génération</TableHeaderCell>
                <TableHeaderCell>Bien</TableHeaderCell>
                <TableHeaderCell>Exercice</TableHeaderCell>
                <TableHeaderCell>Ver. mapping</TableHeaderCell>
                <TableHeaderCell>Couverture</TableHeaderCell>
                <TableHeaderCell>Anomalies</TableHeaderCell>
                <TableHeaderCell>Statut</TableHeaderCell>
                <TableHeaderCell className="font-mono text-xs">runId</TableHeaderCell>
                <TableHeaderCell className="w-[110px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.runId}>
                  <TableCell className="text-sm whitespace-nowrap">{new Date(r.createdAt).toLocaleString('fr-FR')}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate" title={r.propertyName ?? r.propertyId}>
                    {r.propertyName ?? r.propertyId}
                  </TableCell>
                  <TableCell>{r.exerciseYear}</TableCell>
                  <TableCell>{r.mappingVersion}</TableCell>
                  <TableCell>{(r.coverageRate * 100).toFixed(1)}%</TableCell>
                  <TableCell>{r.anomalyCount}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[120px] truncate" title={r.runId}>
                    {r.runId}
                  </TableCell>
                  <TableCell>
                    <Button type="button" size="sm" variant="outline" onClick={() => openRun(r.runId)}>
                      <FileJson className="h-3.5 w-3.5 mr-1" />
                      Détail
                    </Button>
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
        title="Run LMNP"
        size="lg"
      >
        <p className="text-sm text-gray-500 pb-4">Manifeste et anomalies en lecture seule.</p>

        {detailLoading && <p className="text-sm text-gray-500 py-6">Chargement…</p>}

        {!detailLoading && detail && (
          <div className="space-y-4">
              <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
                {(['resume', 'manifest', 'brut', 'anomalies'] as DrawerTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-md border transition-colors',
                      drawerTab === tab
                        ? 'bg-orange-50 border-orange-200 text-orange-800 font-medium'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
                    )}
                    onClick={() => setDrawerTab(tab)}
                  >
                    {tab === 'resume' && 'Résumé'}
                    {tab === 'manifest' && 'Manifeste (JSON)'}
                    {tab === 'brut' && 'Manifeste brut'}
                    {tab === 'anomalies' && `Anomalies (${detail.anomalies?.length ?? 0})`}
                  </button>
                ))}
              </div>

              {drawerTab === 'resume' && (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-gray-500">runId</dt>
                    <dd className="font-mono text-xs break-all">{detail.runId}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Date</dt>
                    <dd>{new Date(detail.createdAt).toLocaleString('fr-FR')}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Bien</dt>
                    <dd>{detail.propertyName ?? detail.propertyId}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Exercice</dt>
                    <dd>{detail.exerciseYear}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">mappingVersion</dt>
                    <dd>{detail.mappingVersion}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">coverageRate</dt>
                    <dd>{(detail.coverageRate * 100).toFixed(2)}%</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">anomalyCount</dt>
                    <dd>{detail.anomalyCount}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">status</dt>
                    <dd>{statusBadge(detail.status)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-gray-500">createdByUserId</dt>
                    <dd className="font-mono text-xs">{detail.createdByUserId ?? '—'}</dd>
                  </div>
                </dl>
              )}

              {drawerTab === 'manifest' && (
                <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded-md overflow-x-auto max-h-[70vh]">
                  {manifestPretty ?? 'JSON invalide ou vide — voir onglet brut.'}
                </pre>
              )}

              {drawerTab === 'brut' && (
                <pre className="text-xs bg-gray-50 border border-gray-200 p-3 rounded-md overflow-x-auto max-h-[70vh] whitespace-pre-wrap break-all">
                  {detail.manifestJson}
                </pre>
              )}

              {drawerTab === 'anomalies' && (
                <ul className="space-y-2 text-sm max-h-[70vh] overflow-y-auto">
                  {(detail.anomalies ?? []).map((a) => (
                    <li key={a.id} className="border border-gray-200 rounded-md p-2">
                      <div className="flex flex-wrap gap-2 items-center mb-1">
                        {a.severity === 'blocking' ? <Badge variant="danger">blocking</Badge> : <Badge variant="warning">warning</Badge>}
                        <span className="font-medium">{a.entityType}</span>
                        <span className="font-mono text-xs">{a.entityId}</span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{a.message}</p>
                    </li>
                  ))}
                  {(!detail.anomalies || detail.anomalies.length === 0) && (
                    <li className="text-gray-500">Aucune anomalie enregistrée sur ce run.</li>
                  )}
                </ul>
              )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
