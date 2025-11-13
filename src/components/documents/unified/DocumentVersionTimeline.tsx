'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FileText, Download, Eye, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DocumentVersion {
  id: string;
  version: number;
  filenameOriginal: string;
  size: number;
  uploadedAt: Date | string;
  uploadedBy?: string;
  url?: string;
  status: string;
}

interface DocumentVersionTimelineProps {
  currentDocumentId: string;
  replacesDocumentId?: string;
}

export function DocumentVersionTimeline({
  currentDocumentId,
  replacesDocumentId,
}: DocumentVersionTimelineProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVersions();
  }, [currentDocumentId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      // Charger le document actuel et sa chaîne de versions
      const currentDoc = await fetch(`/api/documents/${currentDocumentId}`).then(r => r.json());
      
      const versionsList: DocumentVersion[] = [currentDoc];

      // Remonter la chaîne des versions précédentes
      let prevDocId = currentDoc.replacesDocumentId;
      while (prevDocId) {
        const prevDoc = await fetch(`/api/documents/${prevDocId}`).then(r => r.json());
        versionsList.unshift(prevDoc);
        prevDocId = prevDoc.replacesDocumentId;
      }

      setVersions(versionsList);
    } catch (error) {
      console.error('Error loading versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
        <p className="text-gray-500 mt-4">Chargement des versions...</p>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Aucune version trouvée</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-4">
        {versions.length} version{versions.length > 1 ? 's' : ''} au total
      </div>

      <div className="space-y-3">
        {versions.map((version, index) => {
          const isLatest = index === versions.length - 1;
          const isArchived = version.status === 'archived';

          return (
            <div
              key={version.id}
              className={`
                relative border rounded-lg p-4 transition-colors
                ${isLatest ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'}
                ${isArchived ? 'opacity-60' : ''}
              `}
            >
              {/* Timeline connector */}
              {index < versions.length - 1 && (
                <div className="absolute left-6 top-full w-0.5 h-3 bg-gray-300" />
              )}

              <div className="flex items-start gap-4">
                {/* Version badge */}
                <div className="flex-shrink-0">
                  <Badge
                    variant={isLatest ? 'default' : 'secondary'}
                    className="text-sm font-mono"
                  >
                    v{version.version}
                  </Badge>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900 truncate">
                      {version.filenameOriginal}
                    </span>
                    {isLatest && (
                      <Badge variant="success" className="text-xs">
                        Actuelle
                      </Badge>
                    )}
                    {isArchived && (
                      <Badge variant="secondary" className="text-xs">
                        Archivée
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                    <span>{formatFileSize(version.size)}</span>
                    <span>•</span>
                    <span>
                      {format(new Date(version.uploadedAt), 'dd MMM yyyy à HH:mm', {
                        locale: fr,
                      })}
                    </span>
                    {version.uploadedBy && (
                      <>
                        <span>•</span>
                        <span>par {version.uploadedBy}</span>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  {version.url && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(version.url, '_blank')}
                      >
                        <Eye className="h-3 w-3 mr-2" />
                        Voir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = version.url!;
                          link.download = version.filenameOriginal;
                          link.click();
                        }}
                      >
                        <Download className="h-3 w-3 mr-2" />
                        Télécharger
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

