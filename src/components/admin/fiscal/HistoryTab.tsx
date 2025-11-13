/**
 * Onglet "Historique" - Audit des modifications et publications
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle, Archive, Undo2, Calendar } from 'lucide-react';

export function HistoryTab() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      // Récupérer toutes les versions pour construire l'historique
      const response = await fetch('/api/admin/tax/versions');
      if (response.ok) {
        const versions = await response.json();
        
        // Transformer en événements d'audit
        const auditEvents = versions.flatMap((v: any) => {
          const events = [
            {
              id: `${v.id}-created`,
              type: 'VERSION_CREATED',
              entity: 'FiscalVersion',
              entityId: v.id,
              entityName: v.code,
              user: v.validatedBy || 'system',
              date: v.createdAt,
              details: `Version ${v.code} créée`,
            },
          ];

          if (v.status === 'published') {
            events.push({
              id: `${v.id}-published`,
              type: 'VERSION_PUBLISHED',
              entity: 'FiscalVersion',
              entityId: v.id,
              entityName: v.code,
              user: v.validatedBy || 'system',
              date: v.updatedAt,
              details: `Version ${v.code} publiée`,
            });
          } else if (v.status === 'archived') {
            events.push({
              id: `${v.id}-archived`,
              type: 'VERSION_ARCHIVED',
              entity: 'FiscalVersion',
              entityId: v.id,
              entityName: v.code,
              user: v.validatedBy || 'system',
              date: v.updatedAt,
              details: `Version ${v.code} archivée`,
            });
          }

          return events;
        });

        // Trier par date décroissante
        auditEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setEvents(auditEvents);
      }
    } catch (error) {
      console.error('Erreur chargement historique:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'VERSION_PUBLISHED':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'VERSION_ARCHIVED':
        return <Archive className="h-5 w-5 text-gray-600" />;
      case 'VERSION_ROLLBACK':
        return <Undo2 className="h-5 w-5 text-blue-600" />;
      default:
        return <Calendar className="h-5 w-5 text-gray-400" />;
    }
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'VERSION_PUBLISHED':
        return <Badge variant="success">Publié</Badge>;
      case 'VERSION_ARCHIVED':
        return <Badge variant="secondary">Archivé</Badge>;
      case 'VERSION_ROLLBACK':
        return <Badge variant="info">Rollback</Badge>;
      case 'VERSION_CREATED':
        return <Badge variant="outline">Créé</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Historique des actions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-center py-8">Chargement...</div>}

          {!loading && events.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Aucun événement dans l'historique
            </div>
          )}

          {!loading && events.length > 0 && (
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50">
                  <div className="mt-1">{getEventIcon(event.type)}</div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {getEventBadge(event.type)}
                        <span className="font-medium text-sm">{event.details}</span>
                      </div>
                      <span className="text-xs text-gray-500">{formatDate(event.date)}</span>
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{event.entity}</span> {event.entityName}
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-1">
                      Par : <Badge variant="secondary" className="text-xs">
                        {event.user === 'system' ? '🤖 Système' : event.user || 'Administrateur'}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

