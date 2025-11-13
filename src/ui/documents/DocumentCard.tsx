import React from 'react';
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
  FileText
} from 'lucide-react';
import { useDeleteDocument } from '@/hooks/useDocuments';
import { useToast } from '@/hooks/use-toast';

interface DocumentCardProps {
  document: Document & { documentType: DocumentType };
  onEdit?: (document: Document) => void;
  onView?: (document: Document) => void;
  showActions?: boolean;
}

export function DocumentCard({
  document,
  onEdit,
  onView,
  showActions = true,
}: DocumentCardProps) {
  const { toast } = useToast();
  const deleteDocument = useDeleteDocument();

  const handleDownload = async () => {
    try {
      const response = await fetch(document.url);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
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
    <Card className="h-full">
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
            <div className="flex gap-1 ml-2">
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
                onClick={handleDownload}
                title="Télécharger"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                title="Supprimer"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
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
