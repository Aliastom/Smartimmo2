'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { X, Trash2, FileText, Download, Link as LinkIcon, CheckCircle, AlertCircle, Image as ImageIcon, File, Home, DollarSign, User, HardDrive, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/utils/cn';

interface DocumentDrawerProps {
  document: {
    id: string;
    fileName: string;
    filenameOriginal: string;
    documentType?: {
      id: string;
      label: string;
      code: string;
    };
    DocumentType?: {
      id: string;
      label: string;
      code: string;
    };
    status: string;
    size: number;
    mime: string;
    createdAt: Date | string;
    links?: Array<{
      id: string;
      linkedType: string;
      linkedId?: string;
      entityName?: string;
      role?: string;
    }>;
    DocumentLink?: Array<{
      id: string;
      linkedType: string;
      linkedId?: string;
      entityName?: string;
      role?: string;
    }>;
    ocrStatus?: string;
    extractedText?: string;
    ocrConfidence?: number;
    deletedAt?: Date | string | null;
    userReason?: string;
  } | null;
  onOpenEntity?: (linkedType: string, linkedId: string | undefined) => void;
  /** Section à mettre en évidence à l'ouverture (scroll) */
  scrollToSection?: 'impact' | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (document: any) => void;
  onDownload: (document: any) => void;
}

