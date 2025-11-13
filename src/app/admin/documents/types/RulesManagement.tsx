'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/ui/shared/label';
import { Textarea } from '@/ui/shared/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/shared/select';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Plus, Edit, Trash2, Save, X, Play, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { DocumentExtractionRule, POST_PROCESS_OPTIONS } from '@/types/document-types';

interface RulesManagementProps {
  documentTypeId: string;
}

export default function RulesManagement({ documentTypeId }: RulesManagementProps) {
  const [rules, setRules] = useState<DocumentExtractionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<DocumentExtractionRule | null>(null);
  const [formData, setFormData] = useState({
    fieldName: '',
    pattern: '',
    postProcess: '',
    priority: 100,
  });
  
  // Test regex live
  const [testText, setTestText] = useState('');
  const [testResults, setTestResults] = useState<{
    matches: string[];
    isValid: boolean;
    error?: string;
  }>({ matches: [], isValid: true });

  // Charger les règles
  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/document-types/${documentTypeId}/rules`);
      const data = await response.json();
      
      if (data.success) {
        setRules(data.data);
      } else {
        toast.error('Erreur lors du chargement des règles');
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
      toast.error('Erreur lors du chargement des règles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentTypeId) {
      fetchRules();
    }
  }, [documentTypeId]);

  // Tester le regex en temps réel
  const testRegex = () => {
    if (!formData.pattern.trim() || !testText.trim()) {
      setTestResults({ matches: [], isValid: true });
      return;
    }

    try {
      const regex = new RegExp(formData.pattern, 'gi');
      const matches = testText.match(regex);
      setTestResults({
        matches: matches || [],
        isValid: true,
      });
    } catch (error) {
      setTestResults({
        matches: [],
        isValid: false,
        error: error instanceof Error ? error.message : 'Erreur de regex',
      });
    }
  };

  // Tester automatiquement quand le pattern change
  useEffect(() => {
    const timeoutId = setTimeout(testRegex, 300);
    return () => clearTimeout(timeoutId);
  }, [formData.pattern, testText]);

  const handleCreate = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setEditingRule(null);
    setFormData({ fieldName: '', pattern: '', postProcess: '', priority: 100 });
    setTestText('');
    setTestResults({ matches: [], isValid: true });
    setShowForm(true);
  };

  const handleEdit = (rule: DocumentExtractionRule, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setEditingRule(rule);
    setFormData({
      fieldName: rule.fieldName,
      pattern: rule.pattern,
      postProcess: rule.postProcess || '',
      priority: rule.priority,
    });
    setTestText('');
    setTestResults({ matches: [], isValid: true });
    setShowForm(true);
  };

  const handleDelete = async (ruleId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette règle ?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/document-types/${documentTypeId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: rules.filter(r => r.id !== ruleId).map(r => ({
            id: r.id,
            fieldName: r.fieldName,
            pattern: r.pattern,
            postProcess: r.postProcess,
            priority: r.priority,
          })),
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Règle supprimée avec succès');
        fetchRules();
      } else {
        toast.error(data.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!formData.fieldName.trim() || !formData.pattern.trim()) {
      toast.error('Le nom du champ et le pattern sont requis');
      return;
    }

    if (!testResults.isValid) {
      toast.error('Le pattern regex n\'est pas valide');
      return;
    }

    try {
      const updatedRules = editingRule
        ? rules.map(r => r.id === editingRule.id ? { ...r, ...formData } : r)
        : [...rules, { id: `temp-${Date.now()}`, documentTypeId, ...formData }];

      const response = await fetch(`/api/admin/document-types/${documentTypeId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: updatedRules.map(r => ({
            id: r.id.startsWith('temp-') ? undefined : r.id,
            fieldName: r.fieldName,
            pattern: r.pattern,
            postProcess: r.postProcess || undefined,
            priority: r.priority,
          })),
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(editingRule ? 'Règle modifiée avec succès' : 'Règle créée avec succès');
        setShowForm(false);
        fetchRules();
      } else {
        toast.error(data.error || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingRule(null);
    setFormData({ fieldName: '', pattern: '', postProcess: '', priority: 100 });
    setTestText('');
    setTestResults({ matches: [], isValid: true });
  };

  if (loading) {
    return <div className="text-center py-4">Chargement des règles...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Règles d'extraction</h3>
          <p className="text-sm text-gray-600">Configurez les règles pour extraire les champs</p>
        </div>
        <Button onClick={(e) => handleCreate(e)}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter une règle
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Aucune règle configurée</p>
          <p className="text-sm">Commencez par ajouter votre première règle d'extraction</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Champ</TableHeaderCell>
              <TableHeaderCell>Pattern</TableHeaderCell>
              <TableHeaderCell>Post-process</TableHeaderCell>
              <TableHeaderCell>Priorité</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules
              .sort((a, b) => a.priority - b.priority)
              .map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.fieldName}</TableCell>
                  <TableCell>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {rule.pattern}
                    </code>
                  </TableCell>
                  <TableCell>
                    {rule.postProcess ? (
                      <Badge variant="outline">{rule.postProcess}</Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{rule.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleEdit(rule, e)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDelete(rule.id, e)}
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
        <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Modifier la règle' : 'Nouvelle règle'}
            </DialogTitle>
            <DialogDescription>
              {editingRule ? 'Modifiez les paramètres de la règle d\'extraction.' : 'Ajoutez une nouvelle règle d\'extraction de données.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fieldName">Nom du champ *</Label>
                <Input
                  id="fieldName"
                  value={formData.fieldName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fieldName: e.target.value }))}
                  placeholder="ex: period_month"
                  required
                />
              </div>

              <div>
                <Label htmlFor="priority">Priorité</Label>
                <Input
                  id="priority"
                  type="number"
                  min="1"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 100 }))}
                  placeholder="100"
                />
                <p className="text-sm text-gray-500 mt-1">Plus bas = plus prioritaire</p>
              </div>
            </div>

            <div>
              <Label htmlFor="pattern">Pattern Regex *</Label>
              <Textarea
                id="pattern"
                value={formData.pattern}
                onChange={(e) => setFormData(prev => ({ ...prev, pattern: e.target.value }))}
                placeholder="ex: (janv\.?|févr\.?|mars|avr\.?|mai|juin|juil\.?|août|sept\.?|oct\.?|nov\.?|déc\.?)"
                rows={2}
                required
              />
              {!testResults.isValid && (
                <div className="flex items-center gap-2 mt-2 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{testResults.error}</span>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="postProcess">Post-traitement</Label>
              <Select 
                value={formData.postProcess} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, postProcess: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un post-traitement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {POST_PROCESS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Test en temps réel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Test en temps réel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label htmlFor="testText">Texte d'échantillon</Label>
                  <Textarea
                    id="testText"
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="Collez ici un texte pour tester le pattern..."
                    rows={3}
                  />
                </div>

                {testText && formData.pattern && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Play className="w-4 h-4" />
                      <span className="text-sm font-medium">Résultats:</span>
                      <Badge variant={testResults.isValid ? 'default' : 'destructive'}>
                        {testResults.matches.length} match{testResults.matches.length > 1 ? 'es' : ''}
                      </Badge>
                    </div>
                    
                    {testResults.matches.length > 0 && (
                      <div className="space-y-1">
                        {testResults.matches.map((match, index) => (
                          <div key={index} className="bg-green-50 border border-green-200 rounded p-2">
                            <code className="text-sm">{match}</code>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="ghost" onClick={handleClose}>
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
              <Button type="submit" disabled={!testResults.isValid}>
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
