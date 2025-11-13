'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Archive, Download, Upload, Clock, Database, AlertTriangle, CheckCircle, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BackupRecord {
  id: string;
  createdAt: string;
  createdBy: string;
  scope: string;
  sizeBytes: number;
  checksum: string;
  note?: string;
  meta: any;
}

interface BackupSchedule {
  id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  hour: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  retentionDays: number;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
}

export default function BackupManagementCard() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'validate' | 'dry-run' | 'apply'>('validate');
  const [importStrategy, setImportStrategy] = useState<'merge' | 'replace'>('merge');
  const [importResult, setImportResult] = useState<any>(null);

  // Ne plus charger automatiquement au montage pour éviter les erreurs 401
  // Les données seront chargées quand l'utilisateur clique sur les boutons
  // useEffect(() => {
  //   loadHistory();
  //   loadSchedule();
  // }, []);

  const loadHistory = async () => {
    try {
      const response = await fetch('/api/admin/backup/history');
      if (!response.ok) {
        // Ignore silencieusement les erreurs d'auth au chargement initial
        if (response.status === 401 || response.status === 403) {
          return;
        }
      }
      const data = await response.json();
      if (data.success) {
        setHistory(data.data);
      }
    } catch (error) {
      // Erreur silencieuse, pas critique au chargement
      console.debug('History not available:', error);
    }
  };

  const loadSchedule = async () => {
    try {
      const response = await fetch('/api/admin/backup/schedule');
      if (!response.ok) {
        // Ignore silencieusement les erreurs d'auth au chargement initial
        if (response.status === 401 || response.status === 403) {
          return;
        }
      }
      const data = await response.json();
      if (data.success) {
        setSchedule(data.data);
      }
    } catch (error) {
      // Erreur silencieuse, pas critique au chargement
      console.debug('Schedule not available:', error);
    }
  };

  // Export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/admin/backup/export?scope=admin&includeSensitive=false');
      
      if (!response.ok) {
        throw new Error('Erreur lors de l\'export');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartimmo-admin-backup-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('✅ Export réussi ! Le fichier a été téléchargé.');
      loadHistory();
    } catch (error) {
      console.error('Export error:', error);
      toast.error('❌ Erreur lors de l\'export');
    } finally {
      setIsExporting(false);
    }
  };

  // Import
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error('Fichier trop volumineux (max 25 Mo)');
        return;
      }
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error('Veuillez sélectionner un fichier');
      return;
    }

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(
        `/api/admin/backup/import?mode=${importMode}&strategy=${importStrategy}`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();

      if (!data.success) {
        toast.error('❌ Erreur lors de l\'import');
        setImportResult({ error: data.error, details: data.details });
        return;
      }

      setImportResult(data.data);

      if (importMode === 'validate' || importMode === 'dry-run') {
        toast.success('✅ Validation réussie ! Consultez le résumé ci-dessous.');
      } else {
        toast.success('✅ Import appliqué avec succès !');
        loadHistory();
        setShowImportModal(false);
        setSelectedFile(null);
        setImportResult(null);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('❌ Erreur lors de l\'import');
    } finally {
      setIsImporting(false);
    }
  };

  // Planification
  const handleSaveSchedule = async (scheduleData: Partial<BackupSchedule>) => {
    try {
      const response = await fetch('/api/admin/backup/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('✅ Planification enregistrée');
        setSchedule(data.data);
        setShowScheduleModal(false);
      } else {
        toast.error('❌ Erreur lors de la planification');
      }
    } catch (error) {
      console.error('Schedule error:', error);
      toast.error('❌ Erreur lors de la planification');
    }
  };

  const handleDeleteSchedule = async () => {
    try {
      const response = await fetch('/api/admin/backup/schedule', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('✅ Planification désactivée');
        setSchedule(null);
      } else {
        toast.error('❌ Erreur lors de la désactivation');
      }
    } catch (error) {
      console.error('Delete schedule error:', error);
      toast.error('❌ Erreur lors de la désactivation');
    }
  };

  // Format taille fichier
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-all duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-purple-100 text-purple-600">
                <Archive className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg">Sauvegarde Globale</CardTitle>
                <CardDescription className="text-sm">
                  Export/Import de toute la base admin (paramètres, référentiels, barèmes)
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Actions principales */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2"
              variant="outline"
            >
              <Download className="h-4 w-4" />
              {isExporting ? 'Export en cours...' : 'Tout Exporter'}
            </Button>

            <Button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2"
              variant="outline"
            >
              <Upload className="h-4 w-4" />
              Tout Importer
            </Button>
          </div>

          {/* Actions secondaires */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => {
                setShowScheduleModal(true);
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Planifier
            </Button>

            <Button
              onClick={() => {
                loadHistory();
                setShowHistoryModal(true);
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Historique
            </Button>
          </div>

          {/* Info planification */}
          {schedule && schedule.isActive && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">
                    Planification active : {schedule.frequency === 'daily' && 'Quotidienne'}
                    {schedule.frequency === 'weekly' && 'Hebdomadaire'}
                    {schedule.frequency === 'monthly' && 'Mensuelle'}
                  </p>
                  <p className="text-blue-700 text-xs mt-1">
                    Prochaine exécution : {schedule.nextRunAt && format(new Date(schedule.nextRunAt), 'PPP à HH:mm', { locale: fr })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Import */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Importer une sauvegarde
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {/* Étape 1: Sélection fichier */}
              <div>
                <label className="block text-sm font-medium mb-2">1. Sélectionner le fichier .zip</label>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {selectedFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    Fichier sélectionné : {selectedFile.name} ({formatSize(selectedFile.size)})
                  </p>
                )}
              </div>

              {/* Étape 2: Options */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">2. Options d'import</label>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Mode</label>
                  <select
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value as any)}
                    className="w-full p-2 border rounded-lg text-sm"
                  >
                    <option value="validate">Valider uniquement (sans modification)</option>
                    <option value="dry-run">Dry-run (prévisualisation complète)</option>
                    <option value="apply">Appliquer les changements</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Stratégie</label>
                  <select
                    value={importStrategy}
                    onChange={(e) => setImportStrategy(e.target.value as any)}
                    className="w-full p-2 border rounded-lg text-sm"
                  >
                    <option value="merge">Fusion (conserver l'existant, ajouter le nouveau)</option>
                    <option value="replace">Remplacement (écraser l'existant)</option>
                  </select>
                </div>
              </div>

              {/* Étape 3: Résultat */}
              {importResult && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium mb-2">3. Résultat</label>
                  
                  {importResult.error ? (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-800 font-medium">{importResult.error}</p>
                      {importResult.details && (
                        <p className="text-red-700 text-sm mt-1">{JSON.stringify(importResult.details)}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {importResult.diff && (
                        <div className="p-3 bg-gray-50 border rounded-lg text-sm">
                          <p className="font-medium mb-2">Aperçu des changements :</p>
                          <ul className="space-y-1">
                            <li className="text-green-700">✅ Ajouts : {importResult.diff.adds}</li>
                            <li className="text-blue-700">🔄 Mises à jour : {importResult.diff.updates}</li>
                            <li className="text-orange-700">🗑️ Suppressions : {importResult.diff.deletes}</li>
                          </ul>
                        </div>
                      )}

                      {importResult.applied && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                          <p className="font-medium text-green-800">Changements appliqués avec succès !</p>
                          <ul className="text-green-700 mt-1 space-y-1">
                            <li>✅ {importResult.applied.adds} ajouts</li>
                            <li>🔄 {importResult.applied.updates} mises à jour</li>
                            <li>🗑️ {importResult.applied.deletes} suppressions</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedFile(null);
                  setImportResult(null);
                }}
              >
                Fermer
              </Button>
              <Button
                onClick={handleImport}
                disabled={!selectedFile || isImporting}
              >
                {isImporting ? 'Import en cours...' : 'Importer'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historique */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Historique des sauvegardes
              </h3>
            </div>

            <div className="p-6">
              {history.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucune sauvegarde enregistrée</p>
              ) : (
                <div className="space-y-3">
                  {history.map((backup) => (
                    <div key={backup.id} className="p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{format(new Date(backup.createdAt), 'PPP à HH:mm', { locale: fr })}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            Par {backup.createdBy} • {formatSize(backup.sizeBytes)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 font-mono">{backup.checksum.slice(0, 16)}...</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-xs">
                            Télécharger
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs">
                            Restaurer
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end">
              <Button variant="ghost" onClick={() => setShowHistoryModal(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Planification - TODO: Implémenter formulaire complet */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold">Planifier les sauvegardes automatiques</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600">Fonctionnalité à implémenter avec formulaire complet</p>
            </div>
            <div className="p-6 border-t flex justify-end">
              <Button variant="ghost" onClick={() => setShowScheduleModal(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

