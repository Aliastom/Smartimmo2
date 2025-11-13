'use client';

import React, { useState, useEffect } from 'react';
import { Upload as UploadIcon, CheckCircle, AlertCircle, Calendar, FileWarning } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  DocumentTable,
  DocumentModal,
  DocumentTableRow,
} from './unified';
import { useUploadReviewModal } from '@/contexts/UploadReviewModalContext';
import { addDays, isBefore } from 'date-fns';

interface PropertyDocumentsSectionProps {
  propertyId: string;
  propertyName: string;
}

export function PropertyDocumentsSection({ propertyId, propertyName }: PropertyDocumentsSectionProps) {
  const [documents, setDocuments] = useState<DocumentTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { openModalWithFileSelection } = useUploadReviewModal();
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [completeness, setCompleteness] = useState<{
    complete: boolean;
    missing: any[];
    provided: any[];
  } | null>(null);

  useEffect(() => {
    loadDocuments();
    loadCompleteness();
  }, [propertyId]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/documents?propertyId=${propertyId}&includeDeleted=false`);
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCompleteness = async () => {
    try {
      const response = await fetch(`/api/documents/completeness?scope=property&entityId=${propertyId}`);
      const data = await response.json();
      setCompleteness(data);
    } catch (error) {
      console.error('Error loading completeness:', error);
    }
  };

  // Compter les documents par type
  const docsByType = documents.reduce((acc, doc) => {
    const type = doc.DocumentType?.label || 'Non classé';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Trouver les documents avec rappels proches
  const upcomingReminders = documents.flatMap(doc => 
    ((doc as any).reminders || []).filter((r: any) => {
      const dueDate = new Date(r.dueDate);
      const in30Days = addDays(new Date(), 30);
      return r.status === 'open' && isBefore(dueDate, in30Days);
    }).map((r: any) => ({ ...r, document: doc }))
  ).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.length}</div>
            <p className="text-xs text-gray-500 mt-1">Tous types confondus</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Complétude
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {completeness?.complete ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-orange-600" />
              )}
              <div className="text-2xl font-bold">
                {completeness ? `${completeness.provided.length}/${completeness.provided.length + completeness.missing.length}` : '-'}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {completeness?.complete ? 'Tous les documents requis' : 'Documents manquants'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Rappels à venir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingReminders.length}</div>
            <p className="text-xs text-gray-500 mt-1">Dans les 30 prochains jours</p>
          </CardContent>
        </Card>
      </div>

      {/* Documents manquants */}
      {completeness && !completeness.complete && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-orange-500" />
              Documents requis manquants
            </CardTitle>
            <CardDescription>
              Ces documents sont obligatoires pour ce bien
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {completeness.missing.map((type) => (
                <Badge key={type.id} variant="destructive">
                  {type.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Reminders */}
      {upcomingReminders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-orange-500" />
              Rappels à venir
            </CardTitle>
            <CardDescription>
              Documents nécessitant votre attention prochainement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingReminders.slice(0, 3).map((reminder: any) => {
                const daysUntil = Math.ceil(
                  (new Date(reminder.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );
                const isUrgent = daysUntil <= 7;

                return (
                  <div 
                    key={reminder.id}
                    className={`
                      flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50
                      ${isUrgent ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}
                    `}
                    onClick={() => setSelectedDocument(reminder.Document)}
                  >
                    <Calendar className={`h-5 w-5 mt-0.5 ${isUrgent ? 'text-red-600' : 'text-yellow-600'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{reminder.title}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Document: {reminder.Document.filenameOriginal}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {daysUntil === 0 
                          ? "Aujourd'hui" 
                          : daysUntil === 1 
                            ? 'Demain' 
                            : `Dans ${daysUntil} jours`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Uploader des documents</CardTitle>
              <CardDescription>
                Ajoutez des documents pour {propertyName}
              </CardDescription>
            </div>
            <Button 
              onClick={() => openModalWithFileSelection({
                scope: 'property',
                propertyId,
                autoLinkingContext: {
                  propertyId: propertyId
                },
                onSuccess: () => {
                  loadDocuments();
                  loadCompleteness();
                }
              })}
            >
              <UploadIcon className="h-4 w-4 mr-2" />
              Uploader
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Documents ({documents.length})</CardTitle>
          <CardDescription>
            Tous les documents associés à ce bien
          </CardDescription>
        </CardHeader>
        <CardContent>
          {documents.length === 0 && !loading ? (
            <div className="text-center py-8">
              <FileWarning className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucun document pour ce bien</p>
              <Button onClick={() => openModalWithFileSelection({
                scope: 'property',
                propertyId,
                autoLinkingContext: {
                  propertyId: propertyId
                },
                onSuccess: () => {
                  loadDocuments();
                  loadCompleteness();
                }
              })}>
                Uploader votre premier document
              </Button>
            </div>
          ) : (
            <DocumentTable
              documents={documents}
              onView={(doc) => setSelectedDocument(doc)}
              onDownload={(doc) => {
                if ((doc as any).url) window.open((doc as any).url, '_blank');
              }}
              showSelection={false}
              showLinkedTo={false}
              loading={loading}
            />
          )}
        </CardContent>
      </Card>

      {/* Document Detail Modal */}
      {selectedDocument && (
        <DocumentModal
          document={selectedDocument}
          isOpen={!!selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onUpdate={() => {
            loadDocuments();
            loadCompleteness();
            setSelectedDocument(null);
          }}
        />
      )}
    </div>
  );
}

