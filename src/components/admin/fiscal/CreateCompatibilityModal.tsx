/**
 * Modal de création/édition d'une règle de compatibilité
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
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

interface CreateCompatibilityModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingCompat?: any;
}

const CATEGORIES = ['FONCIER', 'BIC', 'IS'];
const RULES = [
  { value: 'CAN_MIX', label: '✅ Mix autorisé', description: 'Les deux catégories peuvent être combinées' },
  { value: 'GLOBAL_SINGLE_CHOICE', label: '⚠️ Choix unique global', description: 'Une seule catégorie peut être choisie globalement' },
  { value: 'MUTUALLY_EXCLUSIVE', label: '⛔ Mutuellement exclusif', description: 'Les deux catégories ne peuvent pas coexister' },
];

export function CreateCompatibilityModal({
  open,
  onClose,
  onSuccess,
  editingCompat,
}: CreateCompatibilityModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    scope: 'category',
    left: 'FONCIER',
    right: 'BIC',
    rule: 'CAN_MIX',
    note: '',
  });

  useEffect(() => {
    if (editingCompat) {
      setFormData({
        scope: editingCompat.scope,
        left: editingCompat.left,
        right: editingCompat.right,
        rule: editingCompat.rule,
        note: editingCompat.note || '',
      });
    } else {
      setFormData({
        scope: 'category',
        left: 'FONCIER',
        right: 'BIC',
        rule: 'CAN_MIX',
        note: '',
      });
    }
  }, [editingCompat, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingCompat
        ? `/api/admin/tax/compat/${editingCompat.id}`
        : '/api/admin/tax/compat';

      const method = editingCompat ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert(`✅ Règle de compatibilité ${editingCompat ? 'modifiée' : 'créée'} avec succès`);
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
            {editingCompat ? 'Modifier' : 'Créer'} une règle de compatibilité
          </DialogTitle>
          <DialogDescription>
            Définissez les règles de compatibilité entre catégories fiscales
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="scope">Portée</Label>
            <Select
              value={formData.scope}
              onValueChange={(value) => setFormData({ ...formData, scope: value })}
              disabled={!!editingCompat}
            >
              <SelectTrigger id="scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Catégorie (FONCIER/BIC/IS)</SelectItem>
                <SelectItem value="type">Type fiscal (NU/MEUBLE/etc.)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="left">Gauche *</Label>
              <Select
                value={formData.left}
                onValueChange={(value) => setFormData({ ...formData, left: value })}
                disabled={!!editingCompat}
              >
                <SelectTrigger id="left">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="right">Droite *</Label>
              <Select
                value={formData.right}
                onValueChange={(value) => setFormData({ ...formData, right: value })}
                disabled={!!editingCompat}
              >
                <SelectTrigger id="right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="rule">Règle de compatibilité *</Label>
            <Select
              value={formData.rule}
              onValueChange={(value) => setFormData({ ...formData, rule: value })}
            >
              <SelectTrigger id="rule">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RULES.map((rule) => (
                  <SelectItem key={rule.value} value={rule.value}>
                    {rule.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              {RULES.find((r) => r.value === formData.rule)?.description}
            </p>
          </div>

          <div>
            <Label htmlFor="note">Note / Explication</Label>
            <Textarea
              id="note"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="Explication de la règle de compatibilité..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Enregistrement...' : editingCompat ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

