'use client';

import React, { useState } from 'react';
import {
  useAdminDocumentTypes,
  useCreateDocumentType,
  useUpdateDocumentType,
  useDeleteDocumentType,
  AdminDocumentType,
} from '@/hooks/useDocuments';
import { DocumentTypeEditDrawer } from '@/ui/admin/DocumentTypeEditDrawer';
import { Button } from '@/ui/shared/button';
import { Input } from '@/ui/shared/input';
import { Badge } from '@/ui/shared/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/shared/card';
import { Plus, Pencil, Trash2, Search, Shield, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import * as LucideIcons from 'lucide-react';

export default function AdminDocumentTypesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingDocumentType, setEditingDocumentType] = useState<AdminDocumentType | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  
  const { data: adminData, isLoading } = useAdminDocumentTypes({ includeInactive: true });
  const documentTypes = adminData?.items || [];
  const counts = adminData?.counts || {};
  
  const createMutation = useCreateDocumentType();
  const updateMutation = useUpdateDocumentType();
  const deleteMutation = useDeleteDocumentType();
  const { toast } = useToast();

  const filteredDocumentTypes = documentTypes.filter(dt =>
    dt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dt.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = () => {
    setEditingDocumentType(null);
    setIsCreateMode(true);
    setIsDrawerOpen(true);
  };

  const handleEdit = (documentType: AdminDocumentType) => {
    setEditingDocumentType(documentType);
    setIsCreateMode(false);
    setIsDrawerOpen(true);
  };

  const handleDelete = async (documentType: AdminDocumentType) => {
    if (documentType.isSystem) {
      toast({
        title: "Impossible de supprimer",
        description: "Les types système ne peuvent pas être supprimés.",
        variant: "destructive",
      });
      return;
    }

    if (counts[documentType.id] > 0) {
      toast({
        title: "Impossible de supprimer",
        description: `Ce type est utilisé par ${counts[documentType.id]} document(s).`,
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer le type "${documentType.label}" ?`)) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(documentType.id);
      toast({
        title: "Type supprimé",
        description: `Le type "${documentType.label}" a été supprimé.`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur de suppression",
        description: error.message || "Une erreur est survenue lors de la suppression.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async (data: any) => {
    if (isCreateMode) {
      await createMutation.mutateAsync(data);
    } else if (editingDocumentType) {
      await updateMutation.mutateAsync({
        id: editingDocumentType.id,
        data,
      });
    }
  };

  const getIconComponent = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName] || FileText;
    return IconComponent;
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Types de documents</h1>
        <p className="text-muted-foreground">
          Gérez les types de documents, leurs règles de suggestion et leurs configurations.
        </p>
      </div>

      {/* Barre de recherche et bouton d'ajout */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau type
        </Button>
      </div>

      {/* Liste des types de documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocumentTypes.map((documentType) => {
          const IconComponent = getIconComponent(documentType.icon || 'FileText');
          const documentsCount = counts[documentType.id] || 0;

          return (
            <Card key={documentType.id} className={cn(
              "transition-all hover:shadow-md",
              !documentType.isActive && "opacity-60"
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <IconComponent className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{documentType.label}</CardTitle>
                      <p className="text-sm text-muted-foreground font-mono">
                        {documentType.code}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    {documentType.isSystem && (
                      <Badge variant="secondary" className="text-xs">
                        <Shield className="mr-1 h-3 w-3" />
                        Système
                      </Badge>
                    )}
                    {documentType.isSensitive && (
                      <Badge variant="outline" className="text-xs">
                        Sensible
                      </Badge>
                    )}
                    {!documentType.isActive && (
                      <Badge variant="destructive" className="text-xs">
                        Inactif
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Documents:</span>
                    <span className="font-medium">{documentsCount}</span>
                  </div>

                  {documentType.defaultContexts.length > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Contextes:</span>
                      <div className="flex flex-wrap gap-1">
                        {documentType.defaultContexts.slice(0, 3).map(context => (
                          <Badge key={context} variant="outline" className="text-xs">
                            {context}
                          </Badge>
                        ))}
                        {documentType.defaultContexts.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{documentType.defaultContexts.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {documentType.suggestionConfig && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Règles:</span>
                      <span className="font-medium">
                        {documentType.suggestionConfig.rules?.length || 0}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(documentType)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!documentType.isSystem && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(documentType)}
                          disabled={documentsCount > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Ordre: {documentType.order}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredDocumentTypes.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-medium text-base-content">
            {searchTerm ? 'Aucun type trouvé' : 'Aucun type de document'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm 
              ? 'Essayez de modifier vos critères de recherche.'
              : 'Commencez par créer votre premier type de document.'
            }
          </p>
        </div>
      )}

      {/* Drawer d'édition */}
      <DocumentTypeEditDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        documentType={editingDocumentType || undefined}
        onSave={handleSave}
        availableTypes={documentTypes}
      />
    </div>
  );
}