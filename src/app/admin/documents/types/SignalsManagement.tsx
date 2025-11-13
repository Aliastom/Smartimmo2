'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/ui/shared/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/shared/select';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { Plus, Edit, Trash2, Save, X, TestTube, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { DocumentSignal } from '@/types/document-types';

interface SignalsManagementProps {
  documentTypeId: string;
}

// Signaux prédéfinis disponibles
const PREDEFINED_SIGNALS = [
  { code: 'HAS_IBAN', label: 'Présence IBAN', description: 'Détecte la présence d\'un IBAN français' },
  { code: 'HAS_SIREN', label: 'Présence SIREN', description: 'Détecte la présence d\'un numéro SIREN' },
  { code: 'HAS_SIRET', label: 'Présence SIRET', description: 'Détecte la présence d\'un numéro SIRET' },
  { code: 'META_PDF_TITLE', label: 'Titre PDF', description: 'Analyse le titre du document PDF' },
  { code: 'HEADER_IMPOTS', label: 'En-tête Impôts', description: 'Détecte les en-têtes des documents fiscaux' },
  { code: 'HEADER_ASSUREUR', label: 'En-tête Assureur', description: 'Détecte les en-têtes des documents d\'assurance' },
  { code: 'MONTH_YEAR_PATTERN', label: 'Pattern Mois/Année', description: 'Détecte les patterns de dates françaises' },
  { code: 'MONEY_PATTERN', label: 'Pattern Monétaire', description: 'Détecte les montants en euros' },
  { code: 'ADDRESS_PATTERN', label: 'Pattern Adresse', description: 'Détecte les adresses françaises' },
  { code: 'DATE_PATTERN', label: 'Pattern de date', description: 'Détecte les dates simples (JJ/MM/AAAA)' },
  { code: 'EMAIL_PATTERN', label: 'Pattern Email', description: 'Détecte les adresses email' },
  { code: 'PHONE_PATTERN', label: 'Pattern Téléphone', description: 'Détecte les numéros de téléphone français' },
  { code: 'HAS_DATE_RANGE', label: 'Période du bail', description: 'Détecte une période de dates (du...au...ou entre...et...)' },
  { code: 'YEAR_PATTERN', label: 'Année (20xx)', description: 'Détecte les années 2000-2099' },
  { code: 'LOYER_AMOUNT_NEAR', label: 'Montant proche de \'loyer\'', description: 'Détecte un montant à proximité du mot "loyer"' },
];

export default function SignalsManagement({ documentTypeId }: SignalsManagementProps) {
  const [signals, setSignals] = useState<DocumentSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSignal, setEditingSignal] = useState<DocumentSignal | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    label: '',
    weight: 1,
    type: 'catalog' as 'catalog' | 'custom',
    predefinedSignal: '',
    pattern: '',
    flags: 'iu',
  });
  const [testText, setTestText] = useState('');
  const [testResults, setTestResults] = useState<{ matches: number; excerpts: string[] } | null>(null);

  // Charger les signaux
  const fetchSignals = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/document-types/${documentTypeId}/signals`);
      const data = await response.json();
      
      if (data.success) {
        setSignals(data.data);
      } else {
        toast.error('Erreur lors du chargement des signaux');
      }
    } catch (error) {
      console.error('Error fetching signals:', error);
      toast.error('Erreur lors du chargement des signaux');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentTypeId) {
      fetchSignals();
    }
  }, [documentTypeId]);

  const handleCreate = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setEditingSignal(null);
    setFormData({ 
      code: '', 
      label: '', 
      weight: 1,
      type: 'catalog',
      predefinedSignal: '',
      pattern: '',
      flags: 'iu',
    });
    setTestText('');
    setTestResults(null);
    setShowForm(true);
  };

  const handleEdit = (signal: DocumentSignal, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setEditingSignal(signal);
    setFormData({
      code: signal.code,
      label: signal.label,
      weight: signal.weight,
      type: signal.type || 'catalog',
      predefinedSignal: signal.type === 'catalog' ? signal.code : '',
      pattern: signal.pattern || '',
      flags: signal.flags || 'iu',
    });
    setTestText('');
    setTestResults(null);
    setShowForm(true);
  };

  const handleDelete = async (signalId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce signal ?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/document-types/${documentTypeId}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signals: signals.filter(s => s.id !== signalId).map(s => ({
            id: s.id,
            code: s.code,
            label: s.label,
            weight: s.weight,
          })),
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Signal supprimé avec succès');
        fetchSignals();
      } else {
        toast.error(data.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting signal:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!formData.code.trim() || !formData.label.trim()) {
      toast.error('Le code et le label sont requis');
      return;
    }

    // Validation pour les signaux personnalisés
    if (formData.type === 'custom') {
      if (!formData.pattern.trim()) {
        toast.error('Le pattern regex est requis pour un signal personnalisé');
        return;
      }

      try {
        // Tester la validité du regex
        new RegExp(formData.pattern, formData.flags);
      } catch (error) {
        toast.error(`Pattern regex invalide: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        return;
      }
    }

    try {
      const updatedSignals = editingSignal
        ? signals.map(s => s.id === editingSignal.id ? { ...s, ...formData } : s)
        : [...signals, { id: `temp-${Date.now()}`, documentTypeId, ...formData }];

      const response = await fetch(`/api/admin/document-types/${documentTypeId}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signals: updatedSignals.map(s => ({
            id: s.id.startsWith('temp-') ? undefined : s.id,
            code: s.code,
            label: s.label,
            weight: s.weight,
            description: s.description,
            type: s.type,
            pattern: s.type === 'custom' ? s.pattern : undefined,
            flags: s.type === 'custom' ? s.flags : undefined,
          })),
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(editingSignal ? 'Signal modifié avec succès' : 'Signal créé avec succès');
        setShowForm(false);
        fetchSignals();
      } else {
        toast.error(data.error || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Error saving signal:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingSignal(null);
    setFormData({ 
      code: '', 
      label: '', 
      weight: 1,
      type: 'catalog',
      predefinedSignal: '',
      pattern: '',
      flags: 'iu',
    });
    setTestText('');
    setTestResults(null);
  };

  const handlePredefinedSignalChange = (code: string) => {
    const predefinedSignal = PREDEFINED_SIGNALS.find(s => s.code === code);
    if (predefinedSignal) {
      setFormData(prev => ({
        ...prev,
        code: predefinedSignal.code,
        label: predefinedSignal.label,
        predefinedSignal: code,
      }));
    }
  };

  const handleTypeChange = (value: 'catalog' | 'custom') => {
    setFormData(prev => ({
      ...prev,
      type: value,
      predefinedSignal: value === 'catalog' ? prev.predefinedSignal : '',
      code: value === 'catalog' ? prev.predefinedSignal : prev.code,
      label: value === 'catalog' ? prev.label : prev.label,
    }));
    setTestResults(null);
  };

  const handleTestRegex = () => {
    if (!formData.pattern || !testText.trim()) {
      toast.error('Veuillez saisir un pattern regex et du texte de test');
      return;
    }

    try {
      // Validation du pattern regex
      const regex = new RegExp(formData.pattern, formData.flags);
      
      // Normalisation du texte de test (même logique que dans ClassificationService)
      const normalizedText = testText
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ');

      const matches = Array.from(normalizedText.matchAll(regex));
      const excerpts = matches.slice(0, 2).map(match => {
        const start = Math.max(0, match.index - 20);
        const end = Math.min(normalizedText.length, match.index + match[0].length + 20);
        return `...${normalizedText.slice(start, end)}...`;
      });

      setTestResults({
        matches: matches.length,
        excerpts,
      });

      if (matches.length > 0) {
        toast.success(`${matches.length} correspondance(s) trouvée(s)`);
      } else {
        toast.info('Aucune correspondance trouvée');
      }
    } catch (error) {
      toast.error(`Erreur regex: ${error instanceof Error ? error.message : 'Pattern invalide'}`);
      setTestResults(null);
    }
  };

  const getPredefinedSignalPattern = (code: string): string => {
    switch (code) {
      case 'HAS_IBAN':
        return '\\bFR\\d{2}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{2}\\b';
      case 'HAS_SIREN':
        return '\\b\\d{9}\\b';
      case 'HAS_SIRET':
        return '\\b\\d{14}\\b';
      case 'META_PDF_TITLE':
        return '(titre|document|rapport)';
      case 'HEADER_IMPOTS':
        return '(impôt|fiscal|dgfip|urssaf)';
      case 'HEADER_ASSUREUR':
        return '(assurance|assureur|mutuelle)';
      case 'MONTH_YEAR_PATTERN':
        return '\\b(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\\s+\\d{4}\\b';
      case 'MONEY_PATTERN':
        return '\\d+[,\\.]\\d{2}\\s?€?';
      case 'ADDRESS_PATTERN':
        return '\\d+\\s+(rue|avenue|boulevard|place|allée|chemin|impasse)';
      case 'DATE_PATTERN':
        return '\\b\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}\\b';
      case 'EMAIL_PATTERN':
        return '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b';
      case 'PHONE_PATTERN':
        return '\\b(\\+33|0)[1-9](?:[.\\- ]?\\d{2}){4}\\b';
      case 'HAS_DATE_RANGE':
        return '(?:du|entre le)\\s+\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4}\\s+(?:au|et le)\\s+\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4}';
      case 'YEAR_PATTERN':
        return '\\b(20\\d{2})\\b';
      case 'LOYER_AMOUNT_NEAR':
        return '(?:loyer[\\s\\S]{0,80}(\\d[\\d \\u00A0.,]{2,})\\s?€)|((\\d[\\d \\u00A0.,]{2,})\\s?€[\\s\\S]{0,80}loyer)';
      default:
        return '';
    }
  };

  const handleTestPredefinedSignal = (code: string) => {
    if (!testText.trim()) {
      toast.error('Veuillez saisir du texte de test');
      return;
    }

    try {
      const pattern = getPredefinedSignalPattern(code);
      const regex = new RegExp(pattern, 'iu');
      
      // Normalisation du texte de test
      const normalizedText = testText
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ');

      const matches = Array.from(normalizedText.matchAll(regex));
      const excerpts = matches.slice(0, 2).map(match => {
        const start = Math.max(0, match.index - 20);
        const end = Math.min(normalizedText.length, match.index + match[0].length + 20);
        return `...${normalizedText.slice(start, end)}...`;
      });

      setTestResults({
        matches: matches.length,
        excerpts,
      });

      if (matches.length > 0) {
        toast.success(`${matches.length} correspondance(s) trouvée(s)`);
      } else {
        toast.info('Aucune correspondance trouvée');
      }
    } catch (error) {
      toast.error(`Erreur regex: ${error instanceof Error ? error.message : 'Pattern invalide'}`);
      setTestResults(null);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Chargement des signaux...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Signaux</h3>
          <p className="text-sm text-gray-600">Configurez les signaux pour la classification</p>
        </div>
        <Button onClick={(e) => handleCreate(e)}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un signal
        </Button>
      </div>

      {signals.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Aucun signal configuré</p>
          <p className="text-sm">Commencez par ajouter votre premier signal</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Label</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Poids</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {signals.map((signal) => (
              <TableRow key={signal.id}>
                <TableCell>
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                    {signal.code}
                  </code>
                </TableCell>
                <TableCell className="font-medium">{signal.label}</TableCell>
                <TableCell>
                  <Badge variant={signal.type === 'custom' ? 'default' : 'secondary'}>
                    {signal.type === 'custom' ? 'Custom' : 'Catalog'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{signal.weight}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleEdit(signal, e)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDelete(signal.id, e)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Modal de création/édition */}
      <Dialog open={showForm} onOpenChange={handleClose}>
        <DialogContent onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {editingSignal ? 'Modifier le signal' : 'Nouveau signal'}
            </DialogTitle>
            <DialogDescription>
              {editingSignal ? 'Modifiez les paramètres du signal.' : 'Ajoutez un nouveau signal pour améliorer la classification.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="type">Type de signal *</Label>
              <Select value={formData.type} onValueChange={handleTypeChange} disabled={!!editingSignal}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir le type de signal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="catalog">Prédéfini</SelectItem>
                  <SelectItem value="custom">Personnalisé (regex)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type === 'catalog' && (
              <>
                <div>
                  <Label htmlFor="predefinedSignal">Signal prédéfini *</Label>
                  <Select 
                    value={formData.predefinedSignal} 
                    onValueChange={handlePredefinedSignalChange} 
                    disabled={!!editingSignal}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un signal prédéfini" />
                    </SelectTrigger>
                    <SelectContent>
                      {PREDEFINED_SIGNALS.map((signal) => (
                        <SelectItem key={signal.code} value={signal.code}>
                          {signal.label} - {signal.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.predefinedSignal && (
                  <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                    <h4 className="font-medium text-sm">Informations du signal sélectionné</h4>
                    
                    {(() => {
                      const selectedSignal = PREDEFINED_SIGNALS.find(s => s.code === formData.predefinedSignal);
                      if (!selectedSignal) return null;

                      return (
                        <>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Code:</span>
                              <code className="ml-2 bg-white px-2 py-1 rounded text-xs">
                                {selectedSignal.code}
                              </code>
                            </div>
                            <div>
                              <span className="font-medium">Label:</span>
                              <span className="ml-2">{selectedSignal.label}</span>
                            </div>
                          </div>

                          <div>
                            <span className="font-medium text-sm">Regex Pattern:</span>
                            <details className="mt-1">
                              <summary className="cursor-pointer text-blue-600 hover:text-blue-800 text-xs">
                                Voir le pattern regex
                              </summary>
                              <code className="block bg-white p-2 rounded text-xs break-all mt-2">
                                {getPredefinedSignalPattern(selectedSignal.code)}
                              </code>
                            </details>
                          </div>

                          <div className="flex items-center gap-4">
                            <div>
                              <span className="font-medium text-sm">Flags:</span>
                              <Badge variant="outline" className="ml-2">iu</Badge>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestPredefinedSignal(selectedSignal.code)}
                            >
                              <TestTube className="w-4 h-4 mr-2" />
                              Tester
                            </Button>
                          </div>

                          {selectedSignal.description && (
                            <div>
                              <span className="font-medium text-sm">Description:</span>
                              <p className="text-xs text-gray-600 mt-1">{selectedSignal.description}</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </>
            )}

            {formData.type === 'custom' && (
              <>
                <div>
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="ex: YEAR_PATTERN"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="label">Label *</Label>
                  <Input
                    id="label"
                    value={formData.label}
                    onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="ex: Détecte une année"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="pattern">Pattern (regex, sans / /) *</Label>
                  <Input
                    id="pattern"
                    value={formData.pattern}
                    onChange={(e) => setFormData(prev => ({ ...prev, pattern: e.target.value }))}
                    placeholder="ex: \\b(20\\d{2})\\b"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">Expression régulière pour détecter le signal</p>
                </div>

                <div>
                  <Label htmlFor="flags">Flags regex</Label>
                  <Input
                    id="flags"
                    value={formData.flags}
                    onChange={(e) => setFormData(prev => ({ ...prev, flags: e.target.value }))}
                    placeholder="iu"
                  />
                  <p className="text-sm text-gray-500 mt-1">Flags regex (i=insensible à la casse, u=unicode, m=multiligne, g=global)</p>
                </div>

              </>
            )}

            <div>
              <Label htmlFor="weight">Poids</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={formData.weight}
                onChange={(e) => setFormData(prev => ({ ...prev, weight: parseFloat(e.target.value) || 1 }))}
                placeholder="1.0"
              />
              <p className="text-sm text-gray-500 mt-1">Poids pour le calcul de score (0-10)</p>
            </div>

            {/* Zone de test commune */}
            <div>
              <Label htmlFor="testText">Texte de test</Label>
              <div className="space-y-2">
                <textarea
                  id="testText"
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Collez du texte pour tester le signal..."
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                />
                <div className="flex justify-end">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={formData.type === 'catalog' ? 
                      () => handleTestPredefinedSignal(formData.predefinedSignal) : 
                      handleTestRegex
                    }
                    disabled={
                      !testText.trim() || 
                      (formData.type === 'catalog' && !formData.predefinedSignal) ||
                      (formData.type === 'custom' && !formData.pattern)
                    }
                  >
                    <TestTube className="w-4 h-4 mr-2" />
                    Tester
                  </Button>
                </div>
              </div>
              {testResults && (
                <div className="mt-2 p-3 bg-gray-50 rounded border">
                  <p className="text-sm font-medium">
                    {testResults.matches} correspondance(s) trouvée(s)
                  </p>
                  {testResults.excerpts.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium">Extraits :</p>
                      {testResults.excerpts.map((excerpt, index) => (
                        <p key={index} className="text-xs font-mono bg-white p-1 rounded border mt-1">
                          {excerpt}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="ghost" onClick={handleClose}>
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
              <Button type="submit">
                <Save className="w-4 h-4 mr-2" />
                Sauvegarder
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
