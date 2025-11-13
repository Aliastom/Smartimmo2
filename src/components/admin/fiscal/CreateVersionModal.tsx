/**
 * Modal de création d'une nouvelle version fiscale (depuis copie)
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
import { Loader2, Copy } from 'lucide-react';

interface CreateVersionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  versions: any[];
}

export function CreateVersionModal({
  open,
  onClose,
  onSuccess,
  versions,
}: CreateVersionModalProps) {
  const [loading, setLoading] = useState(false);
  const currentYear = new Date().getFullYear();
  
  const [formData, setFormData] = useState({
    sourceVersionId: '',
    year: currentYear,
    code: `${currentYear}.1`,
    source: `DGFiP ${currentYear}`,
    notes: '',
  });

  // Réinitialiser le formulaire quand le modal s'ouvre
  useEffect(() => {
    if (open) {
      // Trouver la dernière version publiée par défaut
      const lastPublished = versions.find(v => v.status === 'published');
      
      setFormData({
        sourceVersionId: lastPublished?.id || '',
        year: currentYear,
        code: `${currentYear}.1`,
        source: `DGFiP ${currentYear}`,
        notes: '',
      });
    }
  }, [open, versions, currentYear]);

  // Mettre à jour le code automatiquement quand l'année change
  useEffect(() => {
    const versionsForYear = versions.filter(v => v.year === formData.year);
    const nextNumber = versionsForYear.length + 1;
    setFormData(prev => ({
      ...prev,
      code: `${prev.year}.${nextNumber}`,
    }));
  }, [formData.year, versions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.sourceVersionId) {
      alert('⚠️ Veuillez sélectionner une version source');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/admin/tax/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newVersion = await response.json();
        alert(`✅ Version ${newVersion.code} créée avec succès`);
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        alert(`❌ Erreur: ${error.error}`);
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('❌ Erreur lors de la création de la version');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Créer une nouvelle version fiscale
          </DialogTitle>
          <DialogDescription>
            Créez une nouvelle version en copiant les paramètres d'une version existante
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="sourceVersion">Version source * (à copier)</Label>
            <Select
              value={formData.sourceVersionId}
              onValueChange={(value) => setFormData({ ...formData, sourceVersionId: value })}
            >
              <SelectTrigger id="sourceVersion" className="mt-1">
                <SelectValue placeholder="Sélectionnez une version à copier">
                  {formData.sourceVersionId && (() => {
                    const selected = versions.find(v => v.id === formData.sourceVersionId);
                    return selected ? `${selected.code} - ${selected.year} (${selected.status})` : '';
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {versions.map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    {version.code} - {version.year} ({version.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Les paramètres fiscaux de cette version seront copiés dans la nouvelle version
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="year">Année *</Label>
              <Input
                id="year"
                type="number"
                min={currentYear - 1}
                max={currentYear + 5}
                value={formData.year}
                onChange={(e) =>
                  setFormData({ ...formData, year: parseInt(e.target.value) })
                }
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Année fiscale de la nouvelle version
              </p>
            </div>

            <div>
              <Label htmlFor="code">Code version *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="2025.1"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Format recommandé : ANNÉE.NUMERO
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="source">Source *</Label>
            <Input
              id="source"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              placeholder="DGFiP 2025"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Origine des données fiscales (ex: DGFiP, BOFiP)
            </p>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notes ou commentaires sur cette version..."
              rows={3}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>ℹ️ Information :</strong> La nouvelle version sera créée en statut{' '}
              <strong>"draft"</strong>. Vous pourrez l'éditer et la publier ensuite.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Créer la version
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

