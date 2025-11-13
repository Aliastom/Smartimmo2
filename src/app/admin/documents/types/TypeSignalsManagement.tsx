'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/ui/shared/label';
import { Switch } from '@/components/ui/Switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/shared/select';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
// import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Plus, Eye, Trash2, GripVertical, ExternalLink, Search } from 'lucide-react';
import { toast } from 'sonner';

interface TypeSignal {
  id: string;
  signalId: string;
  code: string;
  label: string;
  regex: string;
  flags: string;
  description?: string;
  weight: number;
  enabled: boolean;
  order: number;
  isOrphan?: boolean;
}

interface Signal {
  id: string;
  code: string;
  label: string;
  regex: string;
  flags: string;
  description?: string;
  protected: boolean;
}

interface TypeSignalsManagementProps {
  documentTypeId: string;
  allowAddSignals?: boolean; // Par défaut true, false pour désactiver l'ajout
}

export default function TypeSignalsManagement({ documentTypeId, allowAddSignals = true }: TypeSignalsManagementProps) {
  const [typeSignals, setTypeSignals] = useState<TypeSignal[]>([]);
  const [availableSignals, setAvailableSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<TypeSignal | null>(null);
  const [selectedSignalId, setSelectedSignalId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Charger les signaux du type
  const fetchTypeSignals = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/document-types/${documentTypeId}/type-signals`);
      const data = await response.json();

      if (data.success) {
        setTypeSignals(data.data.sort((a: TypeSignal, b: TypeSignal) => a.order - b.order));
      } else {
        toast.error('Erreur lors du chargement des signaux');
      }
    } catch (error) {
      console.error('Error fetching type signals:', error);
      toast.error('Erreur lors du chargement des signaux');
    } finally {
      setLoading(false);
    }
  };

  // Charger les signaux disponibles
  const fetchAvailableSignals = async () => {
    try {
      const response = await fetch('/api/admin/signals');
      const data = await response.json();

      if (data.success) {
        // Filtrer les signaux déjà associés
        const usedSignalIds = typeSignals.map(ts => ts.signalId);
        const available = data.data.filter((s: Signal) => !usedSignalIds.includes(s.id));
        setAvailableSignals(available);
      }
    } catch (error) {
      console.error('Error fetching available signals:', error);
    }
  };

  useEffect(() => {
    fetchTypeSignals();
  }, [documentTypeId]);

  useEffect(() => {
    if (showAddModal) {
      fetchAvailableSignals();
    }
  }, [showAddModal, typeSignals]);

  // Ajouter un signal
  const handleAdd = async () => {
    if (!selectedSignalId) {
      toast.error('Veuillez sélectionner un signal');
      return;
    }

    try {
      const maxOrder = typeSignals.length > 0 ? Math.max(...TypeSignal.map(ts => ts.order)) : -1;
      
      const response = await fetch(`/api/admin/document-types/${documentTypeId}/type-signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signalId: selectedSignalId,
          weight: 1.0,
          enabled: true,
          order: maxOrder + 1
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Signal ajouté avec succès');
        setShowAddModal(false);
        setSelectedSignalId('');
        fetchTypeSignals();
      } else {
        toast.error(data.error || 'Erreur lors de l\'ajout');
      }
    } catch (error) {
      console.error('Error adding signal:', error);
      toast.error('Erreur lors de l\'ajout du signal');
    }
  };

  // Mettre à jour le poids
  const handleWeightChange = async (typeSignalId: string, newWeight: number) => {
    try {
      const response = await fetch(`/api/admin/document-types/${documentTypeId}/type-signals/${typeSignalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight: newWeight })
      });

      const data = await response.json();

      if (data.success) {
        setTypeSignals(prev => prev.map(ts => 
          ts.id === typeSignalId ? { ...ts, weight: newWeight } : ts
        ));
      } else {
        toast.error(data.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Error updating weight:', error);
      toast.error('Erreur lors de la mise à jour du poids');
    }
  };

  // Activer/Désactiver
  const handleToggleEnabled = async (typeSignalId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/document-types/${documentTypeId}/type-signals/${typeSignalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });

      const data = await response.json();

      if (data.success) {
        setTypeSignals(prev => prev.map(ts => 
          ts.id === typeSignalId ? { ...ts, enabled } : ts
        ));
      } else {
        toast.error(data.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Error toggling enabled:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  // Retirer un signal (supprime la liaison, pas le signal)
  const handleRemove = async (typeSignalId: string, signalCode: string, isOrphan: boolean = false) => {
    const message = isOrphan 
      ? `Êtes-vous sûr de vouloir retirer le signal orphelin "${signalCode}" de ce type ?`
      : `Êtes-vous sûr de vouloir retirer le signal "${signalCode}" de ce type ?`;
    
    if (!confirm(message)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/document-types/${documentTypeId}/type-signals/${typeSignalId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Signal retiré avec succès');
        fetchTypeSignals();
      } else {
        toast.error(data.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error removing signal:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  // Voir les détails
  const handleViewDetails = (typeSignal: TypeSignal) => {
    setSelectedSignal(typeSignal);
    setShowDetailsModal(true);
  };

  // Filtrer les signaux disponibles
  const filteredSignals = availableSignals.filter(s => 
    s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="p-4">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Signaux de classification</h3>
        {allowAddSignals && (
          <Button onClick={() => setShowAddModal(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un signal
          </Button>
        )}
      </div>

      {typeSignals.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {allowAddSignals 
            ? 'Aucun signal configuré. Cliquez sur "Ajouter un signal" pour commencer.'
            : 'Aucun signal configuré pour ce type de document.'
          }
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell className="w-12"></TableHeaderCell>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Label</TableHeaderCell>
              <TableHeaderCell className="w-32">Poids</TableHeaderCell>
              <TableHeaderCell className="w-24">Activé</TableHeaderCell>
              <TableHeaderCell className="w-32">Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {typeSignals.map((ts) => (
              <TableRow key={ts.id}>
                <TableCell>
                  <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">{ts.code}</code>
                    {ts.isOrphan && (
                      <Badge variant="destructive" className="text-xs">
                        Orphelin
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={ts.isOrphan ? 'text-gray-400 italic' : ''}>{ts.label}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    value={ts.weight}
                    onChange={(e) => handleWeightChange(ts.id, parseFloat(e.target.value) || 0)}
                    className="w-20"
                    disabled={ts.isOrphan}
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={ts.enabled}
                    onCheckedChange={(checked) => handleToggleEnabled(ts.id, checked)}
                    disabled={ts.isOrphan}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(ts)}
                      title="Voir les détails"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(ts.id, ts.code, ts.isOrphan)}
                      title={ts.isOrphan ? "Retirer ce signal orphelin" : "Retirer ce signal"}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Modal Ajouter un signal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter un signal du catalogue</DialogTitle>
            <DialogDescription>
              Sélectionnez un signal du catalogue global pour l'ajouter à ce type de document.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Rechercher un signal</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Code ou label..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label>Signal</Label>
              <Select value={selectedSignalId} onValueChange={setSelectedSignalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un signal" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSignals.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      {searchTerm ? 'Aucun signal trouvé' : 'Tous les signaux sont déjà ajoutés'}
                    </div>
                  ) : (
                    filteredSignals.map((signal) => (
                      <SelectItem key={signal.id} value={signal.id}>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-gray-100 px-1 rounded">{signal.code}</code>
                          <span>{signal.label}</span>
                          {signal.protected && (
                            <Badge variant="secondary" className="ml-2">Protégé</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800">
              ℹ️ Le signal sera ajouté avec un poids de 1.0 par défaut. Vous pourrez l'ajuster ensuite.
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowAddModal(false);
                setSelectedSignalId('');
                setSearchTerm('');
              }}>
                Annuler
              </Button>
              <Button onClick={handleAdd} disabled={!selectedSignalId}>
                Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Détails (read-only) */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails du signal</DialogTitle>
            <DialogDescription>
              Informations en lecture seule. Pour modifier le signal, ouvrez-le dans le catalogue.
            </DialogDescription>
          </DialogHeader>

          {selectedSignal && (
            <div className="p-6 space-y-4">
              <div>
                <Label>Code</Label>
                <Input value={selectedSignal.code} readOnly className="bg-gray-50" />
              </div>

              <div>
                <Label>Label</Label>
                <Input value={selectedSignal.label} readOnly className="bg-gray-50" />
              </div>

              <div>
                <Label>Regex</Label>
                <Input value={selectedSignal.regex} readOnly className="bg-gray-50 font-mono text-xs" />
              </div>

              <div>
                <Label>Flags</Label>
                <Input value={selectedSignal.flags} readOnly className="bg-gray-50" />
              </div>

              {selectedSignal.description && (
                <div>
                  <Label>Description</Label>
                  <Input value={selectedSignal.description} readOnly className="bg-gray-50" />
                </div>
              )}

              <div className="flex gap-4">
                <div className="flex-1">
                  <Label>Poids (dans ce type)</Label>
                  <Input value={selectedSignal.weight} readOnly className="bg-gray-50" />
                </div>
                <div className="flex-1">
                  <Label>Statut</Label>
                  <Input 
                    value={selectedSignal.enabled ? 'Activé' : 'Désactivé'} 
                    readOnly 
                    className="bg-gray-50" 
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => window.open('/admin/signals', '_blank')}
                  className="w-full"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ouvrir dans le catalogue pour éditer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
