/**
 * Modal d'import des paramètres fiscaux
 * 3 étapes : Validation → Options → Diff/Confirmation
 */

'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Upload, CheckCircle, AlertTriangle, FileJson, Settings, Eye } from 'lucide-react';
import type {
  FiscalExportBundle,
  ImportValidationResult,
  ImportDryRunResult,
  ImportResult,
  ImportStrategy,
} from '@/types/fiscal-export';

interface ImportTaxModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'upload' | 'options' | 'preview' | 'importing' | 'done';

export function ImportTaxModal({ open, onClose, onSuccess }: ImportTaxModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [bundle, setBundle] = useState<FiscalExportBundle | null>(null);
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [dryRunResult, setDryRunResult] = useState<ImportDryRunResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  // Options d'import
  const [strategy, setStrategy] = useState<ImportStrategy>('merge');
  const [targetCode, setTargetCode] = useState('');
  const [importTypes, setImportTypes] = useState(true);
  const [importRegimes, setImportRegimes] = useState(true);
  const [importCompat, setImportCompat] = useState(true);

  // Fonction pour afficher le diff JSON avec coloration
  const renderJsonDiff = (oldObj: any, newObj: any, indent = 0): React.ReactNode => {
    if (!oldObj) return <pre className="whitespace-pre-wrap">{JSON.stringify(newObj, null, 2)}</pre>;
    
    const lines: React.ReactNode[] = [];
    const indentStr = '  '.repeat(indent);
    
    const renderValue = (key: string, oldVal: any, newVal: any, idx: number) => {
      const oldValStr = JSON.stringify(oldVal);
      const newValStr = JSON.stringify(newVal);
      
      if (oldValStr === newValStr) {
        // Inchangé
        return (
          <div key={idx} className="bg-gray-50">
            <span className="text-gray-600">{indentStr}"{key}": {newValStr}</span>
          </div>
        );
      } else if (oldVal !== undefined && newVal !== undefined) {
        // Modifié
        return (
          <div key={idx}>
            <div className="bg-red-50 line-through text-red-700">
              {indentStr}"{key}": {oldValStr}
            </div>
            <div className="bg-green-50 text-green-700">
              {indentStr}"{key}": {newValStr}
            </div>
          </div>
        );
      } else if (oldVal !== undefined) {
        // Supprimé
        return (
          <div key={idx} className="bg-red-50 line-through text-red-700">
            {indentStr}"{key}": {oldValStr}
          </div>
        );
      } else {
        // Ajouté
        return (
          <div key={idx} className="bg-green-50 text-green-700">
            {indentStr}"{key}": {newValStr}
          </div>
        );
      }
    };
    
    // Comparer les clés
    const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
    let i = 0;
    
    lines.push(<div key="open">{indentStr}{'{'}</div>);
    
    allKeys.forEach((key) => {
      const oldVal = oldObj?.[key];
      const newVal = newObj?.[key];
      
      if (Array.isArray(newVal) && Array.isArray(oldVal)) {
        // Tableau : comparer élément par élément
        const oldStr = JSON.stringify(oldVal);
        const newStr = JSON.stringify(newVal);
        
        if (oldStr === newStr) {
          // Tableau inchangé
          lines.push(
            <div key={`${key}-${i++}`} className="bg-gray-50">
              <span className="text-gray-600">{indentStr}"{key}": {newStr}</span>
            </div>
          );
        } else {
          // Tableau modifié : afficher avant/après
          lines.push(
            <div key={`${key}-${i++}`}>
              <div className="text-gray-700">{indentStr}"{key}": [</div>
              {/* Afficher les éléments modifiés */}
              {newVal.map((item, idx) => {
                const oldItem = oldVal[idx];
                const itemStr = JSON.stringify(item, null, 2).split('\n').map(line => `${indentStr}  ${line}`).join('\n');
                const oldItemStr = oldItem ? JSON.stringify(oldItem, null, 2).split('\n').map(line => `${indentStr}  ${line}`).join('\n') : null;
                
                if (oldItemStr && JSON.stringify(item) !== JSON.stringify(oldItem)) {
                  return (
                    <div key={idx}>
                      <div className="bg-red-50 line-through text-red-700 whitespace-pre">{oldItemStr}</div>
                      <div className="bg-green-50 text-green-700 whitespace-pre">{itemStr}</div>
                    </div>
                  );
                } else if (!oldItemStr) {
                  return (
                    <div key={idx} className="bg-green-50 text-green-700 whitespace-pre">{itemStr}</div>
                  );
                } else {
                  return (
                    <div key={idx} className="bg-gray-50 text-gray-600 whitespace-pre">{itemStr}</div>
                  );
                }
              })}
              <div className="text-gray-700">{indentStr}]</div>
            </div>
          );
        }
      } else if (typeof newVal === 'object' && newVal !== null && !Array.isArray(newVal) && typeof oldVal === 'object' && oldVal !== null && !Array.isArray(oldVal)) {
        // Objet imbriqué
        lines.push(
          <div key={`${key}-${i++}`}>
            <div className="text-gray-700">{indentStr}"{key}": {'{'}</div>
            {renderJsonDiff(oldVal, newVal, indent + 1)}
            <div className="text-gray-700">{indentStr}{'}'}</div>
          </div>
        );
      } else {
        lines.push(renderValue(key, oldVal, newVal, i++));
      }
    });
    
    lines.push(<div key="close">{indentStr}{'}'}</div>);
    
    return <div>{lines}</div>;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    try {
      const text = await selectedFile.text();
      const json = JSON.parse(text);
      
      setFile(selectedFile);
      setBundle(json);
      
      // Valider automatiquement
      await validateBundle(json);
    } catch (error) {
      alert('❌ Fichier JSON invalide');
      console.error(error);
    }
  };

  const validateBundle = async (bundleData: FiscalExportBundle) => {
    try {
      const response = await fetch('/api/admin/tax/import?mode=validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bundleData),
      });

      const data = await response.json();
      setValidationResult(data.result);

      if (data.result.valid) {
        // Pré-remplir le code de la version
        setTargetCode(bundleData.data.version.code);
        setStep('options');
      }
    } catch (error) {
      console.error('Erreur validation:', error);
      alert('❌ Erreur lors de la validation');
    }
  };

  const handleDryRun = async () => {
    if (!bundle) return;

    try {
      setStep('importing');
      
      const params = new URLSearchParams({
        mode: 'dry-run',
        strategy,
        targetCode: targetCode || bundle.data.version.code,
        importTypes: String(importTypes),
        importRegimes: String(importRegimes),
        importCompat: String(importCompat),
      });

      const response = await fetch(`/api/admin/tax/import?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bundle),
      });

      const data = await response.json();
      setDryRunResult(data.result);
      setStep('preview');
    } catch (error) {
      console.error('Erreur dry-run:', error);
      alert('❌ Erreur lors de la prévisualisation');
      setStep('options');
    }
  };

  const handleApply = async () => {
    if (!bundle) return;

    try {
      setStep('importing');
      
      const params = new URLSearchParams({
        mode: 'apply',
        strategy,
        targetCode: targetCode || bundle.data.version.code,
        importTypes: String(importTypes),
        importRegimes: String(importRegimes),
        importCompat: String(importCompat),
      });

      const response = await fetch(`/api/admin/tax/import?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bundle),
      });

      const data = await response.json();
      
      if (data.result.success) {
        setImportResult(data.result);
        setStep('done');
      } else {
        alert('❌ Erreur lors de l\'import');
        setStep('preview');
      }
    } catch (error) {
      console.error('Erreur import:', error);
      alert('❌ Erreur lors de l\'import');
      setStep('preview');
    }
  };

  const handleClose = () => {
    // Reset
    setStep('upload');
    setFile(null);
    setBundle(null);
    setValidationResult(null);
    setDryRunResult(null);
    setImportResult(null);
    setStrategy('merge');
    setTargetCode('');
    setImportTypes(true);
    setImportRegimes(true);
    setImportCompat(true);
    
    onClose();
  };

  const handleDone = () => {
    onSuccess();
    handleClose();
  };

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      title="Importer des paramètres fiscaux"
      size="xl"
    >
      <div className="space-y-6">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1 rounded ${step === 'upload' ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Upload className="h-4 w-4" />
            <span className="text-sm font-medium">1. Fichier</span>
          </div>
          <div className="h-px w-8 bg-gray-300" />
          <div className={`flex items-center gap-2 px-3 py-1 rounded ${step === 'options' ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Settings className="h-4 w-4" />
            <span className="text-sm font-medium">2. Options</span>
          </div>
          <div className="h-px w-8 bg-gray-300" />
          <div className={`flex items-center gap-2 px-3 py-1 rounded ${step === 'preview' || step === 'importing' || step === 'done' ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Eye className="h-4 w-4" />
            <span className="text-sm font-medium">3. Aperçu</span>
          </div>
        </div>

        {/* ========== ÉTAPE 1: UPLOAD ========== */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <FileJson className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 mb-4">
                Sélectionnez un fichier JSON exporté depuis SmartImmo
              </p>
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                id="import-file"
              />
              <label 
                htmlFor="import-file"
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <Upload className="mr-2 h-4 w-4" />
                Choisir un fichier
              </label>
            </div>

            {validationResult && !validationResult.valid && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-900 mb-2">Erreurs de validation</p>
                    <ul className="list-disc list-inside space-y-1">
                      {validationResult.errors.map((error, i) => (
                        <li key={i} className="text-sm text-red-800">{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== ÉTAPE 2: OPTIONS ========== */}
        {step === 'options' && validationResult && (
          <div className="space-y-6">
            {/* Résumé du fichier */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-900 mb-2">Fichier valide</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Version: <Badge variant="info">{bundle?.data.version.code}</Badge></div>
                    <div>Année: <Badge variant="secondary">{bundle?.data.version.year}</Badge></div>
                    <div>Types: <Badge variant="secondary">{validationResult.stats.typesCount}</Badge></div>
                    <div>Régimes: <Badge variant="secondary">{validationResult.stats.regimesCount}</Badge></div>
                    <div>Compatibilités: <Badge variant="secondary">{validationResult.stats.compatCount}</Badge></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Avertissements */}
            {validationResult.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-yellow-900 mb-2">Avertissements</p>
                    <ul className="list-disc list-inside space-y-1">
                      {validationResult.warnings.map((warning, i) => (
                        <li key={i} className="text-sm text-yellow-800">{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Options */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Options d'import</h3>

              {/* Code de version cible */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code de la version cible
                </label>
                <input
                  type="text"
                  value={targetCode}
                  onChange={(e) => setTargetCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: 2025.2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Si vide, utilise le code du fichier. Si existe, sera mis à jour (seulement si draft).
                </p>
              </div>

              {/* Stratégie */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stratégie d'import
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="merge"
                      checked={strategy === 'merge'}
                      onChange={(e) => setStrategy(e.target.value as ImportStrategy)}
                    />
                    <span className="text-sm">
                      Fusion (créer nouveaux + mettre à jour existants)
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="replace"
                      checked={strategy === 'replace'}
                      onChange={(e) => setStrategy(e.target.value as ImportStrategy)}
                    />
                    <span className="text-sm">
                      Remplacement (écraser les existants)
                    </span>
                  </label>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={importTypes}
                    onChange={(e) => setImportTypes(e.target.checked)}
                  />
                  <span className="text-sm">Importer les types fiscaux ({validationResult.stats.typesCount})</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={importRegimes}
                    onChange={(e) => setImportRegimes(e.target.checked)}
                  />
                  <span className="text-sm">Importer les régimes fiscaux ({validationResult.stats.regimesCount})</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={importCompat}
                    onChange={(e) => setImportCompat(e.target.checked)}
                  />
                  <span className="text-sm">Importer les compatibilités ({validationResult.stats.compatCount})</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="ghost" onClick={handleClose}>
                Annuler
              </Button>
              <Button onClick={handleDryRun}>
                Aperçu des changements
              </Button>
            </div>
          </div>
        )}

        {/* ========== ÉTAPE 3: PREVIEW ========== */}
        {step === 'preview' && dryRunResult && bundle && (
          <div className="space-y-6">
            <h3 className="font-semibold text-gray-900">Aperçu des modifications</h3>

            {/* Version */}
            {(dryRunResult.preview.versionToCreate || dryRunResult.preview.versionToUpdate) && (
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Version</h4>
                {dryRunResult.preview.versionToCreate && (
                  <Badge variant="success">
                    Nouvelle version: {dryRunResult.preview.versionToCreate.code}
                  </Badge>
                )}
                {dryRunResult.preview.versionToUpdate && (
                  <div>
                    <Badge variant="warning" className="mb-2">
                      Mise à jour: {dryRunResult.preview.versionToUpdate.id}
                    </Badge>
                    <ul className="text-sm text-gray-600 mt-2 space-y-1">
                      {dryRunResult.preview.versionToUpdate.changes.map((change, idx) => (
                        <li key={idx}>• {change}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Référentiels - Résumé */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Types</h4>
                <div className="space-y-1 text-sm">
                  <div className="text-green-600">
                    ✅ {dryRunResult.preview.typesToCreate.length} à créer
                  </div>
                  <div className="text-blue-600">
                    🔄 {dryRunResult.preview.typesToUpdate.length} à mettre à jour
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Régimes</h4>
                <div className="space-y-1 text-sm">
                  <div className="text-green-600">
                    ✅ {dryRunResult.preview.regimesToCreate.length} à créer
                  </div>
                  <div className="text-blue-600">
                    🔄 {dryRunResult.preview.regimesToUpdate.length} à mettre à jour
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Compatibilités</h4>
                <div className="space-y-1 text-sm">
                  <div className="text-green-600">
                    ✅ {dryRunResult.preview.compatToCreate.length} à créer
                  </div>
                  <div className="text-blue-600">
                    🔄 {dryRunResult.preview.compatToUpdate.length} à mettre à jour
                  </div>
                </div>
              </div>
            </div>

            {/* Détails des modifications - NOUVEAU */}
            <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
              <h4 className="font-medium text-gray-900 mb-3">Détails des modifications</h4>
              
              {/* Message si aucun changement */}
              {!dryRunResult.preview.versionToCreate && 
               !dryRunResult.preview.versionToUpdate &&
               dryRunResult.preview.typesToCreate.length === 0 &&
               dryRunResult.preview.typesToUpdate.length === 0 &&
               dryRunResult.preview.regimesToCreate.length === 0 &&
               dryRunResult.preview.regimesToUpdate.length === 0 &&
               dryRunResult.preview.compatToCreate.length === 0 &&
               dryRunResult.preview.compatToUpdate.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg mb-2">✅ Aucune modification détectée</p>
                  <p className="text-sm">
                    Les données du fichier sont identiques à celles actuellement en base.
                  </p>
                </div>
              )}
              
              {/* Types à créer/mettre à jour */}
              {bundle.data.types && bundle.data.types.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">📋 Types fiscaux</h5>
                  <ul className="space-y-1 text-sm">
                    {dryRunResult.preview.typesToCreate.map((id) => (
                      <li key={id} className="text-green-600 pl-4">
                        ✅ Créer: <code className="bg-green-50 px-2 py-0.5 rounded">{id}</code>
                        {' - '}
                        {bundle.data.types?.find(t => t.id === id)?.label}
                      </li>
                    ))}
                    {dryRunResult.preview.typesToUpdate.map((id) => (
                      <li key={id} className="text-blue-600 pl-4">
                        🔄 Mettre à jour: <code className="bg-blue-50 px-2 py-0.5 rounded">{id}</code>
                        {' - '}
                        {bundle.data.types?.find(t => t.id === id)?.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Régimes à créer/mettre à jour */}
              {bundle.data.regimes && bundle.data.regimes.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">⚖️ Régimes fiscaux</h5>
                  <ul className="space-y-1 text-sm">
                    {dryRunResult.preview.regimesToCreate.map((id) => (
                      <li key={id} className="text-green-600 pl-4">
                        ✅ Créer: <code className="bg-green-50 px-2 py-0.5 rounded">{id}</code>
                        {' - '}
                        {bundle.data.regimes?.find(r => r.id === id)?.label}
                      </li>
                    ))}
                    {dryRunResult.preview.regimesToUpdate.map((id) => (
                      <li key={id} className="text-blue-600 pl-4">
                        🔄 Mettre à jour: <code className="bg-blue-50 px-2 py-0.5 rounded">{id}</code>
                        {' - '}
                        {bundle.data.regimes?.find(r => r.id === id)?.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Compatibilités à créer/mettre à jour */}
              {bundle.data.compat && bundle.data.compat.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">🔗 Compatibilités</h5>
                  <ul className="space-y-1 text-sm">
                    {dryRunResult.preview.compatToCreate.map((id, idx) => (
                      <li key={idx} className="text-green-600 pl-4">
                        ✅ Créer: <code className="bg-green-50 px-2 py-0.5 rounded">{id}</code>
                      </li>
                    ))}
                    {dryRunResult.preview.compatToUpdate.map((id, idx) => (
                      <li key={idx} className="text-blue-600 pl-4">
                        🔄 Mettre à jour: <code className="bg-blue-50 px-2 py-0.5 rounded">{id}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Barèmes fiscaux - Preview JSON (seulement si modifiés) */}
              {bundle.data.params && dryRunResult.preview.versionToUpdate?.changes.some(c => c.includes('barèmes')) && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">💰 Barèmes fiscaux</h5>
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-2">
                    <p className="text-sm text-yellow-900">
                      ⚠️ Les barèmes fiscaux seront modifiés
                    </p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
                    <details open>
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800 mb-2">
                        Voir les modifications des barèmes
                      </summary>
                      <div className="mt-2">
                        {renderJsonDiff(dryRunResult.preview.versionToUpdate.oldParams, bundle.data.params.jsonData)}
                      </div>
                    </details>
                  </div>
                  <div className="flex gap-4 text-xs mt-2">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 bg-red-100 border border-red-300 rounded"></span>
                      <span className="text-gray-600">Supprimé</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 bg-green-100 border border-green-300 rounded"></span>
                      <span className="text-gray-600">Ajouté</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 bg-gray-100 border border-gray-300 rounded"></span>
                      <span className="text-gray-600">Inchangé</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirmation */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-900">
                ⚠️ <strong>Important:</strong>
              </p>
              <ul className="text-sm text-yellow-900 mt-2 space-y-1 ml-4 list-disc">
                {dryRunResult.preview.versionToUpdate && (
                  <li>
                    {bundle.data.version.status === 'draft' 
                      ? 'La version draft existante sera mise à jour'
                      : `Une nouvelle version sera créée automatiquement (la version ${targetCode || bundle.data.version.code} est publiée)`
                    }
                  </li>
                )}
                {dryRunResult.preview.versionToCreate && (
                  <li>Une nouvelle version <strong>draft</strong> sera créée</li>
                )}
                <li>Vous devrez la publier manuellement après vérification</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep('options')}>
                Retour
              </Button>
              <Button onClick={handleApply}>
                Confirmer l'import
              </Button>
            </div>
          </div>
        )}

        {/* ========== ÉTAPE: IMPORTING ========== */}
        {step === 'importing' && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <Upload className="h-8 w-8 text-blue-600 animate-pulse" />
            </div>
            <p className="text-lg font-medium text-gray-900">Import en cours...</p>
            <p className="text-sm text-gray-600 mt-2">Veuillez patienter</p>
          </div>
        )}

        {/* ========== ÉTAPE: DONE ========== */}
        {step === 'done' && importResult && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-lg font-medium text-gray-900 mb-2">Import réussi !</p>
              <p className="text-sm text-gray-600">
                Version <Badge variant="info">{importResult.versionCode}</Badge> {importResult.changes.version}
              </p>
            </div>

            {/* Résumé */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {importResult.changes.types.created + importResult.changes.types.updated}
                </p>
                <p className="text-sm text-gray-600">Types</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {importResult.changes.regimes.created + importResult.changes.regimes.updated}
                </p>
                <p className="text-sm text-gray-600">Régimes</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {importResult.changes.compat.created + importResult.changes.compat.updated}
                </p>
                <p className="text-sm text-gray-600">Compatibilités</p>
              </div>
            </div>

            {/* Action */}
            <div className="flex justify-end">
              <Button onClick={handleDone}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

