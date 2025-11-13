'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Label } from '@/ui/shared/label';
import { Textarea } from '@/ui/shared/textarea';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/shared/tabs';
import { Loader2, Play, Upload, FileText, CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface DocumentTypeWithCounts {
  id: string;
  code: string;
  label: string;
  description?: string;
  isActive: boolean;
  autoAssignThreshold?: number;
  keywordsCount: number;
  signalsCount: number;
  rulesCount: number;
}

interface TestResult {
  classification: {
    top3: Array<{
      typeId: string;
      typeLabel: string;
      score: number;
      confidence: number;
      matchedKeywords: Array<{
        keyword: string;
        weight: number;
      }>;
      matchedSignals: Array<{
        code: string;
        label: string;
        weight: number;
      }>;
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

interface DocumentTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: DocumentTypeWithCounts | null;
}

export default function DocumentTestModal({
  isOpen,
  onClose,
  documentType,
}: DocumentTestModalProps) {
  const [testText, setTestText] = useState('');
  const [testFile, setTestFile] = useState<File | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [selectedTypeForExtraction, setSelectedTypeForExtraction] = useState<string>('');

  const handleTest = async () => {
    if (!testText.trim() && !testFile) {
      toast.error('Veuillez saisir du texte ou sélectionner un fichier');
      return;
    }

    try {
      setIsTesting(true);
      setTestResult(null);

      const formData = new FormData();
      
      if (activeTab === 'text') {
        formData.append('text', testText);
      } else if (testFile) {
        formData.append('file', testFile);
      }

      const url = documentType 
        ? `/api/admin/document-types/${documentType.id}/test`
        : `/api/admin/document-types/test-global?documentTypeId=${selectedTypeForExtraction}`;

      const response = await fetch(url, {
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
      toast.error('Erreur lors du test de classification/extraction');
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
    if (confidence >= 0.8) return 'default';
    if (confidence >= 0.6) return 'secondary';
    return 'destructive';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return <CheckCircle className="w-4 h-4" />;
    if (confidence >= 0.6) return <AlertCircle className="w-4 h-4" />;
    return <XCircle className="w-4 h-4" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {documentType ? `Test: ${documentType.label}` : 'Test Global de Classification'}
          </DialogTitle>
          <DialogDescription>
            Testez la classification et l'extraction de données avec du texte ou un fichier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Configuration du test */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration du test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'text' | 'file')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text">Texte</TabsTrigger>
                  <TabsTrigger value="file">Fichier</TabsTrigger>
                </TabsList>
                
                <TabsContent value="text" className="space-y-4">
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
                      {documentType 
                        ? `Le système testera ce texte contre le type "${documentType.label}"`
                        : 'Le système testera ce texte contre tous les types de documents configurés'
                      }
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="file" className="space-y-4">
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
                </TabsContent>
              </Tabs>

              <div>
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
            </CardContent>
          </Card>

          {/* Résultats du test */}
          {testResult && (
            <div className="space-y-6">
              {/* Classification */}
              <Card>
                <CardHeader>
                  <CardTitle>Résultats de classification</CardTitle>
                </CardHeader>
                <CardContent>
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
                            <Badge variant={index === 0 ? 'default' : 'secondary'}>
                              #{index + 1}
                            </Badge>
                            <span className="font-medium">{result.typeLabel}</span>
                            {!documentType && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedTypeForExtraction(result.typeId)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
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

                        {/* Détails des matches */}
                        {(result.matchedKeywords.length > 0 || result.matchedSignals.length > 0) && (
                          <div className="mt-3 text-sm">
                            {result.matchedKeywords.length > 0 && (
                              <div className="mb-2">
                                <span className="font-medium text-gray-700">Mots-clés trouvés:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {result.matchedKeywords.map((keyword, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {keyword.keyword} (+{keyword.weight})
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {result.matchedSignals.length > 0 && (
                              <div>
                                <span className="font-medium text-gray-700">Signaux détectés:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {result.matchedSignals.map((signal, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {signal.label} (+{signal.weight})
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Auto-assignation:</span>
                      <Badge variant={testResult.classification.autoAssigned ? 'default' : 'secondary'}>
                        {testResult.classification.autoAssigned ? 'Oui' : 'Non'}
                      </Badge>
                    </div>
                    {testResult.classification.autoAssignedType && (
                      <p className="text-sm text-gray-600 mt-1">
                        Type assigné: {testResult.classification.autoAssignedType}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Extraction */}
              {testResult.extraction.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Résultats d'extraction</CardTitle>
                  </CardHeader>
                  <CardContent>
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
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button variant="ghost" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
