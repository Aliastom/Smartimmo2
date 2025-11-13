'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  Download, 
  Upload,
  Search,
  Eye,
  Play,
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
import DocumentTypeFormModal from './DocumentTypeFormModal';
import { DocumentTypeHelpModal } from '@/components/admin/DocumentTypeHelpModal';
import DocumentTestModal from './DocumentTestModal';
import GlobalTestModal from './GlobalTestModal';

interface DocumentTypeWithCounts {
  id: string;
  code: string;
  label: string;
  description?: string;
  isActive: boolean;
  autoAssignThreshold?: number;
  keywordsCount: number;
  signalsCount: number;
  rulesCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function DocumentTypesAdminClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<DocumentTypeWithCounts | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [defaultTab, setDefaultTab] = useState<string>('keywords');
  
  // États pour l'import
  const [openImport, setOpenImport] = useState(false);
  const [mode, setMode] = useState<"overwrite" | "merge">("overwrite");
  const [file, setFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  
  // États pour le test global
  const [showGlobalTest, setShowGlobalTest] = useState(false);
  
  // État pour la modal d'aide
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Charger les types de documents
  const fetchDocumentTypes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/document-types?includeInactive=${showInactive}`);
      const data = await response.json();
      
      if (data.success) {
        setDocumentTypes(data.data);
      } else {
        toast.error('Erreur lors du chargement des types de documents');
      }
    } catch (error) {
      console.error('Error fetching document types:', error);
      toast.error('Erreur lors du chargement des types de documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentTypes();
  }, [showInactive]);

  // Filtrer les types selon la recherche
  const filteredTypes = documentTypes.filter(type =>
    type.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    type.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (type.description && type.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreate = () => {
    setSelectedType(null);
    setShowFormModal(true);
  };

  const handleEdit = (type: DocumentTypeWithCounts) => {
    setSelectedType(type);
    setShowFormModal(true);
  };

  const handleView = (type: DocumentTypeWithCounts) => {
    setSelectedType(type);
    setShowTestModal(true);
  };

  const handleOpenConfig = (type: DocumentTypeWithCounts, tab: 'keywords' | 'signals' | 'rules') => {
    setSelectedType(type);
    setDefaultTab(tab);
    setShowFormModal(true);
  };

  const handleDuplicate = async (type: DocumentTypeWithCounts) => {
    try {
      const response = await fetch('/api/admin/document-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: `${type.code}_COPY`,
          label: `${type.label} (Copie)`,
          description: type.description,
          isActive: false,
          autoAssignThreshold: type.autoAssignThreshold,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Type de document dupliqué avec succès');
        fetchDocumentTypes();
      } else {
        toast.error(data.error || 'Erreur lors de la duplication');
      }
    } catch (error) {
      console.error('Error duplicating document type:', error);
      toast.error('Erreur lors de la duplication');
    }
  };

  const handleDelete = async (type: DocumentTypeWithCounts) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le type "${type.label}" ?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/document-types/${type.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Type de document supprimé avec succès');
        fetchDocumentTypes();
      } else {
        toast.error(data.error || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error deleting document type:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/document-config/export');
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `document-types-config-${new Date().toISOString().split('T')[0]}.json`;
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

      // Valider le fichier
      const text = await file.text();
      
      let json;
      
      try {
        // Nettoyer le texte (supprimer les caractères BOM et espaces en début/fin)
        const cleanText = text.trim().replace(/^\uFEFF/, '');
        json = JSON.parse(cleanText);
      } catch (error: any) {
        setImportError(`Le fichier n'est pas un JSON valide: ${error.message}`);
        return;
      }

      // Valider la structure de base
      if (!json || typeof json !== 'object' || !json.types || !Array.isArray(json.types)) {
        setImportError('Format de configuration invalide. Le fichier doit contenir un objet avec une propriété "types" (tableau)');
        return;
      }

      if (json.version !== 1) {
        setImportError('Version non supportée. Le fichier doit avoir "version": 1');
        return;
      }

