/**
 * Modal d'export des paramètres fiscaux
 * Permet de sélectionner une version à exporter
 */

'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Download, CheckCircle } from 'lucide-react';

interface ExportTaxModalProps {
  open: boolean;
  onClose: () => void;
}

export function ExportTaxModal({ open, onClose }: ExportTaxModalProps) {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [includeRefs, setIncludeRefs] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (open) {
      loadVersions();
    }
  }, [open]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tax/versions');
      if (response.ok) {
        const data = await response.json();
        setVersions(data);
        // Sélectionner la dernière version publiée par défaut
        const published = data.find((v: any) => v.status === 'published');
        if (published) {
          setSelectedVersion(published.code);
        } else if (data.length > 0) {
          setSelectedVersion(data[0].code);
        }
      }
    } catch (error) {
      console.error('Erreur chargement versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedVersion) {
      alert('⚠️ Veuillez sélectionner une version');
      return;
    }

    setExporting(true);
    try {
      const response = await fetch(
        `/api/admin/tax/export?version=${selectedVersion}&includeRefs=${includeRefs}`
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smartimmo-tax-${selectedVersion}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        alert('✅ Export réussi');
        onClose();
      } else {
        const error = await response.json();
        alert(`❌ Erreur: ${error.error}`);
      }
    } catch (error) {
      console.error('Erreur export:', error);
      alert('❌ Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <Badge variant="success">
            <CheckCircle className="mr-1 h-3 w-3" />
            Publié
          </Badge>
        );
      case 'draft':
        return <Badge variant="secondary">Brouillon</Badge>;
      case 'archived':
        return <Badge variant="outline">Archivé</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Exporter des paramètres fiscaux"
      size="lg"
    >
      <div className="space-y-6">
        {/* Sélection de la version */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Version à exporter
          </label>
          
          {loading && (
            <div className="text-center py-4 text-gray-500">
              Chargement des versions...
            </div>
          )}

          {!loading && versions.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              Aucune version disponible
            </div>
          )}

          {!loading && versions.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
              {versions.map((version) => (
                <label
                  key={version.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedVersion === version.code
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="version"
                    value={version.code}
                    checked={selectedVersion === version.code}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    className="h-4 w-4 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{version.code}</span>
                      <span className="text-sm text-gray-500">({version.year})</span>
                      {getStatusBadge(version.status)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {version.source}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Options d'export */}
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Options d'export</h3>
          
          <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={includeRefs}
              onChange={(e) => setIncludeRefs(e.target.checked)}
              className="h-4 w-4 text-blue-600 mt-0.5"
            />
            <div className="flex-1">
              <div className="font-medium text-sm">Inclure les référentiels</div>
              <div className="text-xs text-gray-600 mt-1">
                Exporter également les types fiscaux, régimes et compatibilités
              </div>
            </div>
          </label>
        </div>

        {/* Informations */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            ℹ️ Le fichier JSON contiendra :
          </p>
          <ul className="list-disc list-inside text-sm text-blue-800 mt-2 space-y-1">
            <li>Version fiscale et barèmes</li>
            {includeRefs && (
              <>
                <li>Types fiscaux (FONCIER, BIC, IS)</li>
                <li>Régimes fiscaux (MICRO, REEL, etc.)</li>
                <li>Règles de compatibilités</li>
              </>
            )}
            <li>Checksum SHA-256 pour garantir l'intégrité</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button variant="ghost" onClick={onClose} disabled={exporting}>
            Annuler
          </Button>
          <Button
            onClick={handleExport}
            disabled={!selectedVersion || exporting}
          >
            {exporting ? (
              <>
                <Download className="mr-2 h-4 w-4 animate-pulse" />
                Export en cours...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exporter
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

