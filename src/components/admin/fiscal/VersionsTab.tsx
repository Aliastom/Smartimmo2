/**
 * Onglet "Versions" - Gestion des versions fiscales
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
import {
  CheckCircle,
  Archive,
  Undo2,
  Trash2,
  Loader2,
  FileText,
  Edit,
  GitCompare,
  Download,
} from 'lucide-react';
import { EditVersionParamsModal } from './EditVersionParamsModal';
import { CreateVersionModal } from './CreateVersionModal';
import { JsonDiffViewer } from './JsonDiffViewer';

interface VersionsTabProps {
  autoCompareCode?: string | null;
  onCompareComplete?: () => void;
  onCreateVersion?: () => void;
  onCompareVersions?: () => void;
  onOpenfiscaHealth?: () => void;
  createVersionOpen?: boolean;
  compareVersionsOpen?: boolean;
  openfiscaHealthOpen?: boolean;
  onCreateVersionClose?: () => void;
  onCompareVersionsClose?: () => void;
}

export function VersionsTab({ 
  autoCompareCode, 
  onCompareComplete,
  onCreateVersion,
  onCompareVersions,
  onOpenfiscaHealth,
  createVersionOpen: externalCreateVersionOpen,
  compareVersionsOpen: externalCompareVersionsOpen,
  openfiscaHealthOpen,
  onCreateVersionClose,
  onCompareVersionsClose
}: VersionsTabProps = {}) {
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [editParamsOpen, setEditParamsOpen] = useState(false);
  const [diffViewerOpen, setDiffViewerOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [diffFromVersion, setDiffFromVersion] = useState<string>('');
  const [diffToVersion, setDiffToVersion] = useState<string>('');
  
  // Utiliser les états externes ou internes
  const createVersionOpen = externalCreateVersionOpen ?? false;
  const compareVersionsOpen = externalCompareVersionsOpen ?? false;

  useEffect(() => {
    loadVersions();
  }, []);
  
  // Ouvrir automatiquement le comparateur si autoCompareCode est défini
  useEffect(() => {
    if (autoCompareCode && versions.length > 0) {
      // Trouver la version draft à comparer
      const draftVersion = versions.find(v => v.code === autoCompareCode);
      
      if (draftVersion) {
        // Trouver la version publiée pour comparer
        const publishedVersion = versions.find(v => v.status === 'published' && v.year === draftVersion.year);
        
        if (publishedVersion) {
          setDiffFromVersion(publishedVersion.id);
          setDiffToVersion(draftVersion.id);
          setDiffViewerOpen(true);
          
          // Notifier qu'on a terminé
          if (onCompareComplete) {
            onCompareComplete();
          }
        }
      }
    }
  }, [autoCompareCode, versions]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tax/versions');
      if (response.ok) {
        const data = await response.json();
        setVersions(data);
      }
    } catch (error) {
      console.error('Erreur chargement versions:', error);
    } finally {
      setLoading(false);
    }
  };


  const handlePublish = async (versionId: string) => {
    const validatedBy = prompt('Votre nom (validation) :');
    if (!validatedBy) return;

    try {
      const response = await fetch(`/api/admin/tax/versions/${versionId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validatedBy }),
      });

      if (response.ok) {
        alert('✅ Version publiée avec succès');
        await loadVersions();
      } else {
        alert('❌ Erreur lors de la publication');
      }
    } catch (error) {
      console.error('Erreur publish:', error);
      alert('❌ Erreur lors de la publication');
    }
  };

  const handleArchive = async (versionId: string) => {
    if (!confirm('Archiver cette version ?')) return;

    try {
      const response = await fetch(`/api/admin/tax/versions/${versionId}/archive`, {
        method: 'POST',
      });

      if (response.ok) {
        alert('✅ Version archivée');
        await loadVersions();
      } else {
        alert('❌ Erreur lors de l\'archivage');
      }
    } catch (error) {
      console.error('Erreur archive:', error);
      alert('❌ Erreur lors de l\'archivage');
    }
  };

  const handleRollback = async (versionId: string) => {
    const validatedBy = prompt('Votre nom (validation rollback) :');
    if (!validatedBy) return;

    try {
      const response = await fetch(`/api/admin/tax/versions/${versionId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validatedBy }),
      });

      if (response.ok) {
        alert('✅ Version restaurée');
        await loadVersions();
      } else {
        alert('❌ Erreur lors du rollback');
      }
    } catch (error) {
      console.error('Erreur rollback:', error);
      alert('❌ Erreur lors du rollback');
    }
  };

  const handleDelete = async (versionId: string, versionCode: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la version "${versionCode}" ?\n\nCette action est irréversible.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/tax/versions/${versionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('✅ Version supprimée avec succès');
        await loadVersions();
      } else {
        const errorData = await response.json();
        alert(`❌ Erreur lors de la suppression: ${errorData.error || 'Erreur inconnue'}`);
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('❌ Erreur lors de la suppression');
    }
  };

  const handleViewDiff = () => {
    if (versions.length < 2) {
      alert('⚠️ Il faut au moins 2 versions pour comparer');
      return;
    }

    // Prendre les 2 dernières versions par défaut
    const sortedVersions = [...versions].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    setDiffFromVersion(sortedVersions[1]?.id || versions[0].id);
    setDiffToVersion(sortedVersions[0]?.id || versions[versions.length - 1].id);
    setDiffViewerOpen(true);
  };

  const handleExportVersion = async (versionCode: string) => {
    try {
      const response = await fetch(`/api/admin/tax/export?version=${versionCode}&includeRefs=true`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smartimmo-tax-${versionCode}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        alert('✅ Export réussi');
      } else {
        const error = await response.json();
        alert(`❌ Erreur: ${error.error}`);
      }
    } catch (error) {
      console.error('Erreur export:', error);
      alert('❌ Erreur lors de l\'export');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <Badge variant="success">
            <CheckCircle className="mr-1 h-3 w-3" />
            Publié
          </Badge>
        );
      case 'draft':
        return <Badge variant="secondary">Brouillon</Badge>;
      case 'archived':
        return <Badge variant="outline">Archivé</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">

      {/* Table des barèmes */}
      <Card>
        <CardHeader>
          <CardTitle>Barèmes fiscaux</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-center py-8">Chargement...</div>}

          {!loading && versions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Aucune version disponible. Utilisez le bouton "Mettre à jour depuis sources" en haut de la page pour créer la première version.
            </div>
          )}

          {!loading && versions.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Code</TableHeaderCell>
                  <TableHeaderCell>Année</TableHeaderCell>
                  <TableHeaderCell>Source</TableHeaderCell>
                  <TableHeaderCell>Statut</TableHeaderCell>
                  <TableHeaderCell>Validé par</TableHeaderCell>
                  <TableHeaderCell>Date MAJ</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="font-medium">{version.code}</TableCell>
                    <TableCell>{version.year}</TableCell>
                    <TableCell className="text-sm text-gray-600">{version.source}</TableCell>
                    <TableCell>{getStatusBadge(version.status)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{version.validatedBy || '-'}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(version.updatedAt).toLocaleString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {version.status === 'draft' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePublish(version.id)}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Publier
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(version.id, version.code)}
                              className="text-red-600 hover:text-red-700 hover:border-red-300"
                              title="Supprimer ce brouillon"
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              Supprimer
                            </Button>
                          </>
                        )}

                        {version.status === 'published' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleArchive(version.id)}
                          >
                            <Archive className="mr-1 h-3 w-3" />
                            Archiver
                          </Button>
                        )}

                        {version.status === 'archived' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRollback(version.id)}
                          >
                            <Undo2 className="mr-1 h-3 w-3" />
                            Restaurer
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedVersion(version);
                            setEditParamsOpen(true);
                          }}
                          title="Éditer les paramètres fiscaux"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleExportVersion(version.code)}
                          title="Exporter en JSON"
                        >
                          <Download className="h-3 w-3" />
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

      {/* Modal d'édition des paramètres */}
      {selectedVersion && (
        <EditVersionParamsModal
          open={editParamsOpen}
          onClose={() => {
            setEditParamsOpen(false);
            setSelectedVersion(null);
          }}
          onSuccess={loadVersions}
          version={selectedVersion}
        />
      )}

      {/* Modal de création de version */}
      <CreateVersionModal
        open={createVersionOpen}
        onClose={() => {
          if (onCreateVersionClose) {
            onCreateVersionClose();
          }
        }}
        onSuccess={loadVersions}
        versions={versions}
      />

      {/* Diff Viewer */}
      {diffFromVersion && diffToVersion && (
        <JsonDiffViewer
          open={diffViewerOpen}
          onClose={() => setDiffViewerOpen(false)}
          fromVersionId={diffFromVersion}
          toVersionId={diffToVersion}
        />
      )}
    </div>
  );
}

