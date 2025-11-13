/**
 * Onglet "Types & Régimes" - CRUD des types et régimes fiscaux
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHeaderCell,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Plus, Pencil, Trash2, Home, Armchair, Building2 } from 'lucide-react';
import { CreateTypeModal } from './CreateTypeModal';
import { CreateRegimeModal } from './CreateRegimeModal';

export function TypesRegimesTab() {
  const [types, setTypes] = useState<any[]>([]);
  const [regimes, setRegimes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [regimeModalOpen, setRegimeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [editingRegime, setEditingRegime] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [typesRes, regimesRes] = await Promise.all([
        fetch('/api/admin/tax/types'),
        fetch('/api/admin/tax/regimes'),
      ]);

      if (typesRes.ok) {
        const typesData = await typesRes.json();
        setTypes(typesData);
      }

      if (regimesRes.ok) {
        const regimesData = await regimesRes.json();
        setRegimes(regimesData);
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm(`Supprimer le type fiscal "${id}" ?`)) return;

    try {
      const response = await fetch(`/api/admin/tax/types/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('✅ Type supprimé');
        await loadData();
      } else {
        const error = await response.json();
        alert(`❌ ${error.error}`);
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('❌ Erreur lors de la suppression');
    }
  };

  const handleDeleteRegime = async (id: string) => {
    if (!confirm(`Supprimer le régime fiscal "${id}" ?`)) return;

    try {
      const response = await fetch(`/api/admin/tax/regimes/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('✅ Régime supprimé');
        await loadData();
      } else {
        const error = await response.json();
        alert(`❌ ${error.error}`);
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('❌ Erreur lors de la suppression');
    }
  };

  const handleEditType = (type: any) => {
    setEditingType(type);
    setTypeModalOpen(true);
  };

  const handleEditRegime = (regime: any) => {
    setEditingRegime(regime);
    setRegimeModalOpen(true);
  };

  const handleCloseTypeModal = () => {
    setTypeModalOpen(false);
    setEditingType(null);
  };

  const handleCloseRegimeModal = () => {
    setRegimeModalOpen(false);
    setEditingRegime(null);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'FONCIER':
        return <Home className="h-4 w-4 text-blue-600" />;
      case 'BIC':
        return <Armchair className="h-4 w-4 text-green-600" />;
      case 'IS':
        return <Building2 className="h-4 w-4 text-purple-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Types Fiscaux */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Types fiscaux</CardTitle>
          <Button size="sm" onClick={() => setTypeModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau
          </Button>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-center py-4">Chargement...</div>}

          {!loading && types.length === 0 && (
            <div className="text-center py-4 text-gray-500">Aucun type fiscal</div>
          )}

          {!loading && types.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>ID</TableHeaderCell>
                  <TableHeaderCell>Label</TableHeaderCell>
                  <TableHeaderCell>Catégorie</TableHeaderCell>
                  <TableHeaderCell>Statut</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(type.category)}
                        {type.label}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(type.category)}
                        <Badge variant="outline">{type.category}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {type.isActive ? (
                        <Badge variant="default">Actif</Badge>
                      ) : (
                        <Badge variant="secondary">Inactif</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditType(type)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteType(type.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Régimes Fiscaux */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Régimes fiscaux</CardTitle>
          <Button size="sm" onClick={() => setRegimeModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau
          </Button>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-center py-4">Chargement...</div>}

          {!loading && regimes.length === 0 && (
            <div className="text-center py-4 text-gray-500">Aucun régime fiscal</div>
          )}

          {!loading && regimes.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>ID</TableHeaderCell>
                  <TableHeaderCell>Label</TableHeaderCell>
                  <TableHeaderCell>S'applique à</TableHeaderCell>
                  <TableHeaderCell>Statut</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regimes.map((regime) => {
                  const appliesTo = JSON.parse(regime.appliesToIds) as string[];
                  return (
                    <TableRow key={regime.id}>
                      <TableCell className="font-medium">{regime.id}</TableCell>
                      <TableCell>{regime.label}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {appliesTo.map((typeId) => (
                            <Badge key={typeId} variant="secondary" className="text-xs">
                              {typeId}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {regime.isActive ? (
                          <Badge variant="default">Actif</Badge>
                        ) : (
                          <Badge variant="secondary">Inactif</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditRegime(regime)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteRegime(regime.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateTypeModal
        open={typeModalOpen}
        onClose={handleCloseTypeModal}
        onSuccess={loadData}
        editingType={editingType}
      />

      <CreateRegimeModal
        open={regimeModalOpen}
        onClose={handleCloseRegimeModal}
        onSuccess={loadData}
        editingRegime={editingRegime}
        availableTypes={types}
      />
    </div>
  );
}

