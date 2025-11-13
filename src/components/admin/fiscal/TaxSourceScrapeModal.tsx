/**
 * Modal pour afficher le progression du scraping des sources fiscales officielles
 * Avec polling, journal en temps réel, et CTA vers le diff
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  GitCompare,
  ExternalLink,
  Download,
  Globe
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

interface TaxSourceScrapeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  year?: number;
}

type JobState =
  | 'pending'
  | 'fetching'
  | 'parsing'
  | 'merging'
  | 'validating'
  | 'comparing'
  | 'creating-draft'
  | 'completed'
  | 'failed';

interface JobStatus {
  jobId: string;
  state: JobState;
  progress?: number;
  currentStep?: string;
  logs?: string[];
  status?: 'no-change' | 'draft-created' | 'error';
  draftCode?: string;
  changes?: Array<{ path: string; before: any; after: any }>;
  warnings?: string[];
  error?: string;
}

const STATE_LABELS: Record<JobState, string> = {
  pending: 'En attente',
  fetching: 'Récupération des données',
  parsing: 'Analyse des données',
  merging: 'Fusion des sources',
  validating: 'Validation',
  comparing: 'Comparaison avec version active',
  'creating-draft': 'Création de la version draft',
  completed: 'Terminé',
  failed: 'Échec'
};

const STATE_ICONS: Record<JobState, any> = {
  pending: Loader2,
  fetching: Globe,
  parsing: Download,
  merging: Loader2,
  validating: CheckCircle,
  comparing: GitCompare,
  'creating-draft': Loader2,
  completed: CheckCircle,
  failed: XCircle
};

export function TaxSourceScrapeModal({
  open,
  onClose,
  onSuccess,
  year = new Date().getFullYear()
}: TaxSourceScrapeModalProps) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll des logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [jobStatus?.logs]);
  
  // Lancer le job au montage du modal
  useEffect(() => {
    if (open && !jobId) {
      setError(null); // Réinitialiser l'erreur
      launchJob();
    }
  }, [open]);
  
  // Polling du statut
  useEffect(() => {
    if (jobId && jobStatus?.state !== 'completed' && jobStatus?.state !== 'failed') {
      startPolling();
    } else {
      stopPolling();
    }
    
    return () => stopPolling();
  }, [jobId, jobStatus?.state]);
  
  const launchJob = async () => {
    setLaunching(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/tax/sources/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors du lancement du job');
      }
      
      const data = await response.json();
      setJobId(data.jobId);
      
    } catch (err: any) {
      console.error('Erreur lancement job:', err);
      setError(err.message);
    } finally {
      setLaunching(false);
    }
  };
  
  const startPolling = () => {
    stopPolling(); // Arrêter tout polling existant
    
    // Attendre 500ms avant le premier polling pour laisser le temps au worker de s'initialiser
    setTimeout(() => {
      pollStatus();
      // Puis toutes les 2 secondes
      pollingIntervalRef.current = setInterval(pollStatus, 2000);
    }, 500);
  };
  
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };
  
  const pollStatus = async () => {
    if (!jobId) return;
    
    try {
      const response = await fetch(`/api/admin/tax/sources/status?jobId=${jobId}`);
      
      if (!response.ok) {
        // Si 404, c'est probablement que le job n'est pas encore enregistré
        // On continue le polling sans afficher d'erreur
        if (response.status === 404) {
          console.log('Job pas encore prêt, on attend...');
          return;
        }
        throw new Error('Erreur lors de la récupération du statut');
      }
      
      const status: JobStatus = await response.json();
      setJobStatus(status);
      
      // Effacer toute erreur précédente si on reçoit un statut valide
      setError(null);
      
      // Arrêter le polling si terminé ou échec
      if (status.state === 'completed' || status.state === 'failed') {
        stopPolling();
        
        if (status.state === 'completed' && onSuccess) {
          onSuccess();
        }
      }
      
    } catch (err: any) {
      console.error('Erreur polling:', err);
      setError(err.message);
      stopPolling();
    }
  };
  
  const handleClose = () => {
    stopPolling();
    setJobId(null);
    setJobStatus(null);
    setError(null);
    onClose();
  };
  
  const handleViewDiff = () => {
    if (jobStatus?.draftCode) {
      // Fermer la modal et rediriger vers la page de comparaison
      handleClose();
      window.location.href = `/admin/impots/parametres?compare=${jobStatus.draftCode}`;
    }
  };
  
  const renderStateIndicator = () => {
    if (!jobStatus) return null;
    
    const Icon = STATE_ICONS[jobStatus.state];
    const label = STATE_LABELS[jobStatus.state];
    const isAnimating = jobStatus.state !== 'completed' && jobStatus.state !== 'failed';
    
    return (
      <div className="flex items-center gap-3 mb-4">
        <Icon 
          className={`h-5 w-5 ${isAnimating ? 'animate-spin' : ''} ${
            jobStatus.state === 'completed' ? 'text-green-600' :
            jobStatus.state === 'failed' ? 'text-red-600' :
            'text-blue-600'
          }`}
        />
        <span className="font-medium">{label}</span>
        {jobStatus.progress !== undefined && (
          <Badge variant="secondary">{jobStatus.progress}%</Badge>
        )}
      </div>
    );
  };
  
  const renderResult = () => {
    if (!jobStatus || jobStatus.state !== 'completed') return null;
    
    if (jobStatus.status === 'incomplete') {
      return (
        <Alert className="bg-red-50 border-red-200">
          <XCircle className="h-4 w-4" />
          <AlertDescription className="text-red-900">
            <div className="font-medium mb-1">❌ Scraping incomplet</div>
            <p className="text-sm">
              Seulement {jobStatus.sectionsOk || 0} section(s) récupérée(s) sur 7. 
              {jobStatus.blocking && jobStatus.blocking.length > 0 && (
                <span className="font-medium"> Sections critiques bloquantes : {jobStatus.blocking.join(', ')}</span>
              )}
            </p>
            <p className="text-sm mt-1">
              {jobStatus.blocking && jobStatus.blocking.length > 0 
                ? 'Les sections critiques (IR, PS) n\'ont pas une confiance suffisante.'
                : 'Minimum requis : 2 sections.'
              }
              {' '}Aucune version draft n'a été créée.
            </p>
            {jobStatus.completeness && (
              <div className="mt-3 space-y-2">
                {Object.entries(jobStatus.completeness).map(([section, comp]: any) => {
                  const conf = jobStatus.confidence?.[section] || 0;
                  const source = jobStatus.sources?.[section];
                  
                  return (
                    <div key={section} className="flex items-center gap-2 text-sm">
                      <span className={
                        comp.status === 'ok' ? 'text-green-700 font-medium' :
                        comp.status === 'invalid' ? 'text-red-700' :
                        'text-gray-600'
                      }>
                        {comp.status === 'ok' ? '✅' : comp.status === 'invalid' ? '❌' : '⚪'} {section}
                      </span>
                      
                      {comp.status === 'ok' && (
                        <>
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-full ${
                                conf >= 0.8 ? 'bg-green-500' :
                                conf >= 0.6 ? 'bg-blue-500' :
                                'bg-yellow-500'
                              }`}
                              style={{ width: `${conf * 100}%` }}
                            />
                          </div>
                          <span className="text-xs">{(conf * 100).toFixed(0)}%</span>
                        </>
                      )}
                      
                      {comp.status !== 'ok' && (
                        <span className="text-xs text-gray-500">
                          {comp.status === 'invalid' ? comp.reason : 'Non récupérée'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </AlertDescription>
        </Alert>
      );
    }
    
    if (jobStatus.status === 'no-change') {
      return (
        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-900">
            ✅ Aucun changement détecté par rapport à la version active.
            Les paramètres fiscaux sont à jour.
          </AlertDescription>
        </Alert>
      );
    }
    
    if (jobStatus.status === 'draft-created' || jobStatus.status === 'partial-merge') {
      return (
        <div className="space-y-3">
          <Alert className="bg-green-50 border-green-200">
            <AlertDescription className="text-green-900">
              ✅ Version draft créée avec succès : <strong>{jobStatus.draftCode}</strong>
            </AlertDescription>
          </Alert>
          
          {jobStatus.status === 'partial-merge' && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-yellow-900">
                <div className="font-medium mb-1">⚠️ Fusion partielle</div>
                <p className="text-sm">
                  {jobStatus.sectionsOk || 0} section(s) mises à jour, {jobStatus.sectionsMissing || 0} manquante(s), {jobStatus.sectionsInvalid || 0} invalide(s).
                  Les sections non récupérées ont été conservées de la version active.
                </p>
                {jobStatus.completeness && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium text-gray-700 mb-2">Détail par section (avec confiance) :</div>
                    {Object.entries(jobStatus.completeness).map(([section, comp]: any) => {
                      const conf = jobStatus.confidence?.[section] || 0;
                      const source = jobStatus.sources?.[section] || '?';
                      
                      return (
                        <div key={section} className="flex items-center gap-2">
                          <div className="flex items-center gap-2 w-32">
                            {comp.status === 'ok' && <span className="text-green-700 font-medium">✅ {section}</span>}
                            {comp.status === 'missing' && <span className="text-gray-600">⚪ {section}</span>}
                            {comp.status === 'invalid' && <span className="text-red-700">❌ {section}</span>}
                          </div>
                          
                          {comp.status === 'ok' && (
                            <>
                              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-full ${
                                    conf >= 0.8 ? 'bg-green-500' :
                                    conf >= 0.6 ? 'bg-blue-500' :
                                    conf >= 0.4 ? 'bg-yellow-500' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${conf * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 w-20">{(conf * 100).toFixed(0)}% ({source})</span>
                            </>
                          )}
                          
                          {comp.status !== 'ok' && (
                            <span className="text-xs text-gray-500 flex-1">
                              {comp.status === 'missing' ? 'Non récupérée' : comp.reason}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          {jobStatus.status === 'draft-created' && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-900">
                ℹ️ <strong>Fusion sécurisée :</strong> Toutes les sections ont été récupérées et validées avec succès.
              </AlertDescription>
            </Alert>
          )}
          
          {jobStatus.changes && jobStatus.changes.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">
                  {jobStatus.changes.length} changement(s) détecté(s)
                </span>
                <Button
                  size="sm"
                  onClick={handleViewDiff}
                  className="gap-2"
                >
                  <GitCompare className="h-4 w-4" />
                  Voir le diff complet
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
              
              <div className="space-y-1 text-sm">
                {jobStatus.changes.slice(0, 5).map((change, i) => (
                  <div key={i} className="text-gray-700 font-mono text-xs">
                    {change.path}: {JSON.stringify(change.before)} → {JSON.stringify(change.after)}
                  </div>
                ))}
                {jobStatus.changes.length > 5 && (
                  <div className="text-gray-500 text-xs">
                    ... et {jobStatus.changes.length - 5} autre(s) changement(s)
                  </div>
                )}
              </div>
            </div>
          )}
          
          {jobStatus.warnings && jobStatus.warnings.length > 0 && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-yellow-900">
                <div className="font-medium mb-1">Avertissements :</div>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {jobStatus.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Mise à jour depuis sources officielles
          </DialogTitle>
          <DialogDescription>
            Scraping des barèmes fiscaux depuis BOFiP, DGFiP, Service-Public et Legifrance
            pour l'année {year}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Indicateur d'état */}
          {jobStatus && renderStateIndicator()}
          
          {/* Erreurs */}
          {error && (
            <Alert className="bg-red-50 border-red-200">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="text-red-900">
                {error}
              </AlertDescription>
            </Alert>
          )}
          
          {jobStatus?.error && (
            <Alert className="bg-red-50 border-red-200">
              <XCircle className="h-4 w-4" />
              <AlertDescription className="text-red-900">
                {jobStatus.error}
              </AlertDescription>
            </Alert>
          )}
          
          {/* Résultat */}
          {renderResult()}
          
          {/* Journal des logs */}
          {jobStatus?.logs && jobStatus.logs.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="font-medium text-sm text-gray-700 mb-2">
                  Journal d'exécution :
                </div>
                <div className="bg-gray-900 text-gray-100 rounded p-3 max-h-80 overflow-y-auto font-mono text-xs space-y-1">
                  {jobStatus.logs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Boutons d'action */}
          <div className="flex justify-end gap-2">
            {jobStatus?.state === 'completed' && jobStatus.status === 'draft-created' && (
              <Button
                onClick={handleViewDiff}
                variant="default"
                className="gap-2"
              >
                <GitCompare className="h-4 w-4" />
                Comparer les versions
              </Button>
            )}
            
            <Button
              onClick={handleClose}
              variant={jobStatus?.state === 'completed' ? 'default' : 'outline'}
              disabled={launching || (jobStatus?.state !== 'completed' && jobStatus?.state !== 'failed')}
            >
              {jobStatus?.state === 'completed' || jobStatus?.state === 'failed' ? 'Fermer' : 'Annuler'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

