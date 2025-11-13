/**
 * Modal de création/édition d'un type fiscal
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/ui/shared/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/shared/select';
import { Switch } from '@/components/ui/Switch';

interface CreateTypeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingType?: any;
}

export function CreateTypeModal({ open, onClose, onSuccess, editingType }: CreateTypeModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    label: '',
    category: 'FONCIER',
    description: '',
    isActive: true,
  });

  useEffect(() => {
    if (editingType) {
      setFormData({
        id: editingType.id,
        label: editingType.label,
        category: editingType.category,
        description: editingType.description || '',
        isActive: editingType.isActive,
      });
    } else {
      setFormData({
        id: '',
        label: '',
        category: 'FONCIER',
        description: '',
        isActive: true,
      });
    }
  }, [editingType, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingType
        ? `/api/admin/tax/types/${editingType.id}`
        : '/api/admin/tax/types';
      
      const method = editingType ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert(`✅ Type fiscal ${editingType ? 'modifié' : 'créé'} avec succès`);
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        alert(`❌ Erreur: ${error.error}`);
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('❌ Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingType ? 'Modifier' : 'Créer'} un type fiscal
          </DialogTitle>
          <DialogDescription>
            Définissez les caractéristiques du type fiscal
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="id">ID *</Label>
            <Input
              id="id"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
              placeholder="NU, MEUBLE, SCI_IS..."
              disabled={!!editingType}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Identifiant unique (majuscules, sans espaces)
            </p>
          </div>

          <div>
            <Label htmlFor="label">Label *</Label>
            <Input
              id="label"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Location nue (non meublée)"
              required
            />
          </div>

          <div>
            <Label htmlFor="category">Catégorie *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FONCIER">FONCIER (Revenus fonciers)</SelectItem>
                <SelectItem value="BIC">BIC (Bénéfices Industriels et Commerciaux)</SelectItem>
                <SelectItem value="IS">IS (Impôt sur les Sociétés)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description détaillée du type fiscal..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">Type actif</Label>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Enregistrement...' : editingType ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

