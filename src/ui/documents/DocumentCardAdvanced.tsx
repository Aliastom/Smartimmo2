import React, { useState } from 'react';
import { Document, DocumentType } from '@/types/document';
import { DocumentTypeBadge } from '@/ui/shared/DocumentTypeSelect';
import { Button } from '@/ui/shared/button';
import { Card, CardContent, CardHeader } from '@/ui/shared/card';
import { Badge } from '@/ui/shared/badge';
import { 
  Download, 
  Eye, 
  Edit, 
  Trash2, 
  Calendar,
  User,
  Building,
  FileText,
  MoreVertical,
  RefreshCw,
  Type
} from 'lucide-react';
import { useDeleteDocument, useChangeDocumentType } from '@/hooks/useDocuments';
import { useToast } from '@/hooks/use-toast';

interface DocumentCardAdvancedProps {
  document: Document & { documentType: DocumentType };
  documentTypes: DocumentType[];
  onEdit?: (document: Document) => void;
  onView?: (document: Document) => void;
  onReplace?: (document: Document) => void;
  onTypeChange?: (document: Document, newTypeId: string) => void;
  showActions?: boolean;
}

export function DocumentCardAdvanced({
  document,
  documentTypes,
  onEdit,
  onView,
  onReplace,
  onTypeChange,
  showActions = true,
}: DocumentCardAdvancedProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { toast } = useToast();
  const deleteDocument = useDeleteDocument();
  const changeDocumentType = useChangeDocumentType();

  const handleDownload = () => {
    // Vérifier que nous sommes côté client
    if (typeof window === 'undefined') {
      toast({
        title: "Erreur",
        description: "Téléchargement non disponible côté serveur",
        variant: "destructive",
      });
      return;
    }

    try {
      // Méthode 1: Essayer d'ouvrir dans un nouvel onglet (téléchargement automatique)
      window.open(document.url, '_blank');
      
      // Méthode 2: Alternative avec fetch et blob (si nécessaire)
      // Cette méthode est commentée car elle peut causer des problèmes SSR
      /*
      fetch(document.url)
        .then(response => response.blob())
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');
          window.URL.revokeObjectURL(url);
        })
        .catch(error => {
          console.error('Download error:', error);
          // Fallback: ouvrir directement l'URL
          window.open(document.url, '_blank');
        });
      */
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Erreur",
        description: "Impossible de télécharger le fichier",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    // Vérifier que nous sommes côté client
    if (typeof window === 'undefined') return;
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      try {
        await deleteDocument.mutateAsync(document.id);
        toast({
          title: "Succès",
          description: "Document supprimé avec succès",
        });
      } catch (error) {
        console.error('Delete error:', error);
        toast({
          title: "Erreur",
          description: "Impossible de supprimer le document",
          variant: "destructive",
        });
      }
    }
  };

  const handleTypeChange = async (newTypeId: string) => {
    try {
      await changeDocumentType.mutateAsync({
        documentId: document.id,
        documentTypeId: newTypeId,
      });
      setShowMenu(false);
    } catch (error) {
      // L'erreur est déjà gérée par le hook avec toast
      console.error('Error changing document type:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getContextInfo = () => {
    const contexts = [];
    
    if (document.Property?.name) {
      contexts.push({
        icon: Building,
        label: document.Property.name,
        type: 'property',
      });
    }
    
    if (document.lease?.Tenant) {
      const tenant = document.lease.Tenant;
      contexts.push({
        icon: User,
        label: `${tenant.firstName} ${tenant.lastName}`,
        type: 'tenant',
      });
    }
    
    if (document.transaction?.label) {
      contexts.push({
        icon: FileText,
        label: document.transaction.label,
        type: 'transaction',
      });
    }
    
    if (document.loan?.bankName) {
      contexts.push({
        icon: Building,
        label: document.Loan.bankName,
        type: 'loan',
      });
    }
    
    return contexts;
  };

  const contexts = getContextInfo();

  return (
    <Card className="h-full group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate" title={document.fileName}>
              {document.fileName}
            </h3>
            <div className="mt-1">
              <DocumentTypeBadge documentType={document.DocumentType} />
            </div>
          </div>
          {showActions && (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMenu(!showMenu)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
              
              {showMenu && (
                <div className="absolute right-0 top-8 z-10 bg-base-100 border rounded-md shadow-lg py-1 min-w-[160px]">
                  {onView && (
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-base-200 flex items-center gap-2"
                      onClick={() => {
                        onView(document);
                        setShowMenu(false);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      Voir
                    </button>
                  )}
                  
                  <button
                    className="w-full px-3 py-2 text-left text-sm hover:bg-base-200 flex items-center gap-2"
                    onClick={() => {
                      handleDownload();
                      setShowMenu(false);
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Télécharger
                  </button>
                  
                  {onReplace && (
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-base-200 flex items-center gap-2"
                      onClick={() => {
                        onReplace(document);
                        setShowMenu(false);
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Remplacer
                    </button>
                  )}
                  
                  {onTypeChange && (
                    <div className="px-3 py-2">
                      <div className="text-xs font-medium text-base-content opacity-70 mb-1">Changer le type:</div>
                      {documentTypes.map((type) => (
                        <button
                          key={type.id}
                          className="w-full text-left text-xs hover:bg-base-200 px-2 py-1 rounded flex items-center gap-2"
                          onClick={() => {
                            handleTypeChange(type.id);
                            setShowMenu(false);
                          }}
                        >
                          <Type className="h-3 w-3" />
                          {type.label}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {onEdit && (
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-base-200 flex items-center gap-2"
                      onClick={() => {
                        onEdit(document);
                        setShowMenu(false);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                      Renommer
                    </button>
                  )}
                  
                  <hr className="my-1" />
                  
                  <button
                    className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-error flex items-center gap-2"
                    onClick={() => {
                      handleDelete();
                      setShowMenu(false);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-2">
          {/* Informations du fichier */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatFileSize(document.size)}</span>
            <span>{document.mime}</span>
          </div>
          
          {/* Date de création */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(document.createdAt)}</span>
          </div>
          
          {/* Contexte */}
          {contexts.length > 0 && (
            <div className="space-y-1">
              {contexts.map((context, index) => {
                const IconComponent = context.icon;
                return (
                  <div key={index} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <IconComponent className="h-3 w-3" />
                    <span className="truncate" title={context.label}>
                      {context.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Métadonnées */}
          {document.metadata && (
            <div className="text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs">
                Métadonnées
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
