/**
 * Onglet "Compatibilités" - Gestion des règles de compatibilité
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
import { Plus, Pencil, Trash2, CheckCircle, AlertTriangle, XCircle, Home, Armchair, Building2 } from 'lucide-react';
import { CreateCompatibilityModal } from './CreateCompatibilityModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';

export function CompatibilitiesTab() {
  const [compatibilities, setCompatibilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompat, setEditingCompat] = useState<any>(null);

  useEffect(() => {
    loadCompatibilities();
  }, []);

  const loadCompatibilities = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tax/compat');
      if (response.ok) {
        const data = await response.json();
        setCompatibilities(data);
      }
    } catch (error) {
      console.error('Erreur chargement compatibilités:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette règle de compatibilité ?')) return;

    try {
      const response = await fetch(`/api/admin/tax/compat/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('✅ Règle supprimée');
        await loadCompatibilities();
      } else {
        alert('❌ Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('❌ Erreur lors de la suppression');
    }
  };

  const handleEdit = (compat: any) => {
    setEditingCompat(compat);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingCompat(null);
  };

  const getRuleIcon = (rule: string) => {
    switch (rule) {
      case 'CAN_MIX':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'GLOBAL_SINGLE_CHOICE':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'MUTUALLY_EXCLUSIVE':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getRuleBadge = (rule: string) => {
    switch (rule) {
      case 'CAN_MIX':
        return (
          <Badge variant="success">
            ✅ Mix autorisé
          </Badge>
        );
      case 'GLOBAL_SINGLE_CHOICE':
        return (
          <Badge variant="warning">
            ⚠️ Choix unique global
          </Badge>
        );
      case 'MUTUALLY_EXCLUSIVE':
        return (
          <Badge variant="danger">
            ⛔ Mutuellement exclusif
          </Badge>
        );
      default:
        return <Badge variant="outline">{rule}</Badge>;
    }
  };

  const getRuleTooltip = (rule: string, left: string, right: string) => {
    switch (rule) {
      case 'CAN_MIX':
        return `✅ Mix autorisé : Vous pouvez posséder simultanément des biens ${left} et ${right}. Ces catégories sont compatibles.`;
      case 'GLOBAL_SINGLE_CHOICE':
        return `⚠️ Choix unique : Vous devez choisir soit ${left} soit ${right} pour l'ensemble de votre patrimoine. Pas de mélange possible.`;
      case 'MUTUALLY_EXCLUSIVE':
        return `⛔ Mutuellement exclusif : Les catégories ${left} et ${right} ne peuvent absolument pas coexister. Si vous avez du ${left}, vous ne pouvez pas avoir de ${right}.`;
      default:
        return 'Règle de compatibilité';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'FONCIER':
        return '🏠';
      case 'BIC':
        return '🪑';
      case 'IS':
        return '🏢';
      default:
        return '';
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Matrice visuelle */}
        <Card>
          <CardHeader>
            <CardTitle>Matrice de compatibilité des catégories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div></div>
              <div className="font-semibold text-sm flex items-center justify-center gap-1">
                🏠 FONCIER
              </div>
              <div className="font-semibold text-sm flex items-center justify-center gap-1">
                🪑 BIC
              </div>
              <div className="font-semibold text-sm flex items-center justify-center gap-1">
                🏢 IS
              </div>

              <div className="font-semibold text-sm flex items-center justify-center gap-1">
                🏠 FONCIER
              </div>
              <div className="p-4 bg-gray-100 rounded">-</div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-4 bg-green-50 rounded cursor-help hover:bg-green-100 transition-colors">
                    ✅ Mix autorisé
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    {getRuleTooltip('CAN_MIX', 'FONCIER', 'BIC')}
                  </p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-4 bg-red-50 rounded cursor-help hover:bg-red-100 transition-colors">
                    ⛔ Exclusif
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    {getRuleTooltip('MUTUALLY_EXCLUSIVE', 'FONCIER', 'IS')}
                  </p>
                </TooltipContent>
              </Tooltip>

              <div className="font-semibold text-sm flex items-center justify-center gap-1">
                🪑 BIC
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-4 bg-green-50 rounded cursor-help hover:bg-green-100 transition-colors">
                    ✅ Mix autorisé
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    {getRuleTooltip('CAN_MIX', 'BIC', 'FONCIER')}
                  </p>
                </TooltipContent>
              </Tooltip>
              <div className="p-4 bg-gray-100 rounded">-</div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-4 bg-red-50 rounded cursor-help hover:bg-red-100 transition-colors">
                    ⛔ Exclusif
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    {getRuleTooltip('MUTUALLY_EXCLUSIVE', 'BIC', 'IS')}
                  </p>
                </TooltipContent>
              </Tooltip>

              <div className="font-semibold text-sm flex items-center justify-center gap-1">
                🏢 IS
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-4 bg-red-50 rounded cursor-help hover:bg-red-100 transition-colors">
                    ⛔ Exclusif
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    {getRuleTooltip('MUTUALLY_EXCLUSIVE', 'IS', 'FONCIER')}
                  </p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-4 bg-red-50 rounded cursor-help hover:bg-red-100 transition-colors">
                    ⛔ Exclusif
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    {getRuleTooltip('MUTUALLY_EXCLUSIVE', 'IS', 'BIC')}
                  </p>
                </TooltipContent>
              </Tooltip>
              <div className="p-4 bg-gray-100 rounded">-</div>
            </div>
          </CardContent>
        </Card>

      {/* Liste des règles détaillées */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Règles de compatibilité</CardTitle>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle règle
          </Button>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-center py-4">Chargement...</div>}

          {!loading && compatibilities.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              Aucune règle de compatibilité
            </div>
          )}

          {!loading && compatibilities.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Portée</TableHeaderCell>
                  <TableHeaderCell>Gauche</TableHeaderCell>
                  <TableHeaderCell>Droite</TableHeaderCell>
                  <TableHeaderCell>Règle</TableHeaderCell>
                  <TableHeaderCell>Note</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compatibilities.map((compat) => (
                  <TableRow key={compat.id}>
                    <TableCell>
                      <Badge variant="outline">{compat.scope}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{compat.left}</TableCell>
                    <TableCell className="font-medium">{compat.right}</TableCell>
                    <TableCell>{getRuleBadge(compat.rule)}</TableCell>
                    <TableCell className="text-sm text-gray-600">{compat.note || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(compat)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(compat.id)}
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

      {/* Modal de création/édition */}
      <CreateCompatibilityModal
        open={modalOpen}
        onClose={handleCloseModal}
        onSuccess={loadCompatibilities}
        editingCompat={editingCompat}
      />
      </div>
    </TooltipProvider>
  );
}