      // Appeler l'API d'import
      const response = await fetch('/api/admin/document-config/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json, mode }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur lors de l\'import' }));
        throw new Error(errorData.error || 'Erreur lors de l\'import');
      }

      const data = await response.json();
      
      if (data.success) {
        toast.success(`Import réussi — Créés: ${data.data.created}, Mis à jour: ${data.data.updated}, Ignorés: ${data.data.skipped}`);
        setOpenImport(false);
        setFile(null);
        
        // Rafraîchir la liste
        await fetchDocumentTypes();
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

  const handleSave = async (data: any) => {
    try {
      const url = selectedType 
        ? `/api/admin/document-types/${selectedType.id}`
        : '/api/admin/document-types';
      
      const method = selectedType ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (result.success) {
        toast.success(selectedType ? 'Type modifié avec succès' : 'Type créé avec succès');
        setShowFormModal(false);
        fetchDocumentTypes();
      } else {
        toast.error(result.error || 'Erreur lors de la sauvegarde');
      }
    } catch (error) {
      console.error('Error saving document type:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
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
          <p className="mt-2 text-gray-600">Chargement des types de documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Types de Documents</h1>
          <p className="text-gray-600 mt-1">Gérez la classification et l'extraction des documents</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowGlobalTest(true)}>
            <Play className="h-4 w-4 mr-2" />
            Test global
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporter tout
          </Button>
          <Button variant="outline" onClick={() => setOpenImport(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importer
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau type
          </Button>
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
                Gestion des types de documents
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
                Configure ici les types, mots-clés, signaux et règles d'extraction utilisés par la classification. 
                Tu peux créer/éditer des types, tester en live, et importer/exporter la configuration. 
                Les modifications sont prises en compte immédiatement par le moteur (avec cache invalidé).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
          <CardDescription>Recherchez et filtrez les types de documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher un type..."
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

      {/* Tableau */}
      <Card>
        <CardHeader>
          <CardTitle>Types de Documents</CardTitle>
          <CardDescription>Liste de tous les types configurés</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTypes.length === 0 ? (
            <EmptyState
              title="Aucun type de document"
              description={searchQuery ? "Aucun type ne correspond à votre recherche" : "Commencez par créer votre premier type de document"}
              action={searchQuery ? undefined : (
                <button
                  onClick={handleCreate}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Créer un type
                </button>
              )}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Code</TableHeaderCell>
                  <TableHeaderCell>Libellé</TableHeaderCell>
                  <TableHeaderCell>Statut</TableHeaderCell>
                  <TableHeaderCell>Seuil</TableHeaderCell>
                  <TableHeaderCell>Config</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {type.code}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md">
                        <div className="font-medium text-gray-900">{type.label}</div>
                        {type.description && (
                          <div 
                            className="text-sm text-gray-500 cursor-help whitespace-pre-wrap break-words"
                            title={type.description}
                          >
                            {type.description.length > 120 
                              ? type.description.substring(0, 120) + '...' 
                              : type.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(type.isActive)}
                    </TableCell>
                    <TableCell>
                      {type.autoAssignThreshold ? (
                        <span className="text-sm text-gray-600">
                          {(type.autoAssignThreshold * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Non défini</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 text-sm">
                        <Tooltip content={`${type.keywordsCount} mots-clés`}>
                          <button 
                            className="text-blue-600 hover:text-blue-800 underline"
                            onClick={() => handleOpenConfig(type, 'keywords')}
                          >
                            mots-clés
                          </button>
                        </Tooltip>
                        <span>•</span>
                        <Tooltip content={`${type.signalsCount} signaux`}>
                          <button 
                            className="text-blue-600 hover:text-blue-800 underline"
                            onClick={() => handleOpenConfig(type, 'signals')}
                          >
                            signaux
                          </button>
                        </Tooltip>
                        <span>•</span>
                        <Tooltip content={`${type.rulesCount} règles`}>
                          <button 
                            className="text-blue-600 hover:text-blue-800 underline"
                            onClick={() => handleOpenConfig(type, 'rules')}
                          >
                            règles
                          </button>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Tooltip content="Voir">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(type)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content="Modifier">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(type)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDuplicate(type)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Dupliquer
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(type)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modales */}
      <DocumentTypeFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        documentType={selectedType}
        onSave={handleSave}
        defaultTab={defaultTab}
      />

      <DocumentTestModal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        documentType={selectedType}
      />

      <GlobalTestModal
        isOpen={showGlobalTest}
        onClose={() => setShowGlobalTest(false)}
      />

      {/* Dialog d'import */}
      <Dialog open={openImport} onOpenChange={(open) => {
        setOpenImport(open);
        if (!open) {
          // Réinitialiser les états quand le dialog se ferme
          setFile(null);
          setImportError(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importer la configuration</DialogTitle>
            <DialogDescription>
              Charge un JSON de types/keywords/signaux/règles
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="mode">Mode d'import</Label>
              <Select value={mode} onValueChange={(value: "overwrite" | "merge") => setMode(value)}>
                <SelectTrigger id="mode">
                  <SelectValue placeholder="Sélectionner un mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overwrite">Remplacer (overwrite)</SelectItem>
                  <SelectItem value="merge">Fusionner (merge)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="file">Fichier JSON</Label>
              <Input 
                id="file" 
                type="file" 
                accept="application/json,.json"
                onChange={(e) => setFile(e.target.files?.[0] || null)} 
              />
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

      {/* Modal d'aide/documentation */}
      <DocumentTypeHelpModal 
        isOpen={showHelpModal} 
        onClose={() => setShowHelpModal(false)} 
      />
    </div>
  );
}