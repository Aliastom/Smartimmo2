'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/ui/shared/label';
import { Textarea } from '@/ui/shared/textarea';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Eye, Edit, TestTube, Search, Copy, Trash2, Plus, Save, X, AlertCircle, CheckCircle, Download, Lock, Upload, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { SignalsHelpModal } from '@/components/admin/SignalsHelpModal';

interface Signal {
  id: string;
  code: string;
  label: string;
  regex: string;
  flags: string;
  description?: string;
  protected: boolean;
  usages: number;
  documentTypes: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface TestResult {
  matches: number;
  excerpts: string[];
}

export default function SignalsCatalogClient() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showUsagesDrawer, setShowUsagesDrawer] = useState(false);
  const [selectedSignalForUsages, setSelectedSignalForUsages] = useState<Signal | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [originalData, setOriginalData] = useState<any>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    code: '',
    label: '',
    regex: '',
    flags: 'iu',
    description: ''
  });

  // Test data
  const [testText, setTestText] = useState('');
  const [testResults, setTestResults] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  
  // État pour la modal d'aide
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Charger les signaux
  const fetchSignals = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/signals?search=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      
      if (data.success) {
        setSignals(data.data);
      } else {
        toast.error('Erreur lors du chargement du catalogue');
      }
    } catch (error) {
      console.error('Error fetching signals:', error);
      toast.error('Erreur lors du chargement du catalogue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, [searchTerm]);

  // Détecter les changements du formulaire
  useEffect(() => {
    if (originalData && !isCreating) {
      const hasChanges = 
        formData.code !== originalData.code ||
        formData.label !== originalData.label ||
        formData.regex !== originalData.regex ||
        formData.flags !== originalData.flags ||
        formData.description !== originalData.description;
      setIsDirty(hasChanges);
    } else {
      setIsDirty(false);
    }
  }, [formData, originalData, isCreating]);

  // Ouvrir modal de création
  const handleCreate = () => {
    setIsCreating(true);
    setSelectedSignal(null);
    setFormData({
      code: '',
      label: '',
      regex: '',
      flags: 'iu',
      description: ''
    });
    setShowEditModal(true);
  };

  // Ouvrir modal d'édition
  const handleEdit = (signal: Signal) => {
    setIsCreating(false);
    setSelectedSignal(signal);
    const initialData = {
      code: signal.code,
      label: signal.label,
      regex: signal.regex,
      flags: signal.flags,
      description: signal.description || ''
    };
    setFormData(initialData);
    setOriginalData(initialData);
    setIsDirty(false);
    setShowEditModal(true);
  };

  // Sauvegarder le signal
  const handleSave = async () => {
    if (!formData.code || !formData.label || !formData.regex) {
      toast.error('Code, label et regex sont requis');
      return;
    }

    // Valider le regex
    try {
      new RegExp(formData.regex, formData.flags);
    } catch (error) {
      toast.error(`Pattern regex invalide: ${error instanceof Error ? error.message : 'Erreur'}`);
      return;
    }

    try {
      setSaving(true);
      const url = isCreating ? '/api/admin/signals' : `/api/admin/signals/${selectedSignal?.id}`;
      const method = isCreating ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        toast.success(isCreating ? 'Signal créé avec succès' : 'Signal mis à jour avec succès');
        if (data.warning) {
          toast.warning(data.warning);
        }
        setShowEditModal(false);
        fetchSignals();
      } else {
        toast.error(data.error || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Error saving signal:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Cloner un signal
  const handleClone = async (signal: Signal) => {
    try {
      const response = await fetch(`/api/admin/signals/${signal.id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Signal cloné avec succès');
        fetchSignals();
      } else {
        toast.error(data.error || 'Erreur lors du clonage');
      }
    } catch (error) {
      console.error('Error cloning signal:', error);
      toast.error('Erreur lors du clonage');
    }
  };

  // Supprimer un signal
  const handleDelete = async (signal: Signal) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le signal "${signal.code}" ?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/signals/${signal.id}`, {
        method: 'DELETE'
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

  // Tester le signal
  const handleTest = (signal: Signal) => {
    setSelectedSignal(signal);
    setTestText('');
    setTestResults(null);
    setShowTestModal(true);
  };

  // Exporter le catalogue
  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/signals/export');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `signals-catalog-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Catalogue exporté avec succès');
      } else {
        toast.error('Erreur lors de l\'export');
      }
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Erreur lors de l\'export');
    }
  };

  // Importer un catalogue JSON
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const text = await file.text();
      const json = JSON.parse(text);

      const response = await fetch('/api/admin/signals/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message || 'Import réussi');
        if (data.results.errors.length > 0) {
          console.warn('Erreurs d\'import:', data.results.errors);
          toast.warning(`${data.results.errors.length} erreur(s) - voir la console`);
        }
        fetchSignals();
        setShowImportModal(false);
      } else {
        toast.error(data.error || 'Erreur lors de l\'import');
      }
    } catch (error) {
      console.error('Error importing:', error);
      toast.error('Fichier JSON invalide');
    } finally {
      setImporting(false);
      // Reset le input
      event.target.value = '';
    }
  };

  // Ouvrir le drawer des utilisations
  const handleViewUsages = (signal: Signal) => {
    setSelectedSignalForUsages(signal);
    setShowUsagesDrawer(true);
  };

  // Tester le signal avec les valeurs EN COURS DE SAISIE du formulaire
  const testCurrentFormData = () => {
    if (!formData.regex || !testText.trim()) {
      toast.error('Veuillez saisir une regex et du texte de test');
      return;
    }

    try {
      setTesting(true);

      // Normaliser le texte (EXACTEMENT comme dans ClassificationService)
      const normalizedText = testText
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ');

      // Créer la regex avec les flags du formulaire + 'g' pour matchAll
      const flags = formData.flags.includes('g') ? formData.flags : formData.flags + 'g';
      const regex = new RegExp(formData.regex, flags);
      
      const matches = Array.from(normalizedText.matchAll(regex));
      const excerpts = matches.slice(0, 2).map(match => {
        const start = Math.max(0, (match.index || 0) - 20);
        const end = Math.min(normalizedText.length, (match.index || 0) + match[0].length + 20);
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
    } finally {
      setTesting(false);
    }
  };

  // Voir les détails
  const handleViewDetails = (signal: Signal) => {
    setSelectedSignal(signal);
    setShowDetailsModal(true);
  };

  // Tronquer le regex pour l'affichage
  const truncateRegex = (regex: string, maxLength: number = 50) => {
    return regex.length > maxLength ? regex.substring(0, maxLength) + '...' : regex;
  };

  if (loading) {
    return <div className="text-center py-8">Chargement du catalogue des signaux...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catalogue des Signaux</h1>
          <p className="text-gray-600 mt-1">
            Gestion du catalogue global des signaux pour la classification de documents
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importer JSON
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau signal
          </Button>
        </div>
      </div>

      {/* Encart d'information */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-yellow-800">
                Catalogue de signaux regex
              </h3>
              <button
                onClick={() => setShowHelpModal(true)}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                Documentation complète
              </button>
            </div>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                Les signaux sont des patterns regex réutilisables qui complètent les mots-clés pour améliorer la précision de la classification. 
                Créez des signaux pour détecter des structures (IBAN, signatures, montants) et associez-les aux types de documents avec un poids.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barre de recherche */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Recherche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Rechercher un signal</Label>
              <Input
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par code, label ou description..."
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {signals.length} signal(s) trouvé(s)
          </p>
        </CardContent>
      </Card>

      {/* Tableau des signaux */}
      <Card>
        <CardHeader>
          <CardTitle>Signaux ({signals.length})</CardTitle>
          <CardDescription>
            Signaux disponibles pour la classification
          </CardDescription>
        </CardHeader>
        <CardContent>
          {signals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Aucun signal trouvé</p>
              <p className="text-sm">Créez votre premier signal</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Code</TableHeaderCell>
                  <TableHeaderCell>Label</TableHeaderCell>
                  <TableHeaderCell>Regex</TableHeaderCell>
                  <TableHeaderCell>Flags</TableHeaderCell>
                  <TableHeaderCell>Utilisations</TableHeaderCell>
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
                      <code className="text-xs bg-gray-50 px-2 py-1 rounded">
                        {truncateRegex(signal.regex)}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{signal.flags}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewUsages(signal)}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:bg-opacity-80 transition-colors ${
                            signal.usages > 0 
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          title={signal.usages > 0 ? "Cliquer pour voir les types utilisant ce signal" : "Aucune utilisation"}
                        >
                          {signal.usages}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(signal)}
                          title="Éditer"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTest(signal)}
                          title="Tester"
                        >
                          <TestTube className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleClone(signal)}
                          title="Cloner"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {signal.protected ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            title="Signal protégé, impossible de supprimer"
                          >
                            <Lock className="h-4 w-4 text-yellow-500" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(signal)}
                            disabled={signal.usages > 0}
                            title={signal.usages > 0 ? "Signal utilisé, impossible de supprimer" : "Supprimer"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal d'édition/création */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? 'Nouveau signal' : `Éditer: ${selectedSignal?.code}`}
            </DialogTitle>
            <DialogDescription>
              {isCreating ? 'Créez un nouveau signal pour la classification' : 'Modifiez les propriétés du signal'}
            </DialogDescription>
          </DialogHeader>

          {/* Bandeau d'avertissement si signal utilisé */}
          {!isCreating && selectedSignal && selectedSignal.usages > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Signal utilisé</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Ce signal est utilisé par {selectedSignal.usages} type(s) de document. 
                    Les modifications impacteront tous ces types.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="ex: HAS_IBAN"
                  disabled={!isCreating}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Identifiant unique (non modifiable après création)
                </p>
              </div>

              <div>
                <Label htmlFor="label">Label *</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="ex: Présence IBAN"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="regex">Pattern Regex * (sans / /)</Label>
              <Textarea
                id="regex"
                value={formData.regex}
                onChange={(e) => setFormData(prev => ({ ...prev, regex: e.target.value }))}
                placeholder="ex: \\bFR\\d{2}\\s?\\d{4}..."
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Pattern regex sans les délimiteurs / /
              </p>
            </div>

            <div>
              <Label htmlFor="flags">Flags</Label>
              <Input
                id="flags"
                value={formData.flags}
                onChange={(e) => setFormData(prev => ({ ...prev, flags: e.target.value }))}
                placeholder="iu"
              />
              <p className="text-xs text-gray-500 mt-1">
                Flags regex (i=insensible à la casse, u=unicode, m=multiligne, g=global)
              </p>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description du signal..."
                rows={2}
              />
            </div>

            {/* Section Test */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <TestTube className="h-4 w-4" />
                🧪 Tester le pattern
              </h4>
              <div className="space-y-2">
                <Textarea
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Collez du texte pour tester le pattern..."
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={testCurrentFormData}
                    disabled={!formData.regex || !testText.trim() || testing}
                  >
                    <TestTube className="w-4 h-4 mr-2" />
                    {testing ? 'Test en cours...' : 'Tester'}
                  </Button>
                </div>
                {testResults && (
                  <div className="bg-gray-50 p-3 rounded border">
                    <p className="text-sm font-medium flex items-center gap-2">
                      {testResults.matches > 0 ? (
                        <><CheckCircle className="h-4 w-4 text-green-600" /> {testResults.matches} correspondance(s)</>
                      ) : (
                        <><AlertCircle className="h-4 w-4 text-red-600" /> Aucune correspondance</>
                      )}
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
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowEditModal(false)} disabled={saving}>
              <X className="w-4 h-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de test */}
      <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test du Signal: {selectedSignal?.code}</DialogTitle>
            <DialogDescription>
              Testez le pattern regex sur un texte de votre choix
            </DialogDescription>
          </DialogHeader>
          
          {selectedSignal && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Informations du signal</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Code:</strong> {selectedSignal.code}</div>
                  <div><strong>Label:</strong> {selectedSignal.label}</div>
                  <div><strong>Flags:</strong> {selectedSignal.flags}</div>
                  <div className="col-span-2">
                    <strong>Regex:</strong> 
                    <code className="text-xs ml-2 bg-white px-2 py-1 rounded">{selectedSignal.regex}</code>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="testText">Texte de test</Label>
                <Textarea
                  id="testText"
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Collez du texte pour tester le signal..."
                  rows={6}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={testCurrentFormData} disabled={!testText.trim() || testing}>
                  <TestTube className="w-4 h-4 mr-2" />
                  {testing ? 'Test en cours...' : 'Tester'}
                </Button>
              </div>

              {testResults && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Résultats du test</h4>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    {testResults.matches > 0 ? (
                      <><CheckCircle className="h-4 w-4 text-green-600" /> {testResults.matches} correspondance(s) trouvée(s)</>
                    ) : (
                      <><AlertCircle className="h-4 w-4 text-red-600" /> Aucune correspondance trouvée</>
                    )}
                  </p>
                  {testResults.excerpts.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">Extraits :</p>
                      {testResults.excerpts.map((excerpt, index) => (
                        <p key={index} className="text-xs font-mono bg-white p-2 rounded border mb-1">
                          {excerpt}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de détails */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Détails du Signal: {selectedSignal?.code}</DialogTitle>
            <DialogDescription>
              Informations complètes et utilisations du signal
            </DialogDescription>
          </DialogHeader>
          
          {selectedSignal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Code</Label>
                  <p className="font-mono bg-gray-100 p-2 rounded">{selectedSignal.code}</p>
                </div>
                <div>
                  <Label>Label</Label>
                  <p className="font-medium">{selectedSignal.label}</p>
                </div>
              </div>

              <div>
                <Label>Regex Pattern</Label>
                <p className="font-mono text-sm bg-gray-100 p-2 rounded break-all">
                  {selectedSignal.regex}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Flags</Label>
                  <Badge variant="outline">{selectedSignal.flags}</Badge>
                </div>
                <div>
                  <Label>Utilisations</Label>
                  <Badge variant={selectedSignal.usages > 0 ? "default" : "secondary"}>
                    {selectedSignal.usages} type(s)
                  </Badge>
                </div>
              </div>

              {selectedSignal.description && (
                <div>
                  <Label>Description</Label>
                  <p className="text-sm text-gray-600">{selectedSignal.description}</p>
                </div>
              )}

              {selectedSignal.usages > 0 && (
                <div>
                  <Label>Types de documents utilisant ce signal</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedSignal.documentTypes.map((type, index) => (
                      <Badge key={index} variant="default">{type}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Drawer des utilisations */}
      <Dialog open={showUsagesDrawer} onOpenChange={setShowUsagesDrawer}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Utilisations du Signal: {selectedSignalForUsages?.code}</DialogTitle>
            <DialogDescription>
              Types de documents utilisant ce signal
            </DialogDescription>
          </DialogHeader>
          
          {selectedSignalForUsages && (
            <div className="space-y-4">
              {selectedSignalForUsages.documentTypes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Ce signal n'est utilisé par aucun type de document.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-gray-600 mb-4">
                    {selectedSignalForUsages.documentTypes.length} type(s) utilisent ce signal :
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedSignalForUsages.documentTypes.map((typeName, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium">{typeName}</span>
                        <Badge variant="outline">Utilisé</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modale d'import JSON */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importer des Signaux depuis un JSON</DialogTitle>
            <DialogDescription>
              Importez un fichier JSON contenant plusieurs signaux. Les signaux existants seront mis à jour, les nouveaux seront créés.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Format attendu */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Format JSON attendu :</h4>
              <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
{`{
  "signals": [
    {
      "code": "HAS_IBAN",
      "label": "Contient un IBAN",
      "regex": "FR\\\\d{2}\\\\s?\\\\d{4}...",
      "flags": "iu",
      "description": "Détecte un IBAN français",
      "protected": false
    }
  ]
}`}
              </pre>
            </div>

            {/* Sélecteur de fichier */}
            <div>
              <Label htmlFor="import-file">Fichier JSON</Label>
              <input
                id="import-file"
                type="file"
                accept=".json,application/json"
                onChange={handleImport}
                disabled={importing}
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none mt-2 p-2"
              />
              {importing && (
                <p className="text-sm text-gray-600 mt-2">Import en cours...</p>
              )}
            </div>

            {/* Info */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-yellow-800">
                  <p className="font-medium">Règles d'import :</p>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                    <li>Les signaux avec le même <code>code</code> seront mis à jour</li>
                    <li>Les signaux protégés ne seront pas modifiés</li>
                    <li>Les nouveaux signaux seront créés</li>
                    <li>Chaque regex sera validée avant import</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowImportModal(false)}>
                Annuler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal d'aide/documentation */}
      <SignalsHelpModal 
        isOpen={showHelpModal} 
        onClose={() => setShowHelpModal(false)} 
      />
    </div>
  );
}

