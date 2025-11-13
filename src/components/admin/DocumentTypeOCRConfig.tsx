'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Settings, Wand2, Lock, FileText, Plus, Trash2, Check, X } from 'lucide-react';
import { notify2 } from '@/lib/notify2';

interface DocumentTypeOCRConfigProps {
  documentType: any;
  onUpdate?: () => void;
}

export function DocumentTypeOCRConfig({ documentType, onUpdate }: DocumentTypeOCRConfigProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // États pour suggestionsConfig
  const [regexFields, setRegexFields] = useState<Array<{ name: string; pattern: string }>>(() => {
    if (documentType.suggestionsConfig) {
      try {
        const config = JSON.parse(documentType.suggestionsConfig);
        return Object.entries(config.regex || {}).map(([name, pattern]) => ({
          name,
          pattern: pattern as string
        }));
      } catch {
        return [];
      }
    }
    return [];
  });

  const [libelleTemplate, setLibelleTemplate] = useState(() => {
    if (documentType.suggestionsConfig) {
      try {
        const config = JSON.parse(documentType.suggestionsConfig);
        return config.libelleTemplate || '';
      } catch {
        return '';
      }
    }
    return '';
  });

  // États pour defaultContexts
  const [natureMapping, setNatureMapping] = useState<Array<{ nature: string; categorie: string }>>(() => {
    if (documentType.defaultContexts) {
      try {
        const config = JSON.parse(documentType.defaultContexts);
        return Object.entries(config.natureCategorieMap || {}).map(([nature, categorie]) => ({
          nature,
          categorie: categorie as string
        }));
      } catch {
        return [];
      }
    }
    return [];
  });

  const [confidenceThreshold, setConfidenceThreshold] = useState(() => {
    if (documentType.metaSchema) {
      try {
        const config = JSON.parse(documentType.metaSchema);
        return config.confidenceThreshold || 0.5;
      } catch {
        return 0.5;
      }
    }
    return 0.5;
  });

  const hasConfig = documentType.suggestionsConfig !== null;

  const addRegexField = () => {
    setRegexFields([...regexFields, { name: '', pattern: '' }]);
  };

  const removeRegexField = (index: number) => {
    setRegexFields(regexFields.filter((_, i) => i !== index));
  };

  const updateRegexField = (index: number, field: 'name' | 'pattern', value: string) => {
    const updated = [...regexFields];
    if (!updated[index]) return;
    updated[index][field] = value;
    setRegexFields(updated);
  };

  const addNatureMapping = () => {
    setNatureMapping([...natureMapping, { nature: '', categorie: '' }]);
  };

  const removeNatureMapping = (index: number) => {
    setNatureMapping(natureMapping.filter((_, i) => i !== index));
  };

  const updateNatureMapping = (index: number, field: 'nature' | 'categorie', value: string) => {
    const updated = [...natureMapping];
    if (!updated[index]) return;
    updated[index][field] = value;
    setNatureMapping(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Construire suggestionsConfig
      const suggestionsConfig = {
        regex: regexFields.reduce((acc, field) => {
          if (field.name && field.pattern) {
            acc[field.name] = field.pattern;
          }
          return acc;
        }, {} as Record<string, string>),
        libelleTemplate: libelleTemplate || undefined
      };

      // Construire defaultContexts
      const defaultContexts = {
        natureCategorieMap: natureMapping.reduce((acc, mapping) => {
          if (mapping.nature && mapping.categorie) {
            acc[mapping.nature] = mapping.categorie;
          }
          return acc;
        }, {} as Record<string, string>)
      };

      // Construire metaSchema
      const metaSchema = {
        fields: regexFields.map(f => f.name).filter(Boolean),
        confidenceThreshold: confidenceThreshold,
        version: 'v1.0'
      };

      // Envoyer à l'API
      const response = await fetch(`/api/admin/document-types/${documentType.id}/ocr-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionsConfig: JSON.stringify(suggestionsConfig),
          defaultContexts: JSON.stringify(defaultContexts),
          metaSchema: JSON.stringify(metaSchema)
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde');
      }

      notify2.success('Configuration OCR sauvegardée avec succès');
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Erreur:', error);
      notify2.error('Erreur lors de la sauvegarde de la configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUseTemplate = (template: 'releve' | 'facture' | 'quittance') => {
    if (template === 'releve') {
      setRegexFields([
        { name: 'periode', pattern: '(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) ?(20\\d{2})' },
        { name: 'montant', pattern: '([0-9]+[\\.,][0-9]{2}) ?€?' },
        { name: 'bien', pattern: '(Appartement|Maison|Studio) ?([A-Z0-9]+)?' }
      ]);
      setLibelleTemplate('Loyer {periode} - {bien}');
      setNatureMapping([{ nature: 'RECETTE_LOYER', categorie: 'Loyer + Charges' }]);
    } else if (template === 'facture') {
      setRegexFields([
        { name: 'date', pattern: '([0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4})' },
        { name: 'montant', pattern: 'Total[\\s:]*([0-9]+[\\.,][0-9]{2})' },
        { name: 'reference', pattern: 'Facture[\\s:]*([A-Z0-9\\-]+)' }
      ]);
      setLibelleTemplate('Facture {reference}');
      setNatureMapping([{ nature: 'DEPENSE_ENTRETIEN', categorie: 'Travaux et réparations' }]);
    } else if (template === 'quittance') {
      setRegexFields([
        { name: 'periode', pattern: 'Période[\\s:]*([0-9]{2}/[0-9]{4})' },
        { name: 'montant', pattern: 'Montant[\\s:]*([0-9]+[\\.,][0-9]{2})' }
      ]);
      setLibelleTemplate('Quittance {periode}');
      setNatureMapping([{ nature: 'RECETTE_LOYER', categorie: 'Loyer + Charges' }]);
    }
    setIsEditing(true);
  };

  if (!isEditing && !hasConfig) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Configuration OCR → Transaction
          </CardTitle>
          <CardDescription>
            Ce type de document n'est pas encore configuré pour l'extraction automatique
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Pour que ce type de document puisse suggérer automatiquement des transactions, 
              configurez les regex d'extraction et les mappings de catégories.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Démarrer depuis un template :</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleUseTemplate('releve')}>
                📄 Relevé de compte
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleUseTemplate('facture')}>
                🧾 Facture
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleUseTemplate('quittance')}>
                📋 Quittance
              </Button>
            </div>
          </div>

          <Button onClick={() => setIsEditing(true)} className="w-full">
            <Settings className="h-4 w-4 mr-2" />
            Configurer manuellement
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!isEditing && hasConfig) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Configuration OCR → Transaction
            <Badge variant="success">Configuré</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Champs extraits :</Label>
            <div className="flex flex-wrap gap-2">
              {regexFields.map((field, i) => (
                <Badge key={i} variant="secondary">{field.name}</Badge>
              ))}
            </div>
          </div>

          {libelleTemplate && (
            <div className="space-y-2">
              <Label>Template de libellé :</Label>
              <code className="block p-2 bg-muted rounded text-sm">{libelleTemplate}</code>
            </div>
          )}

          <div className="space-y-2">
            <Label>Seuil de confiance : {confidenceThreshold}</Label>
          </div>

          <Button onClick={() => setIsEditing(true)} variant="outline" className="w-full">
            <Settings className="h-4 w-4 mr-2" />
            Modifier la configuration
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          Configuration OCR → Transaction
        </CardTitle>
        <CardDescription>
          Configurez l'extraction automatique des champs pour créer des transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="regex" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="regex">
              <FileText className="h-4 w-4 mr-2" />
              Regex
            </TabsTrigger>
            <TabsTrigger value="mapping">
              <Settings className="h-4 w-4 mr-2" />
              Mapping
            </TabsTrigger>
            <TabsTrigger value="advanced">
              <Lock className="h-4 w-4 mr-2" />
              Avancé
            </TabsTrigger>
          </TabsList>

          <TabsContent value="regex" className="space-y-4">
            <div className="space-y-2">
              <Label>Expressions régulières d'extraction</Label>
              <p className="text-sm text-muted-foreground">
                Définissez les patterns pour extraire les champs du texte OCR
              </p>
            </div>

            {regexFields.map((field, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Nom (ex: montant)"
                  value={field.name}
                  onChange={(e) => updateRegexField(index, 'name', e.target.value)}
                  className="w-1/3"
                />
                <Input
                  placeholder="Pattern regex (ex: ([0-9]+[\\.,][0-9]{2}))"
                  value={field.pattern}
                  onChange={(e) => updateRegexField(index, 'pattern', e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRegexField(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addRegexField}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un champ
            </Button>

            <div className="space-y-2 mt-4">
              <Label>Template de libellé</Label>
              <Input
                placeholder="ex: Loyer {periode} - {bien}"
                value={libelleTemplate}
                onChange={(e) => setLibelleTemplate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Utilisez {'{nomChamp}'} pour insérer les valeurs extraites
              </p>
            </div>
          </TabsContent>

          <TabsContent value="mapping" className="space-y-4">
            <div className="space-y-2">
              <Label>Mapping Nature → Catégorie</Label>
              <p className="text-sm text-muted-foreground">
                Associez les natures détectées aux catégories comptables
              </p>
            </div>

            {natureMapping.map((mapping, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Nature (ex: RECETTE_LOYER)"
                  value={mapping.nature}
                  onChange={(e) => updateNatureMapping(index, 'nature', e.target.value)}
                  className="w-1/2"
                />
                <Input
                  placeholder="Catégorie (ex: Loyer + Charges)"
                  value={mapping.categorie}
                  onChange={(e) => updateNatureMapping(index, 'categorie', e.target.value)}
                  className="w-1/2"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeNatureMapping(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addNatureMapping}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un mapping
            </Button>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4">
            <div className="space-y-2">
              <Label>Seuil de confiance minimum</Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Score minimum (0-1) pour afficher une suggestion automatique
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 mt-6">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving ? (
              <>Enregistrement...</>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Enregistrer
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsEditing(false)}
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-2" />
            Annuler
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

