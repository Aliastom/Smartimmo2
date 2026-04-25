'use client';

import React, { useId, useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/ui/shared/label';
import { Textarea } from '@/ui/shared/textarea';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Switch } from '@/components/ui/Switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/shared/tabs';
import { Separator } from '@/components/ui/Separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { 
  Save, 
  X, 
  Eye, 
  EyeOff, 
  Plus, 
  Edit, 
  Trash2, 
  Play,
  Wand2,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { useJsonField, JSON_EXAMPLES } from '@/hooks/useJsonField';
import { DocumentTypeWithRelations } from '@/types/document-types';
import KeywordsManagement from './KeywordsManagement';
import TypeSignalsManagement from './TypeSignalsManagement';
import RulesManagement from './RulesManagement';
import { FormShellStandard, SaveActionStandard } from '@/components/ui/standards';

interface DocumentTypeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: DocumentTypeWithRelations | null;
  onSave: (data: any) => Promise<void>;
  defaultTab?: string;
}

export default function DocumentTypeFormModal({
  isOpen,
  onClose,
  documentType,
  onSave,
  defaultTab = 'keywords',
}: DocumentTypeFormModalProps) {
  const formId = useId();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDetailed, setShowDetailed] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isThresholdValid, setIsThresholdValid] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [fullDocumentType, setFullDocumentType] = useState<any>(null);
  const [formData, setFormData] = useState({
    code: '',
    label: '',
    description: '',
    order: 0,
    isActive: true,
    isSensitive: false,
    autoAssignThreshold: 0.85,
    openTransaction: false,
  });

  // JSON fields avec validation
  const defaultContexts = useJsonField({ initial: '[]' });
  const suggestionsConfig = useJsonField({ initial: '{}' });
  const flowLocks = useJsonField({ initial: '[]' });
  const metaSchema = useJsonField({ initial: '{}' });

  // Réinitialiser l'onglet actif quand le defaultTab change
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Charger les détails complets du type depuis l'API
  useEffect(() => {
    if (documentType?.id && isOpen) {
      setIsLoadingDetails(true);
      fetch(`/api/admin/document-types/${documentType.id}`)
        .then(res => res.json())
        .then(result => {
          if (result.success) {
            console.log('[DocumentTypeFormModal] 🔄 Données complètes rechargées:', result.data.code);
            setFullDocumentType(result.data);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingDetails(false));
    }
  }, [documentType?.id, isOpen]);

  // Charger les données du type existant
  useEffect(() => {
    const typeToLoad = fullDocumentType || documentType;
    
    if (typeToLoad) {
      console.log('[DocumentTypeFormModal] 📥 Chargement type:', typeToLoad.code);
      console.log('[DocumentTypeFormModal] 🤖 openTransaction du serveur:', typeToLoad.openTransaction);
      
      const newFormData = {
        code: typeToLoad.code || '',
        label: typeToLoad.label || '',
        description: typeToLoad.description || '',
        order: typeToLoad.order ?? 0,
        isActive: typeToLoad.isActive ?? true,
        isSensitive: typeToLoad.isSensitive ?? false,
        autoAssignThreshold: typeToLoad.autoAssignThreshold ?? 0.85,
        openTransaction: typeToLoad.openTransaction ?? false,
      };
      
      console.log('[DocumentTypeFormModal] 📝 Nouveau formData:', newFormData);
      setFormData(newFormData);
      
      console.log('[DocumentTypeFormModal] ✅ FormData mis à jour, openTransaction:', typeToLoad.openTransaction ?? false);

      // Charger les champs JSON
      defaultContexts.setRaw(JSON.stringify(typeToLoad.defaultContexts || [], null, 2));
      suggestionsConfig.setRaw(JSON.stringify(typeToLoad.suggestionsConfig || {}, null, 2));
      flowLocks.setRaw(JSON.stringify(typeToLoad.flowLocks || [], null, 2));
      metaSchema.setRaw(JSON.stringify(typeToLoad.metaSchema || {}, null, 2));
    } else {
      // Réinitialiser pour un nouveau type
      setFormData({
        code: '',
        label: '',
        description: '',
        order: 0,
        isActive: true,
        isSensitive: false,
        autoAssignThreshold: 0.85,
        openTransaction: false,
      });

      defaultContexts.setRaw('[]');
      suggestionsConfig.setRaw('{}');
      flowLocks.setRaw('[]');
      metaSchema.setRaw('{}');
    }
  }, [fullDocumentType, documentType]);

  const hasJsonErrors = defaultContexts.error || suggestionsConfig.error || flowLocks.error || metaSchema.error;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (hasJsonErrors) {
      toast.error('Veuillez corriger les erreurs JSON avant de sauvegarder');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const data = {
        ...formData,
        defaultContexts: defaultContexts.parsed,
        suggestionsConfig: suggestionsConfig.parsed,
        flowLocks: flowLocks.parsed,
        metaSchema: metaSchema.parsed,
      };

      console.log('[DocumentTypeFormModal] 💾 Données à sauvegarder:', data);
      console.log('[DocumentTypeFormModal] 🤖 openTransaction:', data.openTransaction);

      await onSave(data);
      
      // Recharger les données complètes après sauvegarde
      if (documentType?.id) {
        console.log('[DocumentTypeFormModal] 🔄 Rechargement après sauvegarde...');
        const response = await fetch(`/api/admin/document-types/${documentType.id}`);
        const result = await response.json();
        if (result.success) {
          setFullDocumentType(result.data);
          console.log('[DocumentTypeFormModal] ✅ Données rechargées, openTransaction:', result.data.openTransaction);
        }
      }
      
      toast.success('Type de document sauvegardé avec succès');
    } catch (error) {
      console.error('Error saving document type:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setFullDocumentType(null); // Réinitialiser les données complètes
    onClose();
  };

  // Validation des erreurs JSON
  const hasJsonError = defaultContexts.error || suggestionsConfig.error || flowLocks.error || metaSchema.error;

  // Validation générale du formulaire
  const isFormValid = formData.code && formData.label && isThresholdValid && !hasJsonError;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {documentType ? 'Modifier le type de document' : 'Nouveau type de document'}
          </DialogTitle>
          <DialogDescription>
            Configurez les paramètres de classification et d'extraction pour ce type de document.
          </DialogDescription>
        </DialogHeader>

        <FormShellStandard id={formId} onSubmit={handleSubmit} className="space-y-6">
          {/* Informations de base */}
          <Card>
            <CardHeader>
              <CardTitle>Informations de base</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="ex: BAIL_SIGNE"
                    disabled={!!documentType}
                    required
                  />
                  {documentType && (
                    <p className="text-sm text-gray-500 mt-1">Code non modifiable</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="order">Ordre d'affichage</Label>
                  <Input
                    id="order"
                    type="number"
                    inputMode="numeric"
                    value={formData.order}
                    onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="label">Libellé *</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="ex: Bail Signé"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Description du type de document"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="autoAssignThreshold">Seuil d'auto-assignation</Label>
                  <Input
                    id="autoAssignThreshold"
                    inputMode="decimal"
                    value={formData.autoAssignThreshold?.toString() || ''}
                    onChange={(e) => {
                      const v = e.target.value.replace(',', '.');
                      setFormData(prev => ({ ...prev, autoAssignThreshold: v === '' ? null : parseFloat(v) }));
                      setIsThresholdValid(v === '' ? true : !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 1);
                    }}
                    placeholder="0,85"
                  />
                  {!isThresholdValid ? (
                    <p className="text-sm text-red-600 mt-1">Le seuil doit être entre 0 et 1</p>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">Valeur entre 0 et 1</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label htmlFor="isActive">Type actif</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isSensitive"
                    checked={formData.isSensitive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isSensitive: checked }))}
                  />
                  <Label htmlFor="isSensitive">Type sensible</Label>
                </div>
              </div>

              {/* 🤖 NOUVEAU : Toggle openTransaction */}
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Switch
                    id="openTransaction"
                    checked={formData.openTransaction}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, openTransaction: checked }))}
                  />
                  <div className="flex-1">
                    <Label htmlFor="openTransaction" className="font-medium">
                      🤖 Ouvrir la modale transaction automatiquement
                    </Label>
                    <p className="text-xs text-gray-600 mt-1">
                      Active l'extraction OCR et l'ouverture automatique de la modale de transaction après upload
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 🤖 Configuration OCR → Transaction (visible si openTransaction activé) */}
          {formData.openTransaction && (
            <Card className="border-2 border-primary">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-primary" />
                  <CardTitle>Configuration OCR → Transaction</CardTitle>
                </div>
                <CardDescription>
                  Configurez les regex d'extraction et les mappings pour pré-remplir automatiquement la modale de transaction
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded">
                    <div className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium">Configuration rapide</span>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        type="button"
                        variant="secondary" 
                        size="sm"
                        onClick={() => {
                          suggestionsConfig.setRaw(JSON.stringify({
                            regex: {
                              periode: "(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) ?(20\\d{2})",
                              montant: "([0-9]+[\\.,][0-9]{2}) ?€?",
                              bien: "(Appartement|Maison|Studio) ?([A-Z0-9]+)?"
                            },
                            libelleTemplate: "Loyer {periode} - {bien}"
                          }, null, 2));
                          toast.success('Template "Relevé" appliqué');
                        }}
                      >
                        📄 Relevé
                      </Button>
                      <Button 
                        type="button"
                        variant="secondary" 
                        size="sm"
                        onClick={() => {
                          suggestionsConfig.setRaw(JSON.stringify({
                            regex: {
                              date: "([0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4})",
                              montant: "Total[\\s:]*([0-9]+[\\.,][0-9]{2})",
                              reference: "Facture[\\s:]*([A-Z0-9\\-]+)"
                            },
                            libelleTemplate: "Facture {reference}"
                          }, null, 2));
                          toast.success('Template "Facture" appliqué');
                        }}
                      >
                        🧾 Facture
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    💡 Utilisez les boutons ci-dessus pour démarrer avec un template, puis ajustez les champs JSON ci-dessous.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configuration avancée */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Configuration avancée</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showAdvanced ? 'Masquer' : 'Afficher'}
                </Button>
              </div>
            </CardHeader>
            {showAdvanced && (
              <CardContent className="space-y-4">
                {/* Default Contexts */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="defaultContexts">Contextes par défaut (JSON)</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => defaultContexts.format()}>
                        <Wand2 className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => defaultContexts.setExample(JSON_EXAMPLES.defaultContexts)}>
                        <FileText className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="defaultContexts"
                    value={defaultContexts.raw}
                    onChange={(e) => defaultContexts.setRaw(e.target.value)}
                    placeholder='["property", "lease", "tenant"]'
                    rows={3}
                  />
                  {defaultContexts.error && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="destructive" className="mt-1">JSON invalide</Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{defaultContexts.error}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Suggestions Config */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="suggestionsConfig">Configuration des suggestions (JSON)</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => suggestionsConfig.format()}>
                        <Wand2 className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => suggestionsConfig.setExample(JSON_EXAMPLES.suggestionsConfig)}>
                        <FileText className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="suggestionsConfig"
                    value={suggestionsConfig.raw}
                    onChange={(e) => suggestionsConfig.setRaw(e.target.value)}
                    placeholder='{"minConfidenceToSuggest": 0.6, "showTopK": 3}'
                    rows={3}
                  />
                  {suggestionsConfig.error && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="destructive" className="mt-1">JSON invalide</Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{suggestionsConfig.error}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Flow Locks */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="flowLocks">Verrouillages dans les flux (JSON)</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => flowLocks.format()}>
                        <Wand2 className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => flowLocks.setExample(JSON_EXAMPLES.flowLocks)}>
                        <FileText className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="flowLocks"
                    value={flowLocks.raw}
                    onChange={(e) => flowLocks.setRaw(e.target.value)}
                    placeholder='["noAutoAssign", "requireManualReview"]'
                    rows={2}
                  />
                  {flowLocks.error && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="destructive" className="mt-1">JSON invalide</Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{flowLocks.error}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Meta Schema */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="metaSchema">Schéma de métadonnées (JSON)</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => metaSchema.format()}>
                        <Wand2 className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => metaSchema.setExample(JSON_EXAMPLES.metaSchema)}>
                        <FileText className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    id="metaSchema"
                    value={metaSchema.raw}
                    onChange={(e) => metaSchema.setRaw(e.target.value)}
                    placeholder='{"fields": {"period_month": {"type": "string", "required": true}}}'
                    rows={4}
                  />
                  {metaSchema.error && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="destructive" className="mt-1">JSON invalide</Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{metaSchema.error}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Configuration détaillée */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Configuration détaillée</CardTitle>
                  <CardDescription>
                    {documentType 
                      ? "Gérez les mots-clés, signaux et règles d'extraction" 
                      : "Configurez les mots-clés, signaux et règles d'extraction (disponible après création)"
                    }
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDetailed(!showDetailed)}
                >
                  {showDetailed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showDetailed ? 'Masquer' : 'Afficher'}
                </Button>
              </div>
            </CardHeader>
            {showDetailed && (
              <CardContent>
                {documentType ? (
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="keywords">Mots-clés</TabsTrigger>
                      <TabsTrigger value="signals">Signaux</TabsTrigger>
                      <TabsTrigger value="rules">Règles</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="keywords">
                      <KeywordsManagement documentTypeId={documentType.id} />
                    </TabsContent>
                    
                    <TabsContent value="signals">
                      <TypeSignalsManagement 
                        documentTypeId={documentType.id} 
                        allowAddSignals={false} 
                      />
                    </TabsContent>
                    
                    <TabsContent value="rules">
                      <RulesManagement documentTypeId={documentType.id} />
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="mb-4">
                      <FileText className="w-12 h-12 mx-auto text-gray-300" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Configuration disponible après création</h3>
                    <p className="text-sm">
                      Une fois le type de document créé, vous pourrez configurer :
                    </p>
                    <ul className="text-sm text-left max-w-md mx-auto mt-3 space-y-1">
                      <li>• <strong>Mots-clés</strong> : termes spécifiques à ce type</li>
                      <li>• <strong>Signaux</strong> : patterns regex depuis le catalogue global</li>
                      <li>• <strong>Règles</strong> : logique d'extraction avancée</li>
                    </ul>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Footer Sticky */}
          <div className="sticky bottom-0 bg-white border-t mt-6 pt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
              <X className="w-4 h-4 mr-2" />
              Annuler
            </Button>
            <SaveActionStandard
              type="submit"
              form={formId}
              isLoading={isSubmitting}
              disabled={isSubmitting || !isFormValid}
              labelEdit="Sauvegarder"
              loadingLabel="Sauvegarde..."
            />
          </div>
        </FormShellStandard>
      </DialogContent>
    </Dialog>
  );
}
