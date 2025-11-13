import React, { useState } from 'react';
import { Document, DocumentType } from '@/types/document';
import { Button } from '@/ui/shared/button';
import { Card, CardContent, CardHeader } from '@/ui/shared/card';
import { Badge } from '@/ui/shared/badge';
import { ChevronDown, ChevronRight, FileText, Download, Eye, Edit, Trash2 } from 'lucide-react';
import { getIcon } from '@/utils/icons';
import { useDeleteDocument } from '@/hooks/useDocuments';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/shared/dropdown-menu';

interface DocumentGroupedViewProps {
  documents: (Document & { documentType: DocumentType })[];
  documentTypes: DocumentType[];
  onEdit?: (document: Document) => void;
  onView?: (document: Document) => void;
  onReplace?: (document: Document) => void;
  onTypeChange?: (document: Document, newTypeId: string) => void;
  showActions?: boolean;
}

export function DocumentGroupedView({
  documents,
  documentTypes,
  onEdit,
  onView,
  onReplace,
  onTypeChange,
  showActions = true,
}: DocumentGroupedViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const deleteDocument = useDeleteDocument();

  // Grouper les documents par type
  const groupedDocuments = documents.reduce((groups, document) => {
    const typeId = document.DocumentType?.id || 'unknown';
    if (!groups[typeId]) {
      groups[typeId] = {
        type: document.DocumentType,
        documents: []
      };
    }
    groups[typeId].Document.push(document);
    return groups;
  }, {} as Record<string, { type: DocumentType; documents: (Document & { documentType: DocumentType })[] }>);

  const toggleGroup = (typeId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(typeId)) {
      newExpanded.delete(typeId);
    } else {
      newExpanded.add(typeId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleDownload = (document: Document) => {
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

  const handleDelete = async (document: Document) => {
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

  return (
    <div className="space-y-4">
      {Object.entries(groupedDocuments).map(([typeId, group]) => {
        const isExpanded = expandedGroups.has(typeId);
        const IconComponent = getIcon(group.type?.icon);
        
        return (
          <Card key={typeId} className="overflow-hidden">
            <CardHeader 
              className="cursor-pointer hover:bg-base-200 transition-colors"
              onClick={() => toggleGroup(typeId)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <IconComponent className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">
                      {group.type?.label || 'Type inconnu'}
                    </h3>
                    <p className="text-sm text-base-content opacity-70">
                      {group.Document.length} document{group.Document.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  {group.type?.isSystem && (
                    <Badge variant="outline" className="text-xs">
                      Système
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-sm">
                    {group.Document.length}
                  </Badge>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-base-content opacity-60" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-base-content opacity-60" />
                  )}
                </div>
              </div>
            </CardHeader>
            
            {isExpanded && (
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {group.Document.map((document) => (
                    <div
                      key={document.id}
                      className="flex items-center justify-between p-3 bg-base-200 rounded-lg hover:bg-base-200 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-base-content opacity-70 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-base-content truncate" title={document.fileName}>
                            {document.fileName}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-base-content opacity-70">
                            <span>{formatFileSize(document.size)}</span>
                            <span>•</span>
                            <span>{document.mime}</span>
                            <span>•</span>
                            <span>Ajouté le {formatDate(document.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {showActions && (
                        <div className="flex items-center gap-1">
                          {onView && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onView(document)}
                              title="Voir"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {onEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(document)}
                              title="Modifier"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(document)}
                            title="Télécharger"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" title="Plus d'actions">
                                <div className="h-4 w-4 flex items-center justify-center">
                                  <div className="w-1 h-1 bg-base-content/40 rounded-full"></div>
                                  <div className="w-1 h-1 bg-base-content/40 rounded-full ml-1"></div>
                                  <div className="w-1 h-1 bg-base-content/40 rounded-full ml-1"></div>
                                </div>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {onReplace && (
                                <DropdownMenuItem onClick={() => onReplace(document)}>
                                  Remplacer le fichier
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => handleDelete(document)}
                                className="text-error focus:text-error"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
