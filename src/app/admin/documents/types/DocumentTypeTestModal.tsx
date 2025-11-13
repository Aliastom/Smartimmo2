'use client';

import React, { useState } from 'react';
import { DocumentTypeAdmin } from '@/types/admin-documents';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Label } from '@/ui/shared/label';
import { Textarea } from '@/ui/shared/textarea';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Loader2, Play, Upload, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface TestResult {
  classification: {
    top3: Array<{
      typeId: string;
      typeLabel: string;
      score: number;
      confidence: number;
    }>;
    autoAssigned: boolean;
    autoAssignedType?: string;
  };
  extraction: Array<{
    fieldName: string;
    value: string;
    confidence: number;
    ruleUsed: string;
  }>;
}

interface DocumentTypeTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: DocumentTypeAdmin;
}

export default function DocumentTypeTestModal({
  isOpen,
  onClose,
  documentType,
}: DocumentTypeTestModalProps) {
  const [testText, setTestText] = useState('');
  const [testFile, setTestFile] = useState<File | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');

  const handleTest = async () => {
    if (!testText.trim() && !testFile) {
      alert('Veuillez saisir du texte ou sélectionner un fichier');
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);

      const formData = new FormData();
      formData.append('documentTypeId', documentType.id);
      
      if (activeTab === 'text') {
        formData.append('text', testText);
      } else if (testFile) {
        formData.append('file', testFile);
      }

      const response = await fetch(`/api/admin/document-types/${documentType.id}/test`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Erreur lors du test');
      }

      const result = await response.json();
      setTestResult(result.data);
    } catch (error) {
      console.error('Erreur lors du test:', error);
      alert('Erreur lors du test de classification/extraction');
    } finally {
      setIsTesting(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setTestFile(file || null);
    setTestText('');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'danger';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return <CheckCircle className="w-4 h-4" />;
    if (confidence >= 0.6) return <AlertCircle className="w-4 h-4" />;
    return <XCircle className="w-4 h-4" />;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Test: ${documentType.label}`}
      size="xl"
    >
      <div className="space-y-6">
        {/* Configuration du test */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Configuration du test</h3>
          
          <div className="mb-4">
            <Label>Type de test</Label>
            <div className="flex space-x-4 mt-2">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="testType"
                  checked={activeTab === 'text'}
                  onChange={() => setActiveTab('text')}
                  className="rounded border-gray-300"
                />
                <span>Texte libre</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="testType"
                  checked={activeTab === 'file'}
                  onChange={() => setActiveTab('file')}
                  className="rounded border-gray-300"
                />
                <span>Fichier</span>
              </label>
            </div>
          </div>

          {activeTab === 'text' ? (
            <div>
              <Label htmlFor="testText">Texte à analyser</Label>
              <Textarea
                id="testText"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="Collez ici le texte d'un document à analyser..."
                rows={8}
              />
              <p className="text-sm text-gray-500 mt-1">
                Vous pouvez coller du texte extrait d'un PDF, d'une image, ou d'un document Word.
              </p>
            </div>
          ) : (
            <div>
              <Label htmlFor="testFile">Fichier à analyser</Label>
              <div className="mt-2">
                <input
                  id="testFile"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.txt,.doc,.docx"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {testFile && (
                  <div className="mt-2 p-2 bg-gray-50 rounded flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{testFile.name}</span>
                    <span className="text-xs text-gray-500">
                      ({(testFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-4">
            <Button
              onClick={handleTest}
              disabled={isTesting || (!testText.trim() && !testFile)}
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {isTesting ? 'Test en cours...' : 'Lancer le test'}
            </Button>
          </div>
        </Card>

        {/* Résultats du test */}
        {testResult && (
          <div className="space-y-6">
            {/* Classification */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Résultats de classification</h3>
              
              <div className="space-y-3">
                {testResult.classification.top3.map((result, index) => (
                  <div
                    key={result.typeId}
                    className={`p-4 rounded-lg border ${
                      index === 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge variant={index === 0 ? 'primary' : 'secondary'}>
                          #{index + 1}
                        </Badge>
                        <span className="font-medium">{result.typeLabel}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getConfidenceColor(result.confidence)}>
                          {getConfidenceIcon(result.confidence)}
                          {(result.confidence * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            index === 0 ? 'bg-blue-600' : 'bg-gray-400'
                          }`}
                          style={{ width: `${result.confidence * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Auto-assignation:</span>
                  <Badge variant={testResult.classification.autoAssigned ? 'success' : 'secondary'}>
                    {testResult.classification.autoAssigned ? 'Oui' : 'Non'}
                  </Badge>
                </div>
                {testResult.classification.autoAssignedType && (
                  <p className="text-sm text-gray-600 mt-1">
                    Type assigné: {testResult.classification.autoAssignedType}
                  </p>
                )}
              </div>
            </Card>

            {/* Extraction */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Résultats d'extraction</h3>
              
              {testResult.extraction.length > 0 ? (
                <div className="space-y-3">
                  {testResult.extraction.map((field, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{field.fieldName}</span>
                        <Badge variant={getConfidenceColor(field.confidence)}>
                          {getConfidenceIcon(field.confidence)}
                          {(field.confidence * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <p className="text-sm font-mono">{field.value}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Règle utilisée: {field.ruleUsed}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Aucun champ extrait</p>
                  <p className="text-sm">Vérifiez les règles d'extraction configurées</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
