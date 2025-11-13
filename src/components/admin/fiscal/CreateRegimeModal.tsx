/**
 * Modal de création/édition d'un régime fiscal
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
import { Switch } from '@/components/ui/Switch';
import { Checkbox } from '@/components/ui/Checkbox';

interface CreateRegimeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingRegime?: any;
  availableTypes: any[];
}

export function CreateRegimeModal({
  open,
  onClose,
  onSuccess,
  editingRegime,
  availableTypes,
}: CreateRegimeModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    label: '',
    appliesToIds: [] as string[],
    engagementYears: 0,
    calcProfile: '',
    description: '',
    isActive: true,
  });

  useEffect(() => {
    if (editingRegime) {
      setFormData({
        id: editingRegime.id,
        label: editingRegime.label,
        appliesToIds: JSON.parse(editingRegime.appliesToIds),
        engagementYears: editingRegime.engagementYears || 0,
        calcProfile: editingRegime.calcProfile,
        description: editingRegime.description || '',
        isActive: editingRegime.isActive,
      });
    } else {
      setFormData({
        id: '',
        label: '',
        appliesToIds: [],
        engagementYears: 0,
        calcProfile: '',
        description: '',
        isActive: true,
      });
    }
  }, [editingRegime, open]);

  const handleTypeToggle = (typeId: string) => {
    setFormData((prev) => ({
      ...prev,
      appliesToIds: prev.appliesToIds.includes(typeId)
        ? prev.appliesToIds.filter((id) => id !== typeId)
        : [...prev.appliesToIds, typeId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.appliesToIds.length === 0) {
      alert('⚠️ Veuillez sélectionner au moins un type fiscal');
      return;
    }

    setLoading(true);

    try {
      const url = editingRegime
        ? `/api/admin/tax/regimes/${editingRegime.id}`
        : '/api/admin/tax/regimes';

      const method = editingRegime ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          engagementYears: formData.engagementYears > 0 ? formData.engagementYears : null,
        }),
      });

      if (response.ok) {
        alert(`✅ Régime fiscal ${editingRegime ? 'modifié' : 'créé'} avec succès`);
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {editingRegime ? 'Modifier' : 'Créer'} un régime fiscal
          </DialogTitle>
          <DialogDescription>
            Définissez les caractéristiques du régime fiscal
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="id">ID *</Label>
            <Input
              id="id"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
              placeholder="MICRO, REEL, MICRO_BIC..."
              disabled={!!editingRegime}
              required
            />
          </div>

          <div>
            <Label htmlFor="label">Label *</Label>
            <Input
              id="label"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Micro-foncier"
              required
            />
          </div>

          <div>
            <Label>S'applique aux types fiscaux * (sélection multiple)</Label>
            <div className="border rounded-lg p-4 space-y-2 mt-2">
              {availableTypes.map((type: any) => (
                <div key={type.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`type-${type.id}`}
                    checked={formData.appliesToIds.includes(type.id)}
                    onCheckedChange={() => handleTypeToggle(type.id)}
                  />
                  <label
                    htmlFor={`type-${type.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {type.label} ({type.category})
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="engagementYears">Durée d'engagement (années)</Label>
            <Input
              id="engagementYears"
              type="number"
              min="0"
              max="10"
              value={formData.engagementYears}
              onChange={(e) =>
                setFormData({ ...formData, engagementYears: parseInt(e.target.value) || 0 })
              }
              placeholder="0 (aucun engagement)"
            />
            <p className="text-xs text-gray-500 mt-1">
              Ex: 3 ans pour le régime réel foncier, 2 ans pour le LMNP réel
            </p>
          </div>

          <div>
            <Label htmlFor="calcProfile">Profil de calcul *</Label>
            <Input
              id="calcProfile"
              value={formData.calcProfile}
              onChange={(e) => setFormData({ ...formData, calcProfile: e.target.value })}
              placeholder="micro_foncier, reel_foncier, micro_bic..."
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Identifiant utilisé par le moteur de calcul fiscal
            </p>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description détaillée du régime..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">Régime actif</Label>
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
              {loading ? 'Enregistrement...' : editingRegime ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

