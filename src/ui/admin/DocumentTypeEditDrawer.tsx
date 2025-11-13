'use client';

import React, { useState, useEffect } from 'react';
import { DocumentType, DocumentTypeCreateData, DocumentTypeUpdateData, DocumentSuggestionConfig, DocumentMetadataSchema } from '@/types/document';
import { Button } from '@/ui/shared/button';
import { Input } from '@/ui/shared/input';
import { Label } from '@/ui/shared/label';
import { Textarea } from '@/ui/shared/textarea';
import { Badge } from '@/ui/shared/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/shared/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/shared/tabs';
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  Copy, 
  Eye, 
  EyeOff, 
  TestTube,
  AlertCircle,
  CheckCircle,
  FileText,
  Settings,
  Shield,
  Database,
  Code
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentTypeEditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  documentType?: DocumentType;
  onSave: (data: DocumentTypeCreateData | DocumentTypeUpdateData) => Promise<void>;
  availableTypes: DocumentType[];
}

const AVAILABLE_CONTEXTS = [
  { value: 'transaction', label: 'Transaction' },
  { value: 'lease', label: 'Bail' },
  { value: 'property', label: 'Propriété' },
  { value: 'tenant', label: 'Locataire' },
  { value: 'loan', label: 'Prêt' },
  { value: 'global', label: 'Global' },
];

