'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Download, 
  Upload,
  Search,
  ChevronDown,
  Settings,
  MoreHorizontal,
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Checkbox } from '@/components/ui/Checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu';
import { Tooltip } from '@/components/ui/Tooltip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Label } from '@/ui/shared/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/shared/select';
import { toast } from 'sonner';
import NatureCategoryFormModal from './NatureCategoryFormModal';
import { NaturesCategoriesHelpModal } from '@/components/admin/NaturesCategoriesHelpModal';

// Types pour les données
interface Nature {
  key: string;
  label: string;
  flow: 'INCOME' | 'EXPENSE';
  active: boolean;
  compatibleTypes: string[];
  defaultCategory?: string;
}

interface Category {
  id: string;
  key: string;
  label: string;
  type: string;
  active: boolean;
  deductible?: boolean;
  capitalizable?: boolean;
}

interface NatureCategoryMapping {
  nature: string;
  types: string[];
  defaultCategory?: string;
}

interface ExportData {
  natures: Nature[];
  categories: Category[];
  mappings: NatureCategoryMapping[];
}

export default function NaturesCategoriesAdminClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [natures, setNatures] = useState<Nature[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mappings, setMappings] = useState<NatureCategoryMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Nature | Category | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'nature' | 'category'>('nature');
  
  // États pour l'import/export
  const [openImport, setOpenImport] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'overwrite' | 'merge'>('overwrite');
  
  // État pour la modal d'aide
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Charger les données
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Charger les natures et catégories directement depuis la BDD
      const [naturesResponse, categoriesResponse] = await Promise.all([
        fetch('/api/admin/natures'),
        fetch('/api/admin/categories')
      ]);

      const naturesData = await naturesResponse.json();
      const categoriesData = await categoriesResponse.json();

      console.log('=== FETCH DATA DEBUG ===');
      console.log('Natures data:', naturesData);
      console.log('Categories data:', categoriesData);

      // Utiliser directement les données de l'API BDD
      const transformedNatures: Nature[] = naturesData.data || [];
      console.log('Transformed natures:', transformedNatures);
      console.log('RECETTE_LOYER mapping:', transformedNatures.find(n => n.key === 'RECETTE_LOYER'));

      const transformedCategories: Category[] = (categoriesData.data || []).map((cat: any) => ({
        id: cat.id,
        key: cat.key,
        label: cat.label,
        type: cat.type,
        active: cat.active,
        deductible: cat.deductible,
        capitalizable: cat.capitalizable
      }));

      // Les mappings sont maintenant inclus dans les natures (compatibleTypes et defaultCategory)
      const transformedMappings: NatureCategoryMapping[] = transformedNatures.map(nature => ({
        nature: nature.key,
        types: nature.compatibleTypes,
        defaultCategory: nature.defaultCategory
      }));

      setNatures(transformedNatures);
      setCategories(transformedCategories);
      setMappings(transformedMappings);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchData();
  }, []);

  // Filtrer les données selon la recherche
  const filteredNatures = natures.filter(nature =>
    nature.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    nature.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCategories = categories.filter(category =>
    category.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allFilteredItems = [
    ...filteredNatures.map(item => ({ ...item, itemType: 'nature' as const })),
    ...filteredCategories.map(item => ({ ...item, itemType: 'category' as const }))
  ];

  const handleCreate = (mode: 'nature' | 'category') => {
    setFormMode(mode);
    setSelectedItem(null);
    setShowFormModal(true);
  };

  const handleEdit = (item: Nature | Category, type: 'nature' | 'category') => {
    setSelectedItem(item);
    setFormMode(type);
    setShowFormModal(true);
  };

  const handleDelete = async (item: Nature | Category, type: 'nature' | 'category') => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${item.label}" ?`)) {
      return;
    }

    try {
      console.log('=== DELETE DEBUG ===');
      console.log('Deleting item:', item, 'type:', type);
      
      const url = type === 'nature' ? '/api/admin/natures' : '/api/admin/categories';
      const response = await fetch(`${url}?key=${encodeURIComponent(item.key)}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      console.log('Delete response:', result);

      if (result.success) {
        const itemType = type === 'nature' ? 'nature' : 'catégorie';
        toast.success(`${itemType} supprimée avec succès`);
        fetchData();
      } else {
        toast.error(result.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleSave = async (data: any) => {
    try {
      console.log('=== DEBUG SAVE ===');
      console.log('Data to save:', data);
      console.log('Selected item:', selectedItem);
      console.log('Form mode:', formMode);
      
      // Déterminer l'API selon le type d'élément
      const isCategory = formMode === 'category';
      const url = isCategory ? '/api/admin/categories' : '/api/admin/natures';
      const method = selectedItem ? 'PATCH' : 'POST';
      
      console.log('URL:', url, 'Method:', method, 'IsCategory:', isCategory);
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response data:', result);
      
      if (result.success) {
        const itemType = isCategory ? 'catégorie' : 'nature';
        const action = selectedItem ? 'modifiée' : 'créée';
        toast.success(`${itemType} ${action} avec succès`);
        setShowFormModal(false);
        
        // Attendre un peu avant de recharger les données pour s'assurer que la sauvegarde est terminée
        setTimeout(() => {
          fetchData();
        }, 500);
      } else {
        toast.error(result.error || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/natures-categories/export');
      
      if (!response.ok) {
        throw new Error('Erreur lors de l\'export');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `natures-categories-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Configuration exportée avec succès');
    } catch (error) {
      console.error('Error exporting config:', error);
      toast.error('Erreur lors de l\'export');
    }
  };

  const handleImport = async () => {
    try {
      setImportError(null);
      setImportLoading(true);
      
      if (!file) {
        setImportError('Veuillez sélectionner un fichier JSON');
        return;
      }

      const text = await file.text();
      const cleanText = text.trim().replace(/^\uFEFF/, '');
      const json = JSON.parse(cleanText);

      // Valider la structure
      if (!json || typeof json !== 'object') {
        setImportError('Format de configuration invalide. Le fichier doit contenir un objet JSON valide');
        return;
      }
      
      if (!json.natures || !Array.isArray(json.natures)) {
        setImportError('Format de configuration invalide. Le fichier doit contenir une propriété "natures" (tableau)');
        return;
      }
      
      if (!json.categories || !Array.isArray(json.categories)) {
        setImportError('Format de configuration invalide. Le fichier doit contenir une propriété "categories" (tableau)');
        return;
      }
      
      if (!json.mappings || !Array.isArray(json.mappings)) {
        setImportError('Format de configuration invalide. Le fichier doit contenir une propriété "mappings" (tableau)');
        return;
      }
      
      // Valider que chaque nature a les champs requis
      for (let i = 0; i < json.natures.length; i++) {
        const nature = json.natures[i];
        const id = nature.key || nature.code;
        
        if (!id) {
          setImportError(`Nature à l'index ${i} : champ "key" ou "code" manquant`);
          return;
        }
        
        if (!nature.label) {
          setImportError(`Nature "${id}" : champ "label" manquant`);
          return;
        }
      }
      
      // Valider que chaque catégorie a les champs requis
      for (let i = 0; i < json.categories.length; i++) {
        const category = json.categories[i];
        const id = category.key || category.slug;
        
        if (!id) {
          setImportError(`Catégorie à l'index ${i} : champ "key" ou "slug" manquant`);
          return;
        }
        
        if (!category.label) {
          setImportError(`Catégorie "${id}" : champ "label" manquant`);
          return;
        }
      }
      
      // Valider que chaque mapping référence une nature existante
      for (let i = 0; i < json.mappings.length; i++) {
        const mapping = json.mappings[i];
        const natureRef = mapping.nature || mapping.natureCode;
        
        if (!natureRef) {
          setImportError(`Mapping à l'index ${i} : champ "nature" ou "natureCode" manquant`);
          return;
        }
        
        const natureExists = json.natures.some((n: any) => 
          (n.key === natureRef || n.code === natureRef)
        );
        
        if (!natureExists) {
          setImportError(`Mapping "${natureRef}" : nature non trouvée dans le fichier`);
          return;
        }
      }
      
      console.log('✅ Validation JSON réussie:', {
        natures: json.natures.length,
        categories: json.categories.length,
        mappings: json.mappings.length
      });

          // Appeler l'API d'import
          const response = await fetch('/api/admin/natures-categories/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...json,
              importMode
            }),
          });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur lors de l\'import' }));
        throw new Error(errorData.error || 'Erreur lors de l\'import');
      }

      const data = await response.json();
      
      if (data.success) {
        const message = data.data.importMode === 'overwrite' 
          ? `Import réussi (overwrite) — Supprimés: ${data.data.deleted}, Créés: ${data.data.created}, Ignorés: ${data.data.skipped}`
          : `Import réussi (merge) — Créés: ${data.data.created}, Mis à jour: ${data.data.updated}, Ignorés: ${data.data.skipped}`;
        toast.success(message);
        setOpenImport(false);
        setFile(null);
        
        // Rafraîchir la liste
        await fetchData();
      } else {
        throw new Error(data.error || 'Erreur lors de l\'import');
      }
      
    } catch (error: any) {
      console.error('Error importing config:', error);
      setImportError(error.message);
      toast.error(error.message);
    } finally {
      setImportLoading(false);
    }
  };

  const getFlowBadge = (flow: 'INCOME' | 'EXPENSE') => {
    return flow === 'INCOME' ? (
      <Badge variant="default" className="bg-green-100 text-green-800">Recette</Badge>
    ) : (
      <Badge variant="default" className="bg-red-100 text-red-800">Dépense</Badge>
    );
  };

  const getStatusBadge = (active: boolean) => {
    return active ? (
      <Badge variant="default">Actif</Badge>
    ) : (
      <Badge variant="secondary">Inactif</Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Chargement des natures et catégories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Natures & Catégories</h1>
          <p className="text-gray-600 mt-1">
            Configurez les natures de transaction (recettes/dépenses), les catégories comptables associées et leur correspondance pour automatiser la saisie des transactions.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporter JSON
          </Button>
          <Button variant="outline" onClick={() => setOpenImport(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importer JSON
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle nature ou catégorie
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleCreate('nature')}>
                Nouvelle nature
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreate('category')}>
                Nouvelle catégorie
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                Gestion des natures et catégories
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
                Les natures définissent le type de mouvement (recette ou dépense). 
                Les catégories permettent le classement comptable ou analytique. 
                Utilisez le mapping pour lier les deux et définir les catégories compatibles et par défaut. 
                Exemple : "Recette Loyer" → type "LOYER" → catégorie par défaut "Loyer principal".
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
          <CardDescription>Recherchez et filtrez les natures et catégories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher une nature ou catégorie..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeInactive"
                checked={showInactive}
                onCheckedChange={(checked) => setShowInactive(checked as boolean)}
              />
              <label htmlFor="includeInactive" className="text-sm font-medium">
                Inclure inactifs
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tableau des Natures */}
      <Card>
        <CardHeader>
          <CardTitle>Natures</CardTitle>
          <CardDescription>Liste de toutes les natures configurées</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredNatures.length === 0 ? (
            <EmptyState
              title="Aucune nature"
              description={searchQuery ? "Aucune nature ne correspond à votre recherche" : "Commencez par créer votre première nature"}
              action={searchQuery ? undefined : (
                <Button onClick={() => handleCreate('nature')}>
                  Créer une nature
                </Button>
              )}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Code</TableHeaderCell>
                  <TableHeaderCell>Libellé</TableHeaderCell>
                  <TableHeaderCell>Flux</TableHeaderCell>
                  <TableHeaderCell>Catégories compatibles</TableHeaderCell>
                  <TableHeaderCell>Catégorie par défaut</TableHeaderCell>
                  <TableHeaderCell>Statut</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNatures.map((nature, index) => (
                  <TableRow key={`nature-${index}`}>
                    <TableCell>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {nature.key}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-gray-900">{nature.label}</div>
                    </TableCell>
                    <TableCell>
                      {getFlowBadge(nature.flow)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {nature.compatibleTypes.map(type => (
                          <Badge key={type} variant="secondary" className="text-xs">
                            {type} ✅
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {nature.defaultCategory ? (
                        <span className="text-sm text-gray-600">
                          {categories.find(c => c.id === nature.defaultCategory)?.label || 
                           categories.find(c => c.key === nature.defaultCategory)?.label || 
                           nature.defaultCategory}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Non défini</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(nature.active)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Tooltip content="Modifier">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(nature, 'nature')}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="Supprimer">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(nature, 'nature')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Tableau des Catégories */}
      <Card>
        <CardHeader>
          <CardTitle>Catégories</CardTitle>
          <CardDescription>Liste de toutes les catégories configurées</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCategories.length === 0 ? (
            <EmptyState
              title="Aucune catégorie"
              description={searchQuery ? "Aucune catégorie ne correspond à votre recherche" : "Commencez par créer votre première catégorie"}
              action={searchQuery ? undefined : (
                <Button onClick={() => handleCreate('category')}>
                  Créer une catégorie
                </Button>
              )}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Code</TableHeaderCell>
                  <TableHeaderCell>Libellé</TableHeaderCell>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Statut</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.map((category, index) => (
                  <TableRow key={`category-${index}`}>
                    <TableCell>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {category.key}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-gray-900">{category.label}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {category.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(category.active)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Tooltip content="Modifier">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(category, 'category')}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="Supprimer">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(category, 'category')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Diagramme des relations Nature ↔ Catégorie */}
      <Card>
        <CardHeader>
          <CardTitle>Relations Nature ↔ Catégorie</CardTitle>
          <CardDescription>Visualisation des correspondances entre natures et catégories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {natures.map((nature) => {
              const compatibleCategories = categories.filter(cat => 
                nature.compatibleTypes.includes(cat.type)
              );
              const defaultCategory = categories.find(cat => cat.id === nature.defaultCategory) || 
                                    categories.find(cat => cat.key === nature.defaultCategory);
              
              return (
                <div key={nature.key} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={nature.flow === 'INCOME' ? 'default' : 'destructive'} className="text-xs">
                        {nature.flow === 'INCOME' ? '⬆️' : '⬇️'} {nature.flow === 'INCOME' ? 'Recette' : 'Dépense'}
                      </Badge>
                      <span className="font-semibold text-gray-900">{nature.label}</span>
                      <code className="text-xs bg-gray-200 px-2 py-1 rounded">{nature.key}</code>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Catégories compatibles */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Catégories compatibles ({compatibleCategories.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {compatibleCategories.length > 0 ? (
                          compatibleCategories.map(category => (
                            <div key={category.key} className="flex items-center gap-1">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  (defaultCategory?.id === category.id || defaultCategory?.key === category.key)
                                    ? 'bg-blue-100 border-blue-300 text-blue-800' 
                                    : 'bg-gray-100'
                                }`}
                              >
                                {category.label}
                              </Badge>
                              {(defaultCategory?.id === category.id || defaultCategory?.key === category.key) && (
                                <span className="text-xs text-blue-600 font-medium">⭐</span>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">Aucune catégorie compatible</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Types autorisés */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Types autorisés ({nature.compatibleTypes.length})
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {nature.compatibleTypes.map(type => (
                          <Badge key={type} variant="secondary" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {defaultCategory && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Catégorie par défaut :</span>
                        <Badge variant="default" className="text-xs">
                          ⭐ {defaultCategory.label}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Résumé */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{natures.length}</div>
              <div>Natures configurées</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{categories.length}</div>
              <div>Catégories disponibles</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{mappings.length}</div>
              <div>Règles de correspondance</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog d'import */}
      <Dialog open={openImport} onOpenChange={(open) => {
        setOpenImport(open);
        if (!open) {
          setFile(null);
          setImportError(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importer la configuration</DialogTitle>
            <DialogDescription>
              Charge un JSON de natures, catégories et mappings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="file">Fichier JSON</Label>
              <Input 
                id="file" 
                type="file" 
                accept="application/json,.json"
                onChange={(e) => setFile(e.target.files?.[0] || null)} 
              />
            </div>
            
            <div>
              <Label htmlFor="importMode">Mode d'import</Label>
              <Select value={importMode} onValueChange={(value: 'overwrite' | 'merge') => setImportMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overwrite">Remplacer (overwrite)</SelectItem>
                  <SelectItem value="merge">Fusionner (merge)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {importError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Erreur</h3>
                    <div className="mt-2 text-sm text-red-700">
                      {importError}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenImport(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={!file || importLoading}
            >
              {importLoading ? "Import..." : "Importer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de formulaire */}
      <NatureCategoryFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        mode={formMode}
        item={selectedItem}
        categories={categories}
        onSave={handleSave}
      />

      {/* Modal d'aide/documentation */}
      <NaturesCategoriesHelpModal 
        isOpen={showHelpModal} 
        onClose={() => setShowHelpModal(false)} 
      />
    </div>
  );
}