export default function DocumentDrawer({
  document,
  isOpen,
  onClose,
  onDelete,
  onDownload,
  onOpenEntity,
  scrollToSection,
}: DocumentDrawerProps) {
  const impactSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollToSection === 'impact' && impactSectionRef.current) {
      const t = setTimeout(() => {
        impactSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [isOpen, scrollToSection]);

  const getEntityLabelForGroup = (linkedType: string) => {
    const t = (linkedType || '').toLowerCase();
    switch (t) {
      case 'property': return 'Bien';
      case 'lease': return 'Bail';
      case 'tenant': return 'Locataire';
      case 'transaction': return 'Transaction';
      case 'global': return 'Global';
      default: return linkedType;
    }
  };

  const groupedLinks = useMemo(() => {
    if (!document) return [];
    const links = document.DocumentLink || document.links || [];
    if (links.length === 0) return [];
    const byType: Record<string, Array<{ entityName?: string; linkedId?: string; id?: string; index: number }>> = {};
    links.forEach((link: { linkedType?: string; linkedId?: string; entityName?: string; id?: string }, index: number) => {
      const t = (link.linkedType || 'global').toLowerCase();
      if (!byType[t]) byType[t] = [];
      byType[t].push({ entityName: link.entityName, linkedId: link.linkedId, id: link.id, index });
    });
    const order = ['property', 'lease', 'tenant', 'transaction', 'global'];
    return order.filter((t) => byType[t]?.length).map((t) => ({
      type: t,
      items: byType[t],
      label: getEntityLabelForGroup(t),
    }));
  }, [document?.DocumentLink, document?.links]);

  if (!isOpen || !document) return null;

  const formatDate = (dateString: string | Date): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getDocumentIcon = (mime: string) => {
    // PDF
    if (mime.includes('pdf')) {
      return (
        <div className="relative">
          <FileText className="h-16 w-16 text-orange-500" />
          <span className="absolute bottom-0 right-0 text-[10px] font-bold text-orange-700 bg-orange-100 px-1 rounded">PDF</span>
        </div>
      );
    }
    
    // Images
    if (mime.includes('image')) {
      return (
        <div className="relative">
          <ImageIcon className="h-16 w-16 text-gray-500" />
          <span className="absolute bottom-0 right-0 text-[10px] font-bold text-gray-700 bg-gray-100 px-1 rounded">IMG</span>
        </div>
      );
    }
    
    // Documents Word
    if (mime.includes('word') || mime.includes('msword') || mime.includes('officedocument.wordprocessing')) {
      return (
        <div className="relative">
          <FileText className="h-16 w-16 text-gray-500" />
          <span className="absolute bottom-0 right-0 text-[10px] font-bold text-gray-700 bg-gray-100 px-1 rounded">DOC</span>
        </div>
      );
    }
    
    // Excel
    if (mime.includes('excel') || mime.includes('spreadsheet')) {
      return (
        <div className="relative">
          <FileText className="h-16 w-16 text-gray-500" />
          <span className="absolute bottom-0 right-0 text-[10px] font-bold text-gray-700 bg-gray-100 px-1 rounded">XLS</span>
        </div>
      );
    }
    
    // Autres fichiers
    return <File className="h-16 w-16 text-gray-500" />;
  };

  const getOcrBadge = () => {
    const ocrStatus = document.ocrStatus || 'unknown';
    
    const statusMap: Record<string, { variant: any; label: string; icon?: any }> = {
      completed: { variant: 'success', label: 'Traité', icon: CheckCircle },
      processed: { variant: 'success', label: 'Traité', icon: CheckCircle },
      success: { variant: 'success', label: 'Traité', icon: CheckCircle },
      failed: { variant: 'destructive', label: 'Échoué', icon: AlertCircle },
      pending: { variant: 'warning', label: 'En attente', icon: AlertCircle },
      unknown: { variant: 'secondary', label: 'N/A', icon: null },
    };

    const config = statusMap[ocrStatus] || { variant: 'secondary', label: 'Non traité', icon: null };
    const Icon = config.icon;
    
    // Ajouter le % directement dans le label si disponible
    let label = config.label;
    if (document.ocrConfidence && (ocrStatus === 'processed' || ocrStatus === 'completed' || ocrStatus === 'success')) {
      label = `${config.label} (${Math.round(document.ocrConfidence * 100)}%)`;
    }

    return (
      <Badge variant={config.variant}>
        {Icon && <Icon className="h-3 w-3 mr-1" />}
        {label}
      </Badge>
    );
  };

  const getLinkIcon = (linkedType: string) => {
    const t = (linkedType || '').toLowerCase();
    if (t === 'property') return <Home className="h-4 w-4 text-gray-500" />;
    if (t === 'lease') return <FileText className="h-4 w-4 text-gray-500" />;
    if (t === 'transaction') return <DollarSign className="h-4 w-4 text-gray-500" />;
    if (t === 'tenant') return <User className="h-4 w-4 text-gray-500" />;
    return <LinkIcon className="h-4 w-4 text-gray-400" />;
  };

  const getEntityLabel = (linkedType: string) => {
    const t = (linkedType || '').toLowerCase();
    switch (t) {
      case 'property': return 'Bien';
      case 'lease': return 'Bail';
      case 'tenant': return 'Locataire';
      case 'transaction': return 'Transaction';
      case 'global': return 'Global';
      default: return linkedType;
    }
  };

  const renderGroupedLinks = () => {
    if (groupedLinks.length === 0) {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-1.5">
          <LinkIcon className="h-4 w-4" />
          <span>Aucune liaison</span>
        </div>
      );
    }
    return (
      <div className="space-y-1.5">
        {groupedLinks.map((group) => {
          const byName: Record<string, { count: number; linkedId?: string }> = {};
          group.items.forEach((item) => {
            const name = item.entityName?.trim() || '(sans nom)';
            if (!byName[name]) byName[name] = { count: 0, linkedId: item.linkedId };
            byName[name].count += 1;
          });
          const entries = Object.entries(byName);
          return (
            <div key={group.type} className="space-y-1">
              {entries.map(([name, { count, linkedId }]) => {
                const label = count > 1 ? `${name} (${count})` : name;
                const canOpen = onOpenEntity && linkedId;
                const Wrapper = canOpen ? 'button' : 'div';
                return (
                  <Wrapper
                    key={name}
                    type={canOpen ? 'button' : undefined}
                    onClick={canOpen ? () => onOpenEntity(group.type, linkedId) : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 py-1.5 px-3 rounded-lg border text-left transition-colors',
                      'bg-gray-50 border-gray-100',
                      canOpen && 'hover:bg-gray-100 hover:border-gray-200 cursor-pointer'
                    )}
                  >
                    {getLinkIcon(group.type)}
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{group.label}</span>
                      <p className="font-medium text-gray-900 truncate">{label}</p>
                    </div>
                  </Wrapper>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={onClose}
      />
      
      {/* Drawer - slide from right */}
      <div className="fixed right-0 top-0 h-screen w-full max-w-full sm:max-w-2xl bg-white shadow-xl animate-in slide-in-from-right duration-300 ease-out">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-gray-900 truncate">
                {document.filenameOriginal}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="ml-4 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-4">
              {/* Section 1 : Document */}
              <section className="pb-4 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  Document
                </h3>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">{getDocumentIcon(document.mime)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{document.filenameOriginal}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(document.DocumentType || document.documentType) ? (
                        <Badge variant="default">{(document.DocumentType || document.documentType)!.label}</Badge>
                      ) : (
                        <Badge variant="secondary">Non classé</Badge>
                      )}
                    </div>
                    <div className="mt-2">{getOcrBadge()}</div>
                  </div>
                </div>
              </section>

              {/* Section 2 : Fichier */}
              <section className="pb-4 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <HardDrive className="h-3.5 w-3.5" />
                  Fichier
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Taille</p>
                    <p className="font-medium text-gray-900">{formatFileSize(document.size)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Date</p>
                    <p className="font-medium text-gray-900">{formatDate(document.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Format</p>
                    <p className="font-medium text-gray-900">{document.mime || '—'}</p>
                  </div>
                </div>
              </section>

              {/* Section Impact patrimonial (détaillé) */}
              <div ref={impactSectionRef}>
              {(() => {
                const links = document.DocumentLink || document.links || [];
                let rentsCount = 0;
                let hasLease = false;
                let hasProperty = false;
                let propertyName: string | null = null;
                links.forEach((l: { linkedType?: string; entityName?: string }) => {
                  const t = (l.linkedType || '').toLowerCase();
                  if (t === 'transaction') rentsCount += 1;
                  if (t === 'lease') hasLease = true;
                  if (t === 'property') {
                    hasProperty = true;
                    if (l.entityName) propertyName = l.entityName;
                  }
                });
                const hasType = !!(document.DocumentType || (document as { documentType?: unknown }).documentType);
                const hasLinks = links.length > 0;
                const ocrFailed = document.ocrStatus === 'failed';
                const statut = !hasType && !hasLinks ? 'probleme' : ocrFailed ? 'partiel' : hasType && hasLinks ? 'ok' : 'partiel';
                const statutLabels: Record<string, string> = {
                  ok: '✔ Données cohérentes',
                  partiel: '⚠ Données partielles',
                  probleme: '✖ Écart détecté',
                };
                const niveau = rentsCount >= 3 ? 'eleve' : rentsCount >= 1 || hasLease || hasProperty ? 'moyen' : 'faible';
                const niveauLabels: Record<string, string> = { eleve: 'Critique', moyen: 'Important', faible: 'Secondaire' };
                return (
                  <section className="pb-4 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Impact patrimonial
                    </h3>
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                        <span className="text-gray-500">Statut métier</span>
                        <span className={cn(
                          'inline-flex rounded px-2 py-0.5 text-xs font-medium',
                          statut === 'ok' && 'bg-emerald-100 text-emerald-700 border border-emerald-200',
                          statut === 'partiel' && 'bg-amber-100 text-amber-800 border border-amber-200',
                          statut === 'probleme' && 'bg-red-100 text-red-700 border border-red-200'
                        )}>
                          {statutLabels[statut] ?? statut}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                        <span className="text-gray-500">Priorisation</span>
                        <span className="font-medium text-gray-900">{niveauLabels[niveau] ?? niveau}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                        <span className="text-gray-500">Transactions liées</span>
                        <span className="font-medium text-gray-900">{rentsCount > 0 ? rentsCount : 'Aucune'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                        <span className="text-gray-500">Bail lié</span>
                        <span className="font-medium text-gray-900">{hasLease ? 'Oui' : 'Non'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1.5">
                        <span className="text-gray-500">Lien avec bien</span>
                        <span className="font-medium text-gray-900 truncate max-w-[180px]" title={propertyName || undefined}>
                          {hasProperty ? (propertyName || 'Oui') : 'Non'}
                        </span>
                      </div>
                    </div>
                  </section>
                );
              })()}
              </div>

              {/* Section 3 : Liaisons (icônes + noms lisibles, groupées, cliquables) */}
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <LinkIcon className="h-3.5 w-3.5" />
                  Liaisons
                </h3>
                {renderGroupedLinks()}
              </section>

              {/* Texte extrait */}
              {document.extractedText && (
                <section className="pt-4 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Texte extrait (aperçu)</h3>
                  <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {document.extractedText.length > 500 
                        ? `${document.extractedText.substring(0, 500)}...` 
                        : document.extractedText}
                    </p>
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-100">
            <Button
              variant="outline"
              onClick={() => onDownload(document)}
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger
            </Button>
            <Button
              variant="outline"
              onClick={() => onDelete(document)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

