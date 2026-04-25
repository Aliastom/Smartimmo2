'use client';

import React, { useId, useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/ui/shared/label';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { DocumentKeyword } from '@/types/document-types';
import { FormShellStandard, SaveActionStandard } from '@/components/ui/standards';

interface KeywordsManagementProps {
  documentTypeId: string;
}

export default function KeywordsManagement({ documentTypeId }: KeywordsManagementProps) {
  const formId = useId();
  const [keywords, setKeywords] = useState<DocumentKeyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<DocumentKeyword | null>(null);
  const [formData, setFormData] = useState({
    keyword: '',
    weight: 1,
    context: '',
  });

  // Charger les mots-clés
  const fetchKeywords = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/document-types/${documentTypeId}/keywords`);
      const data = await response.json();
      
      if (data.success) {
        console.log('📋 Mots-clés chargés:', data.data);
        setKeywords(data.data);
      } else {
        console.error('❌ Erreur API:', data.error);
        toast.error('Erreur lors du chargement des mots-clés');
      }
    } catch (error) {
      console.error('Error fetching keywords:', error);
      toast.error('Erreur lors du chargement des mots-clés');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentTypeId) {
      fetchKeywords();
    }
  }, [documentTypeId]);

  const handleCreate = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setEditingKeyword(null);
    setFormData({ keyword: '', weight: 1, context: '' });
    setShowForm(true);
  };

  const handleEdit = (keyword: DocumentKeyword, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setEditingKeyword(keyword);
    setFormData({
      keyword: keyword.keyword,
      weight: keyword.weight,
      context: keyword.context || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (keywordId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce mot-clé ?')) {
      return;
    }

    try {
      const filteredKeywords = keywords.filter(k => k.id !== keywordId).map(k => ({
        keyword: k.keyword,
        weight: k.weight,
        context: k.context || undefined, // Convertir null en undefined pour le schéma
      }));
      
      console.log('🗑️ Suppression - Données envoyées:', { keywords: filteredKeywords });
      
      const response = await fetch(`/api/admin/document-types/${documentTypeId}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: filteredKeywords }),
      });

      const data = await response.json();
      console.log('🗑️ Suppression - Réponse API:', data);
      
      if (data.success) {
        toast.success('Mot-clé supprimé avec succès');
        fetchKeywords();
      } else {
        console.error('❌ Erreur suppression:', data.error);
        toast.error(data.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting keyword:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!formData.keyword.trim()) {
      toast.error('Le mot-clé est requis');
      return;
    }

    try {
      const updatedKeywords = editingKeyword
        ? keywords.map(k => k.id === editingKeyword.id ? { ...k, ...formData } : k)
        : [...keywords, { id: `temp-${Date.now()}`, documentTypeId, ...formData }];

      const response = await fetch(`/api/admin/document-types/${documentTypeId}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: updatedKeywords.map(k => ({
            id: k.id.startsWith('temp-') ? undefined : k.id,
            keyword: k.keyword,
            weight: k.weight,
            context: k.context || undefined,
          })),
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(editingKeyword ? 'Mot-clé modifié avec succès' : 'Mot-clé créé avec succès');
        setShowForm(false);
        fetchKeywords();
      } else {
        toast.error(data.error || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Error saving keyword:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingKeyword(null);
    setFormData({ keyword: '', weight: 1, context: '' });
  };

  if (loading) {
    return <div className="text-center py-4">Chargement des mots-clés...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Mots-clés</h3>
          <p className="text-sm text-gray-600">Configurez les mots-clés pour la classification</p>
        </div>
        <Button onClick={(e) => handleCreate(e)}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un mot-clé
        </Button>
      </div>

      {keywords.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Aucun mot-clé configuré</p>
          <p className="text-sm">Commencez par ajouter votre premier mot-clé</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Terme</TableHeaderCell>
              <TableHeaderCell>Poids</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keywords.map((keyword) => (
              <TableRow key={keyword.id}>
                <TableCell className="font-medium">{keyword.keyword}</TableCell>
                <TableCell>
                  <Badge variant="outline">{keyword.weight}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleEdit(keyword, e)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDelete(keyword.id, e)}
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
              {editingKeyword ? 'Modifier le mot-clé' : 'Nouveau mot-clé'}
            </DialogTitle>
            <DialogDescription>
              {editingKeyword ? 'Modifiez les paramètres du mot-clé.' : 'Ajoutez un nouveau mot-clé pour améliorer la classification.'}
            </DialogDescription>
          </DialogHeader>
          
          <FormShellStandard id={formId} onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="keyword">Mot-clé *</Label>
              <Input
                id="keyword"
                value={formData.keyword}
                onChange={(e) => setFormData(prev => ({ ...prev, keyword: e.target.value }))}
                placeholder="ex: Bail signé"
                required
              />
            </div>

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

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="ghost" onClick={handleClose}>
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
              <SaveActionStandard
                type="submit"
                form={formId}
                labelEdit="Sauvegarder"
              />
            </div>
          </FormShellStandard>
        </DialogContent>
      </Dialog>
    </div>
  );
}
