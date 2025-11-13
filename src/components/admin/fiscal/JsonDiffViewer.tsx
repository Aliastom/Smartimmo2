/**
 * Composant Diff Viewer pour comparer deux versions fiscales
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Loader2, Plus, Minus, Edit3, AlertCircle } from 'lucide-react';

interface JsonDiffViewerProps {
  open: boolean;
  onClose: () => void;
  fromVersionId: string;
  toVersionId: string;
}

interface DiffChange {
  field: string;
  oldValue: any;
  newValue: any;
  type: 'added' | 'modified' | 'removed';
}

export function JsonDiffViewer({ open, onClose, fromVersionId, toVersionId }: JsonDiffViewerProps) {
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<any>(null);

  useEffect(() => {
    if (open && fromVersionId && toVersionId) {
      loadDiff();
    }
  }, [open, fromVersionId, toVersionId]);

  const loadDiff = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/tax/diff?from=${fromVersionId}&to=${toVersionId}`
      );

      if (response.ok) {
        const data = await response.json();
        setDiff(data);
      }
    } catch (error) {
      console.error('Erreur chargement diff:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'added':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'removed':
        return <Minus className="h-4 w-4 text-red-600" />;
      case 'modified':
        return <Edit3 className="h-4 w-4 text-orange-600" />;
      default:
        return null;
    }
  };

  const getChangeBadge = (type: string) => {
    switch (type) {
      case 'added':
        return <Badge variant="success">+ Ajouté</Badge>;
      case 'removed':
        return <Badge variant="danger">- Supprimé</Badge>;
      case 'modified':
        return <Badge variant="warning">~ Modifié</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatValue = (value: any, fieldName?: string) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') {
      // Champs qui ne sont PAS des montants en euros
      const nonEuroFields = ['year', 'reportYears', 'dureeReport', 'engagementYears', 'plafondMaxPASSMultiple'];
      const isNonEuro = fieldName && nonEuroFields.some(f => fieldName.includes(f));
      
      // Si c'est un taux (entre 0 et 1) et pas un champ spécial
      if (value > 0 && value < 1 && !isNonEuro) {
        return `${(value * 100).toFixed(2)}%`;
      }
      
      // Si c'est un champ non-euro (année, durée, etc.)
      if (isNonEuro) {
        return value.toString();
      }
      
      // Sinon c'est un montant en euros
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
      }).format(value);
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const groupChangesByCategory = (changes: DiffChange[]) => {
    const grouped: Record<string, DiffChange[]> = {
      IR: [],
      PS: [],
      Micro: [],
      'Déficit Foncier': [],
      PER: [],
      'SCI IS': [],
      LMP: [],
      Autres: [],
    };

    changes.forEach((change) => {
      if (change.field.includes('irBrackets') || change.field.includes('irDecote')) {
        grouped.IR.push(change);
      } else if (change.field.includes('psRate')) {
        grouped.PS.push(change);
      } else if (change.field.includes('micro')) {
        grouped.Micro.push(change);
      } else if (change.field.includes('deficitFoncier')) {
        grouped['Déficit Foncier'].push(change);
      } else if (change.field.includes('per')) {
        grouped.PER.push(change);
      } else if (change.field.includes('sciIS')) {
        grouped['SCI IS'].push(change);
      } else if (change.field.includes('lmp')) {
        grouped.LMP.push(change);
      } else {
        grouped.Autres.push(change);
      }
    });

    return grouped;
  };

  if (!diff) {
    return null;
  }

  const groupedChanges = groupChangesByCategory(diff.changes || []);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comparaison des versions fiscales</DialogTitle>
          <DialogDescription>
            Différences entre {diff.from.code} et {diff.to.code}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && diff.changes.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Aucune différence détectée</p>
            <p className="text-sm mt-2">Les deux versions sont identiques</p>
          </div>
        )}

        {!loading && diff.changes.length > 0 && (
          <>
            {/* Résumé */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Plus className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <div className="text-2xl font-bold">
                      {diff.changes.filter((c: any) => c.type === 'added').length}
                    </div>
                    <div className="text-sm text-gray-600">Ajouts</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Edit3 className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                    <div className="text-2xl font-bold">
                      {diff.changes.filter((c: any) => c.type === 'modified').length}
                    </div>
                    <div className="text-sm text-gray-600">Modifications</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Minus className="h-8 w-8 mx-auto mb-2 text-red-600" />
                    <div className="text-2xl font-bold">
                      {diff.changes.filter((c: any) => c.type === 'removed').length}
                    </div>
                    <div className="text-sm text-gray-600">Suppressions</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Onglets par catégorie */}
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">
                  Tous ({diff.changes.length})
                </TabsTrigger>
                <TabsTrigger value="ir">IR ({groupedChanges.IR.length})</TabsTrigger>
                <TabsTrigger value="micro">Micro ({groupedChanges.Micro.length})</TabsTrigger>
                <TabsTrigger value="other">Autres</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <div className="space-y-3">
                  {diff.changes.map((change: DiffChange, index: number) => (
                    <div
                      key={index}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getChangeIcon(change.type)}
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {change.field}
                          </code>
                        </div>
                        {getChangeBadge(change.type)}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Ancienne valeur</div>
                          <div className="bg-red-50 border border-red-200 rounded p-2 font-mono">
                            {formatValue(change.oldValue, change.field)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Nouvelle valeur</div>
                          <div className="bg-green-50 border border-green-200 rounded p-2 font-mono">
                            {formatValue(change.newValue, change.field)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="ir" className="mt-4">
                <ChangesList changes={groupedChanges.IR} formatValue={formatValue} getChangeIcon={getChangeIcon} getChangeBadge={getChangeBadge} />
              </TabsContent>

              <TabsContent value="micro" className="mt-4">
                <ChangesList changes={groupedChanges.Micro} formatValue={formatValue} getChangeIcon={getChangeIcon} getChangeBadge={getChangeBadge} />
              </TabsContent>

              <TabsContent value="other" className="mt-4">
                <div className="space-y-2">
                  {Object.entries(groupedChanges).map(([category, changes]) => {
                    if (category === 'IR' || category === 'Micro' || changes.length === 0) return null;
                    return (
                      <div key={category}>
                        <h4 className="font-semibold mb-2">{category}</h4>
                        <ChangesList changes={changes} formatValue={formatValue} getChangeIcon={getChangeIcon} getChangeBadge={getChangeBadge} />
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Composant helper pour afficher une liste de changements
function ChangesList({ changes, formatValue, getChangeIcon, getChangeBadge }: any) {
  if (changes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Aucune modification dans cette catégorie
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {changes.map((change: DiffChange, index: number) => (
        <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {getChangeIcon(change.type)}
              <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                {change.field}
              </code>
            </div>
            {getChangeBadge(change.type)}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-500 mb-1">Ancienne valeur</div>
              <div className="bg-red-50 border border-red-200 rounded p-2 font-mono">
                {formatValue(change.oldValue, change.field)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Nouvelle valeur</div>
              <div className="bg-green-50 border border-green-200 rounded p-2 font-mono">
                {formatValue(change.newValue, change.field)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