const AVAILABLE_MIME_TYPES = [
  'application/pdf',
  'image/*',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/*',
];

export function DocumentTypeEditDrawer({
  isOpen,
  onClose,
  documentType,
  onSave,
  availableTypes,
}: DocumentTypeEditDrawerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  
  // État du formulaire
  const [formData, setFormData] = useState<DocumentTypeCreateData>({
    code: '',
    label: '',
    icon: '',
    order: 0,
    isSensitive: false,
    defaultContexts: [],
    suggestionConfig: {
      rules: [],
      defaults_by_context: {},
      mime_overrides: {},
      postprocess: {
        min_confidence_for_autoselect: 0.8,
        ask_top3_below: 0.5,
      },
    },
    lockInFlows: [],
    metadataSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  });

  // État pour le bac à sable
  const [sandboxInput, setSandboxInput] = useState({
    context: 'global',
    filename: '',
    mime: 'application/pdf',
    ocrText: '',
  });
  const [sandboxResult, setSandboxResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Initialiser le formulaire
  useEffect(() => {
    if (documentType) {
      setFormData({
        code: documentType.code,
        label: documentType.label,
        icon: documentType.icon || '',
        order: documentType.order || 0,
        isSensitive: documentType.isSensitive,
        defaultContexts: documentType.defaultContexts || [],
        suggestionConfig: documentType.suggestionConfig || {
          rules: [],
          defaults_by_context: {},
          mime_overrides: {},
          postprocess: {
            min_confidence_for_autoselect: 0.8,
            ask_top3_below: 0.5,
          },
        },
        lockInFlows: documentType.lockInFlows || [],
        metadataSchema: documentType.metadataSchema || {
          type: 'object',
          properties: {},
          required: [],
        },
      });
    } else {
      // Nouveau type
      setFormData({
        code: '',
        label: '',
        icon: '',
        order: 0,
        isSensitive: false,
        defaultContexts: [],
        suggestionConfig: {
          rules: [],
          defaults_by_context: {},
          mime_overrides: {},
          postprocess: {
            min_confidence_for_autoselect: 0.8,
            ask_top3_below: 0.5,
          },
        },
        lockInFlows: [],
        metadataSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      });
    }
  }, [documentType, isOpen]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave(formData);
      toast({
        title: "Type de document sauvegardé",
        description: `Le type "${formData.label}" a été sauvegardé avec succès.`,
      });
      onClose();
    } catch (error: any) {
      toast({
        title: "Erreur de sauvegarde",
        description: error.message || "Une erreur est survenue lors de la sauvegarde.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSandboxTest = async () => {
    try {
      setIsTesting(true);
      const response = await fetch('/api/admin/document-types/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sandboxInput),
      });
      
      const result = await response.json();
      setSandboxResult(result);
    } catch (error) {
      toast({
        title: "Erreur de test",
        description: "Impossible de tester la suggestion.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const addSuggestionRule = () => {
    const newRule = {
      pattern: '',
      apply_in: ['global'],
      mime_in: [],
      ocr_keywords: [],
      weight: 5,
      type_code: formData.code || 'MISC',
      lock: false,
    };
    
    setFormData(prev => ({
      ...prev,
      suggestionConfig: {
        ...prev.suggestionConfig!,
        rules: [...prev.suggestionConfig!.DocumentExtractionRule, newRule],
      },
    }));
  };

  const updateSuggestionRule = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      suggestionConfig: {
        ...prev.suggestionConfig!,
        rules: prev.suggestionConfig!.DocumentExtractionRule.map((rule, i) => 
          i === index ? { ...rule, [field]: value } : rule
        ),
      },
    }));
  };

  const removeSuggestionRule = (index: number) => {
    setFormData(prev => ({
      ...prev,
      suggestionConfig: {
        ...prev.suggestionConfig!,
        rules: prev.suggestionConfig!.DocumentExtractionRule.filter((_, i) => i !== index),
      },
    }));
  };

  const duplicateSuggestionRule = (index: number) => {
    const rule = formData.suggestionConfig!.rules[index];
    setFormData(prev => ({
      ...prev,
      suggestionConfig: {
        ...prev.suggestionConfig!,
        rules: [...prev.suggestionConfig!.DocumentExtractionRule, { ...rule }],
      },
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-base-content/50" onClick={onClose} />
      
      <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-base-100 shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold">
                {documentType ? 'Modifier le type de document' : 'Nouveau type de document'}
              </h2>
              {documentType?.isSystem && (
                <Badge variant="secondary" className="mt-1">
                  <Shield className="mr-1 h-3 w-3" />
                  Type système
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="general">
                  <Settings className="mr-2 h-4 w-4" />
                  Général
                </TabsTrigger>
                <TabsTrigger value="suggestion">
                  <Code className="mr-2 h-4 w-4" />
                  Suggestion
                </TabsTrigger>
                <TabsTrigger value="locks">
                  <Shield className="mr-2 h-4 w-4" />
                  Verrous
                </TabsTrigger>
                <TabsTrigger value="metadata">
                  <Database className="mr-2 h-4 w-4" />
                  Métadonnées
                </TabsTrigger>
                <TabsTrigger value="sandbox">
                  <TestTube className="mr-2 h-4 w-4" />
                  Bac à sable
                </TabsTrigger>
              </TabsList>

              <div className="h-[calc(100vh-200px)] overflow-y-auto p-6">
                {/* Onglet Général */}
                <TabsContent value="general" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Informations de base</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="code">Code *</Label>
                          <Input
                            id="code"
                            value={formData.code}
                            onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                            placeholder="EXEMPLE_TYPE"
                            disabled={documentType?.isSystem}
                          />
                          {documentType?.isSystem && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Le code ne peut pas être modifié pour les types système
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="label">Libellé *</Label>
                          <Input
                            id="label"
                            value={formData.label}
                            onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                            placeholder="Exemple Type"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="icon">Icône</Label>
                          <Input
                            id="icon"
                            value={formData.icon}
                            onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                            placeholder="FileText"
                          />
                        </div>
                        <div>
                          <Label htmlFor="order">Ordre</Label>
                          <Input
                            id="order"
                            type="number"
                            value={formData.order}
                            onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="isSensitive"
                          checked={formData.isSensitive}
                          onChange={(e) => setFormData(prev => ({ ...prev, isSensitive: e.target.checked }))}
                          className="rounded"
                        />
                        <Label htmlFor="isSensitive">Document sensible (restriction d'accès)</Label>
                      </div>

                      <div>
                        <Label>Contextes par défaut</Label>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {AVAILABLE_CONTEXTS.map(context => (
                            <label key={context.value} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={formData.defaultContexts.includes(context.value)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData(prev => ({
                                      ...prev,
                                      defaultContexts: [...prev.defaultContexts, context.value]
                                    }));
                                  } else {
                                    setFormData(prev => ({
                                      ...prev,
                                      defaultContexts: prev.defaultContexts.filter(c => c !== context.value)
                                    }));
                                  }
                                }}
                                className="rounded"
                              />
                              <span className="text-sm">{context.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Onglet Suggestion */}
                <TabsContent value="suggestion" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Configuration des suggestions automatiques</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium">Règles de suggestion</h3>
                        <Button onClick={addSuggestionRule} size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          Ajouter une règle
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {formData.suggestionConfig!.DocumentExtractionRule.map((rule, index) => (
                          <Card key={index} className="p-4">
                            <div className="flex justify-between items-start mb-4">
                              <h4 className="font-medium">Règle {index + 1}</h4>
                              <div className="flex space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => duplicateSuggestionRule(index)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeSuggestionRule(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Pattern (regex)</Label>
                                <Input
                                  value={rule.pattern}
                                  onChange={(e) => updateSuggestionRule(index, 'pattern', e.target.value)}
                                  placeholder="(quittance|loyer)"
                                />
                              </div>
                              <div>
                                <Label>Poids (0-10)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="10"
                                  value={rule.weight}
                                  onChange={(e) => updateSuggestionRule(index, 'weight', parseInt(e.target.value))}
                                />
                              </div>
                            </div>

                            <div className="mt-4">
                              <Label>Contextes d'application</Label>
                              <div className="grid grid-cols-3 gap-2 mt-2">
                                {AVAILABLE_CONTEXTS.map(context => (
                                  <label key={context.value} className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      checked={rule.apply_in.includes(context.value)}
                                      onChange={(e) => {
                                        const newApplyIn = e.target.checked
                                          ? [...rule.apply_in, context.value]
                                          : rule.apply_in.filter(c => c !== context.value);
                                        updateSuggestionRule(index, 'apply_in', newApplyIn);
                                      }}
                                      className="rounded"
                                    />
                                    <span className="text-sm">{context.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div className="mt-4">
                              <Label>Types MIME (optionnel)</Label>
                              <Input
                                value={rule.mime_in?.join(', ') || ''}
                                onChange={(e) => updateSuggestionRule(index, 'mime_in', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                placeholder="application/pdf, image/*"
                              />
                            </div>

                            <div className="mt-4">
                              <Label>Mots-clés OCR (optionnel)</Label>
                              <Input
                                value={rule.ocr_keywords?.join(', ') || ''}
                                onChange={(e) => updateSuggestionRule(index, 'ocr_keywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                placeholder="quittance, loyer, mois de"
                              />
                            </div>

                            <div className="mt-4 flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`rule-lock-${index}`}
                                checked={rule.lock}
                                onChange={(e) => updateSuggestionRule(index, 'lock', e.target.checked)}
                                className="rounded"
                              />
                              <Label htmlFor={`rule-lock-${index}`}>Verrouiller cette règle</Label>
                            </div>
                          </Card>
                        ))}
                      </div>

                      {formData.suggestionConfig!.DocumentExtractionRule.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          Aucune règle configurée. Cliquez sur "Ajouter une règle" pour commencer.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Onglet Verrous */}
                <TabsContent value="locks" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Verrous de flux</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Les verrous empêchent la modification du type de document dans certains flux spécifiques.
                      </p>
                      
                      <div>
                        <Label>Flux verrouillés</Label>
                        <Textarea
                          value={formData.lockInFlows.join('\n')}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            lockInFlows: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) 
                          }))}
                          placeholder="rent_receipt_generation&#10;lease_auto_generation"
                          rows={4}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Un flux par ligne (ex: rent_receipt_generation)
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Onglet Métadonnées */}
                <TabsContent value="metadata" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Schéma de métadonnées</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Définissez un schéma JSON pour les métadonnées spécifiques à ce type de document.
                      </p>
                      
                      <div>
                        <Label>Schéma JSON</Label>
                        <Textarea
                          value={JSON.stringify(formData.metadataSchema, null, 2)}
                          onChange={(e) => {
                            try {
                              const parsed = JSON.parse(e.target.value);
                              setFormData(prev => ({ ...prev, metadataSchema: parsed }));
                            } catch {
                              // Ignorer les erreurs de parsing pendant la saisie
                            }
                          }}
                          rows={12}
                          className="font-mono text-sm"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Onglet Bac à sable */}
                <TabsContent value="sandbox" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Bac à sable - Test de suggestion</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Contexte</Label>
                          <select
                            value={sandboxInput.context}
                            onChange={(e) => setSandboxInput(prev => ({ ...prev, context: e.target.value }))}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            {AVAILABLE_CONTEXTS.map(context => (
                              <option key={context.value} value={context.value}>
                                {context.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label>Type MIME</Label>
                          <Input
                            value={sandboxInput.mime}
                            onChange={(e) => setSandboxInput(prev => ({ ...prev, mime: e.target.value }))}
                            placeholder="application/pdf"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Nom de fichier</Label>
                        <Input
                          value={sandboxInput.filename}
                          onChange={(e) => setSandboxInput(prev => ({ ...prev, filename: e.target.value }))}
                          placeholder="quittance_loyer_octobre_2024.pdf"
                        />
                      </div>

                      <div>
                        <Label>Texte OCR (optionnel)</Label>
                        <Textarea
                          value={sandboxInput.ocrText}
                          onChange={(e) => setSandboxInput(prev => ({ ...prev, ocrText: e.target.value }))}
                          placeholder="Quittance de loyer pour le mois d'octobre 2024..."
                          rows={3}
                        />
                      </div>

                      <Button onClick={handleSandboxTest} disabled={isTesting || !sandboxInput.filename}>
                        <TestTube className="mr-2 h-4 w-4" />
                        {isTesting ? 'Test en cours...' : 'Tester la suggestion'}
                      </Button>

                      {sandboxResult && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-sm">Résultat du test</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {sandboxResult.success ? (
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <CheckCircle className="h-4 w-4 text-success" />
                                  <span className="font-medium">
                                    Type suggéré: {sandboxResult.result.type_code}
                                  </span>
                                  <Badge variant="outline">
                                    {Math.round(sandboxResult.result.confidence * 100)}% de confiance
                                  </Badge>
                                </div>
                                
                                {sandboxResult.result.alternatives.length > 0 && (
                                  <div>
                                    <p className="text-sm font-medium">Alternatives:</p>
                                    <ul className="text-sm text-muted-foreground">
                                      {sandboxResult.result.alternatives.map((alt: any, index: number) => (
                                        <li key={index}>
                                          • {alt.type_code} ({Math.round(alt.confidence * 100)}%)
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                
                                {sandboxResult.result.evidence.length > 0 && (
                                  <div>
                                    <p className="text-sm font-medium">Évidence:</p>
                                    <ul className="text-sm text-muted-foreground">
                                      {sandboxResult.result.evidence.map((evidence: string, index: number) => (
                                        <li key={index}>• {evidence}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 text-error">
                                <AlertCircle className="h-4 w-4" />
                                <span>Erreur: {sandboxResult.error}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-2 border-t px-6 py-4">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.code || !formData.label}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
