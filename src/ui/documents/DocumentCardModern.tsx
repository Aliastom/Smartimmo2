import React, { useState } from 'react';
import { Document, DocumentType } from '@/types/document';
import { Button } from '@/ui/shared/button';
import { Card, CardContent } from '@/ui/shared/card';
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
  RefreshCw
} from 'lucide-react';
import { useDeleteDocument, useChangeDocumentType } from '@/hooks/useDocuments';
import { useToast } from '@/hooks/use-toast';
import { getIcon } from '@/utils/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/shared/dropdown-menu';

interface DocumentCardModernProps {
  document: Document & { documentType: DocumentType };
  documentTypes: DocumentType[];
  onEdit?: (document: Document) => void;
  onView?: (document: Document) => void;
  onReplace?: (document: Document) => void;
  onTypeChange?: (document: Document, newTypeId: string) => void;
  showActions?: boolean;
}

export function DocumentCardModern({
  document,
  documentTypes,
  onEdit,
  onView,
  onReplace,
  onTypeChange,
  showActions = true,
}: DocumentCardModernProps) {
  const [isChangingType, setIsChangingType] = useState(false);
  const { toast } = useToast();
  const deleteDocument = useDeleteDocument();
  const changeDocumentType = useChangeDocumentType();

  const handleDownload = () => {
    if (typeof window === 'undefined') return;
    
    try {
      const link = document.createElement('a');
      link.href = document.url;
      link.download = document.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Erreur de téléchargement",
        description: "Impossible de télécharger le fichier",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;
    
    try {
      await deleteDocument.mutateAsync(document.id);
      toast({
        title: "Document supprimé",
        description: `${document.fileName} a été supprimé avec succès`,
      });
    } catch (error) {
      toast({
        title: "Erreur de suppression",
        description: "Impossible de supprimer le document",
        variant: "destructive",
      });
    }
  };

  const handleTypeChange = async (newTypeId: string) => {
    if (newTypeId === document.documentTypeId) return;
    
    setIsChangingType(true);
    try {
      await changeDocumentType.mutateAsync({
        documentId: document.id,
        documentTypeId: newTypeId,
      });
      
      const newType = documentTypes.find(t => t.id === newTypeId);
      toast({
        title: "Type mis à jour",
        description: `Le type a été changé en "${newType?.label || 'Inconnu'}"`,
      });
      
      if (onTypeChange) {
        onTypeChange(document, newTypeId);
      }
    } catch (error) {
      toast({
        title: "Erreur de mise à jour",
        description: "Impossible de changer le type du document",
        variant: "destructive",
      });
    } finally {
      setIsChangingType(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getContextInfo = () => {
    const contexts = [];
    
    if (document.Property) {
      contexts.push({
        icon: Building,
        label: document.Property.name,
        type: 'Propriété'
      });
    }
    
    if (document.lease?.Tenant) {
      const tenant = document.lease.Tenant;
      contexts.push({
        icon: User,
        label: `${tenant.firstName} ${tenant.lastName}`,
        type: 'Locataire'
      });
    }
    
    if (document.Loan) {
      contexts.push({
        icon: Building,
        label: document.Loan.bankName || 'Prêt',
        type: 'Prêt'
      });
    }

    return contexts;
  };

  const contexts = getContextInfo();
  const IconComponent = getIcon(document.DocumentType?.icon);

  return (
    <Card className="h-full card-interactive">
      <CardContent className="p-4">
        {/* En-tête avec icône du type et menu */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <IconComponent className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-base-content truncate" title={document.fileName}>
                {document.fileName}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {document.DocumentType?.label || 'Type inconnu'}
                </Badge>
                {document.DocumentType?.isSystem && (
                  <Badge variant="outline" className="text-xs">
                    Système
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover-pop press">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onView && (
                  <DropdownMenuItem onClick={() => onView(document)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Voir
                  </DropdownMenuItem>
                )}
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(document)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Modifier
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger
                </DropdownMenuItem>
                {onReplace && (
                  <DropdownMenuItem onClick={() => onReplace(document)}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Remplacer
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={handleDelete}
                  className="text-error focus:text-error"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Métadonnées du fichier */}
        <div className="space-y-2 text-xs text-base-content opacity-70 mb-3">
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            <span>{formatFileSize(document.size)} • {document.mime}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>Ajouté le {formatDate(document.createdAt)}</span>
          </div>
        </div>

        {/* Contexte (propriété, locataire, etc.) */}
        {contexts.length > 0 && (
          <div className="space-y-1">
            {contexts.map((context, index) => {
              const ContextIcon = context.icon;
              return (
                <div key={index} className="flex items-center gap-2 text-xs text-base-content opacity-80">
                  <ContextIcon className="h-3 w-3" />
                  <span className="truncate">{context.label}</span>
                  <Badge variant="outline" className="text-xs ml-auto">
                    {context.type}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}

        {/* Actions rapides en bas */}
        {showActions && (
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-base-300">
            <div className="flex gap-1">
              {onView && (
                <Button variant="ghost" size="sm" onClick={() => onView(document)}>
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Changement de type rapide */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={isChangingType}
                  className="text-xs"
                >
                  {isChangingType ? (
                    <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <IconComponent className="h-3 w-3 mr-1" />
                  )}
                  {isChangingType ? 'Changement...' : 'Type'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {documentTypes.map((type) => (
                  <DropdownMenuItem
                    key={type.id}
                    onClick={() => handleTypeChange(type.id)}
                    className={type.id === document.documentTypeId ? 'bg-blue-50' : ''}
                  >
                    <div className="flex items-center gap-2">
                      {React.createElement(getIcon(type.icon), { className: "h-4 w-4" })}
                      <span>{type.label}</span>
                      {type.id === document.documentTypeId && (
                        <Badge variant="outline" className="text-xs ml-auto">
                          Actuel
                        </Badge>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
