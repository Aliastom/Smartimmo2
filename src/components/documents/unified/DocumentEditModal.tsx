'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { RefreshCw, FileText, Edit, CheckCircle, AlertCircle, Link } from 'lucide-react';
import { DocumentTableRow } from './DocumentTable';
import { Badge } from '@/components/ui/Badge';
import { DocumentLinkSelector } from './DocumentLinkSelector';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { createDocumentServiceWithMode } from '@/domain/services/documentServiceFactory';
import { getGlobalSyncService } from '@/lib/offline/syncGlobal';
import { SmartSelect, SmartSelectOption } from '@/components/ui/SmartSelect';

interface DocumentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentTableRow & {
    extractedText?: string;
    documentType?: {
      id: string;
      label: string;
      code: string;
    };
    typeAlternatives?: string; // JSON string of predictions
  };
  onUpdate?: () => void;
  mode?: 'normal' | 'app-shell'; // Mode pour déterminer si utiliser DocumentService ou API directe
  organizationId?: string; // Nécessaire en mode app-shell pour DocumentService
}

export function DocumentEditModal({ isOpen, onClose, document, onUpdate, mode = 'normal', organizationId: organizationIdProp }: DocumentEditModalProps) {
  // ⚠️ Récupérer organizationId depuis le hook si non fourni en prop
  const { organizationId: organizationIdFromHook } = useCurrentOrganization();
  const organizationId = organizationIdProp || organizationIdFromHook || '';
  
  const [activeTab, setActiveTab] = useState('rename');
  const [newFilename, setNewFilename] = useState(document.filenameOriginal);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [predictions, setPredictions] = useState<Array<{ typeCode: string; label: string; score: number; threshold: number }>>([]);
  const [selectedPredictionType, setSelectedPredictionType] = useState<string | null>(document.DocumentType?.code || null);
  const [documentTypes, setDocumentTypes] = useState<Array<{ code: string, label: string }>>([]);
  const [isLinking, setIsLinking] = useState(false);
  const [currentLinks, setCurrentLinks] = useState<Array<{ id?: string; entityType: string; entityId?: string; entityName?: string }>>([]);

  useEffect(() => {
    if (isOpen) {
      setNewFilename(document.filenameOriginal);
      setActiveTab('rename');
      setSelectedPredictionType(document.DocumentType?.code || null);
      // Load predictions if available
      if (document.typeAlternatives) {
        try {
          const parsedPredictions = JSON.parse(document.typeAlternatives);
          setPredictions(parsedPredictions);
        } catch (e) {
          console.error("Error parsing typeAlternatives:", e);
          setPredictions([]);
        }
      } else {
        setPredictions([]);
      }
    }
  }, [isOpen, document]);

  // Load all document types for the select dropdown
  useEffect(() => {
    const loadDocumentTypes = async () => {
      try {
        if (mode === 'app-shell' && organizationId) {
          // ⚠️ En app-shell : charger depuis IndexedDB
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          const types = await db.DocumentType
            .filter((t: any) => t.isActive !== false)
            .toArray();
          setDocumentTypes(types.map((t: any) => ({
            code: t.code,
            label: t.label,
          })));
        } else {
          // Mode normal : utiliser l'API
          const response = await fetch('/api/admin/document-types?includeInactive=false');
          const data = await response.json();
          if (data.success) {
            setDocumentTypes(data.data.map((t: any) => ({
              code: t.code,
              label: t.label
            })));
          }
        }
      } catch (error) {
        console.error('Error loading document types:', error);
      }
    };
    
    loadDocumentTypes();
  }, [mode, organizationId]);

  // Load current document links
  useEffect(() => {
    if (isOpen && document.id) {
      loadDocumentLinks();
    }
  }, [isOpen, document.id]);

  const loadDocumentLinks = async () => {
    try {
      // ⚠️ En mode app-shell : lire depuis IndexedDB via DocumentService
      if (mode === 'app-shell' && organizationId) {
        const documentService = createDocumentServiceWithMode('app-shell');
        const links = await documentService.deps.documentLinkRepo.findMany({
          documentId: document.id,
        });
        // Convertir vers le format attendu par l'UI
        // Note: En IndexedDB, DocumentLink n'a pas d'ID unique (clé composite)
        // On génère un ID composite pour l'UI
        setCurrentLinks(links.map(link => ({
          id: `${link.documentId}-${link.linkedType}-${link.linkedId}`, // ID composite pour l'UI
          entityType: link.linkedType,
          entityId: link.linkedId,
          entityName: link.entityName || undefined,
        })));
      } else {
        // Mode normal : utiliser l'API
        const response = await fetch(`/api/documents/${document.id}/links`);
        const result = await response.json();
        if (result.success && result.data) {
          setCurrentLinks(result.data);
        }
      }
    } catch (error) {
      console.error('Error loading document links:', error);
    }
  };

  const handleSaveRename = async () => {
    if (!organizationId) {
      alert('Erreur: OrganizationId manquant');
      return;
    }

    setIsSaving(true);
    try {
      // ⚠️ Utiliser DocumentService en mode app-shell
      if (mode === 'app-shell') {
        const documentService = createDocumentServiceWithMode('app-shell');
        await documentService.updateDocument(document.id, organizationId, {
          filenameOriginal: newFilename,
        });

        // ⚠️ En app-shell online : push → pull → refresh
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        if (isOnline) {
          try {
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(organizationId);
            await syncService.syncEntityFromRemoteByName('document', organizationId);
            window.dispatchEvent(new CustomEvent('sync:refresh'));
          } catch (syncError) {
            console.warn('[DocumentEditModal] Erreur sync après renommage:', syncError);
          }
        }

        alert('✅ Nom du document mis à jour avec succès');
        onUpdate?.();
        onClose();
      } else {
        // Mode normal : utiliser l'API
        const response = await fetch(`/api/documents/${document.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenameOriginal: newFilename }),
        });
        const result = await response.json();
        if (result.success) {
          alert('✅ Nom du document mis à jour avec succès');
          onUpdate?.();
          onClose();
        } else {
          alert(`Erreur: ${result.error || 'Erreur lors de la mise à jour du nom'}`);
        }
      }
    } catch (error: any) {
      console.error('Error renaming document:', error);
      alert(error.message || 'Erreur lors du renommage du document');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyzeClassification = async (forceReanalysis: boolean = false) => {
    setIsAnalyzing(true);
    setPredictions([]); // Clear previous predictions
    try {
      const response = await fetch(`/api/documents/${document.id}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReanalysis })
      });
      const result = await response.json();
      if (result.success && result.data && result.data.predictions) {
        setPredictions(result.data.predictions);
        if (result.data.autoAssigned && result.data.assignedTypeCode) {
          setSelectedPredictionType(result.data.assignedTypeCode);
        } else if (result.data.predictions.length > 0) {
          // If no auto-assign, but predictions exist, select the top one if it meets its threshold
          const bestPrediction = result.data.predictions[0];
          const threshold = bestPrediction.threshold || 0.85;
          if (bestPrediction.score >= threshold) {
            setSelectedPredictionType(bestPrediction.typeCode);
          }
        }
        alert('✅ Analyse de classification relancée avec succès');
      } else {
        alert(`Aucune prédiction disponible pour ce document`);
      }
    } catch (error) {
      console.error('Error reclassifying document:', error);
      alert('Erreur lors de la relance de l\'analyse');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveReclassify = async () => {
    if (!selectedPredictionType || !organizationId) {
      if (!selectedPredictionType) {
        alert('Veuillez sélectionner un type de document.');
      } else {
        alert('Erreur: OrganizationId manquant');
      }
      return;
    }

    setIsSaving(true);
    try {
      // ⚠️ Utiliser DocumentService en mode app-shell
      if (mode === 'app-shell') {
        const documentService = createDocumentServiceWithMode('app-shell');
        await documentService.updateDocument(document.id, organizationId, {
          documentTypeId: selectedPredictionType,
        });

        // ⚠️ En app-shell online : push → pull → refresh
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        if (isOnline) {
          try {
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(organizationId);
            await syncService.syncEntityFromRemoteByName('document', organizationId);
            window.dispatchEvent(new CustomEvent('sync:refresh'));
          } catch (syncError) {
            console.warn('[DocumentEditModal] Erreur sync après reclassification:', syncError);
          }
        }

        alert('✅ Type de document mis à jour avec succès');
        onUpdate?.();
        onClose();
      } else {
        // Mode normal : utiliser l'API
        const response = await fetch(`/api/documents/${document.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chosenTypeId: selectedPredictionType }),
        });
        const result = await response.json();
        if (result.success) {
          alert('✅ Type de document mis à jour avec succès');
          onUpdate?.();
          onClose();
        } else {
          alert(`Erreur: ${result.error || 'Erreur lors de la mise à jour du type'}`);
        }
      }
    } catch (error: any) {
      console.error('Error updating document type:', error);
      alert(error.message || 'Erreur lors de la mise à jour du type de document');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLinkDocument = async (linkedTo: 'global' | 'property' | 'lease' | 'transaction' | 'loan' | 'tenant', linkedId?: string) => {
    if (!organizationId) {
      alert('Erreur: OrganizationId manquant');
      return;
    }

    setIsLinking(true);
    try {
      // ⚠️ Utiliser DocumentService en mode app-shell
      if (mode === 'app-shell') {
        const documentService = createDocumentServiceWithMode('app-shell');
        await documentService.linkDocument(
          {
            documentId: document.id,
            linkedType: linkedTo,
            linkedId: linkedTo === 'global' ? null : linkedId || null,
          },
          organizationId
        );

        // ⚠️ En app-shell online : push → pull → refresh
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        if (isOnline) {
          try {
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(organizationId);
            await syncService.syncEntityFromRemoteByName('documentLink', organizationId);
            window.dispatchEvent(new CustomEvent('sync:refresh'));
          } catch (syncError) {
            console.warn('[DocumentEditModal] Erreur sync après liaison:', syncError);
          }
        }

        alert('✅ Document lié avec succès');
        loadDocumentLinks(); // Recharger les liens
        onUpdate?.();
      } else {
        // Mode normal : utiliser l'API
        const response = await fetch(`/api/documents/${document.id}/links`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityType: linkedTo.toUpperCase(),
            entityId: linkedId || null,
          }),
        });
        const result = await response.json();
        if (result.success) {
          alert('✅ Document lié avec succès');
          loadDocumentLinks(); // Recharger les liens
          onUpdate?.();
        } else {
          alert(`Erreur: ${result.error || 'Erreur lors de la liaison du document'}`);
        }
      }
    } catch (error: any) {
      console.error('Error linking document:', error);
      alert(error.message || 'Erreur lors de la liaison du document');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkDocument = async (link: { id?: string; entityType: string; entityId?: string }) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette liaison ?') || !organizationId) {
      return;
    }
    
    try {
      // ⚠️ Utiliser DocumentService (app-shell et normal)
      const documentService = createDocumentServiceWithMode(mode);
      await documentService.unlinkDocument(
        {
          documentId: document.id,
          linkedType: link.entityType.toLowerCase() as 'property' | 'lease' | 'transaction' | 'tenant' | 'loan' | 'global',
          linkedId: link.entityId,
        },
        organizationId
      );

      // ⚠️ En app-shell online : push → pull → refresh
      if (mode === 'app-shell') {
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
        if (isOnline) {
          try {
            const syncService = getGlobalSyncService();
            await syncService.syncAllPendingToRemote(organizationId);
            await syncService.syncEntityFromRemoteByName('documentLink', organizationId);
            window.dispatchEvent(new CustomEvent('sync:refresh'));
          } catch (syncError) {
            console.warn('[DocumentEditModal] Erreur sync après suppression liaison:', syncError);
          }
        }
      }

      alert('✅ Liaison supprimée avec succès');
      loadDocumentLinks(); // Recharger les liens
      onUpdate?.();
    } catch (error: any) {
      console.error('Error unlinking document:', error);
      alert(error.message || 'Erreur lors de la suppression de la liaison');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" aria-describedby="document-edit-description">
        <DialogHeader>
          <DialogTitle className="text-2xl">Modifier le document</DialogTitle>
          <DialogDescription id="document-edit-description">
            Renommez le fichier ou modifiez son type de document.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="rename" className="flex items-center gap-2">
              <Edit className="h-4 w-4" /> Renommer
            </TabsTrigger>
            <TabsTrigger value="reclassify" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Reclasser
            </TabsTrigger>
            <TabsTrigger value="link" className="flex items-center gap-2">
              <Link className="h-4 w-4" /> Relier
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rename" className="mt-4 space-y-4">
            <div>
              <Label htmlFor="newFilename">Nom du document</Label>
              <Input
                id="newFilename"
                value={newFilename}
                onChange={(e) => setNewFilename(e.target.value)}
                className="mt-1"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={handleSaveRename} loading={isSaving}>Sauvegarder</Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="reclassify" className="mt-4 space-y-4">
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-semibold mb-2">Analyse de classification</h4>
              <p className="text-sm text-gray-700 mb-3">
                Choisissez entre récupérer les prédictions existantes (rapide) ou relancer une analyse complète.
              </p>
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleAnalyzeClassification(false)} 
                  loading={isAnalyzing}
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" /> Voir les prédictions existantes
                </Button>
                <Button 
                  onClick={() => handleAnalyzeClassification(true)} 
                  loading={isAnalyzing}
                >
                  <RefreshCw className="h-4 w-4 mr-2" /> Re-analyse complète
                </Button>
              </div>
            </div>

            {predictions.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold">Prédictions (scores de confiance)</h4>
                <div className="flex flex-wrap gap-2">
                  {predictions.map((p) => (
                    <Badge
                      key={p.typeCode}
                      variant={p.score >= p.threshold ? 'default' : 'secondary'}
                      className="flex items-center gap-1"
                    >
                      {p.score >= p.threshold ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      {p.label}: {(p.score * 100).toFixed(0)}% (Seuil: {(p.threshold * 100).toFixed(0)}%)
                    </Badge>
                  ))}
                </div>

                <div>
                  <Label htmlFor="documentType">Type de document</Label>
                  <div className="mt-1">
                    <SmartSelect
                    id="documentType"
                    value={selectedPredictionType || ''}
                      onChange={(value) => setSelectedPredictionType(value || null)}
                      options={documentTypes.map((type) => ({
                        value: type.code,
                        label: type.label,
                      })) as SmartSelectOption[]}
                      placeholder="Sélectionner un type"
                      aria-label="Type de document"
                    />
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={handleSaveReclassify} loading={isSaving} disabled={!selectedPredictionType}>Sauvegarder</Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="link" className="mt-4 space-y-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Liaisons actuelles</h4>
                {currentLinks.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucune liaison actuelle</p>
                ) : (
                  <div className="space-y-2">
                    {currentLinks.map((link, index) => {
                      const isLastLink = currentLinks.length === 1;
                      const isLastLinkForThisItem = index === currentLinks.length - 1 && isLastLink;
                      
                      return (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {link.entityType === 'global' ? 'Global' :
                               link.entityType === 'property' ? 'Bien' :
                               link.entityType === 'lease' ? 'Bail' :
                               link.entityType === 'tenant' ? 'Locataire' :
                               link.entityType === 'transaction' ? 'Transaction' : link.entityType}
                            </Badge>
                            {link.entityName && (
                              <span className="text-sm text-gray-700">{link.entityName}</span>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnlinkDocument(link)}
                              disabled={isLastLink}
                              className={isLastLink ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                              Supprimer
                            </Button>
                            {isLastLink && (
                              <span className="text-xs text-gray-500 text-right max-w-32">
                                Dernier lien - Document doit rester visible
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Ajouter une nouvelle liaison</h4>
                <DocumentLinkSelector
                  onSelect={handleLinkDocument}
                />
                
                {/* Bouton rapide pour rendre global */}
                {currentLinks.length > 0 && !currentLinks.some(link => link.entityType === 'global') && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-yellow-800 font-medium">💡 Conseil</p>
                        <p className="text-xs text-yellow-700">Ajoutez une liaison "Global" pour que ce document reste visible même si vous supprimez les autres liaisons.</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLinkDocument('global')}
                        className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
                      >
                        Rendre Global
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
