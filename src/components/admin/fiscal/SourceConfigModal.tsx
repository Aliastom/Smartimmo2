/**
 * Modal de configuration des sources de scraping
 * Permet de visualiser et modifier les URLs des sources officielles
 */

'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { ExternalLink, Save, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';

interface SourceConfigModalProps {
  open: boolean;
  onClose: () => void;
}

// Configuration des sources (à terme, stocker en DB)
const DEFAULT_SOURCES = {
  OPENFISCA: {
    name: 'OpenFisca',
    baseUrl: 'http://localhost:2000',
    status: 'active',
    parameters: [
      { id: 'impot_revenu.bareme_ir_depuis_1945.bareme', label: 'Barème IR', section: 'IR' },
      { id: 'impot_revenu.calcul_impot_revenu.plaf_qf.decote.seuil_celib', label: 'Décote seuil célib', section: 'IR_DECOTE' },
      { id: 'impot_revenu.calcul_impot_revenu.plaf_qf.decote.seuil_couple', label: 'Décote seuil couple', section: 'IR_DECOTE' },
      { id: 'impot_revenu.calcul_impot_revenu.plaf_qf.decote.taux', label: 'Décote taux', section: 'IR_DECOTE' },
      { id: 'taxation_capital.prelevements_sociaux.csg.taux_global.revenus_du_patrimoine', label: 'CSG patrimoine', section: 'PS' },
    ]
  },
  BOFIP: {
    name: 'BOFIP',
    baseUrl: 'https://bofip.impots.gouv.fr',
    status: 'active',
    urls: [
      { path: '/bofip/2491-PGP.html/identifiant=BOI-IR-LIQ-20-10-20250414', label: 'Barème IR 2025', section: 'IR', verified: '08/11/2025' },
      { path: '/bofip/2495-PGP.html/identifiant=BOI-IR-LIQ-20-20-30-20250414', label: 'Décote IR 2025', section: 'IR_DECOTE', verified: '08/11/2025' },
      { path: '/bofip/1733-PGP.html', label: 'Prélèvements sociaux', section: 'PS', verified: null },
      { path: '/bofip/3973-PGP.html/identifiant=BOI-RFPI-DECLA-10-20160706', label: 'Régime micro-foncier (15000€, 30%)', section: 'MICRO', verified: '2025-11-08' },
    ]
  },
  DGFIP: {
    name: 'DGFiP / impots.gouv.fr',
    baseUrl: 'https://www.impots.gouv.fr',
    status: 'active',
    urls: [
      { path: '/particulier/questions/je-mets-en-location-un-logement-vide-comment-declarer-les-loyers-percus', label: 'Micro-foncier (15000€, 30%)', section: 'MICRO', verified: '2025-11-08' },
    ]
  },
  SERVICE_PUBLIC: {
    name: 'Service-Public.fr',
    baseUrl: 'https://www.service-public.fr',
    status: 'inactive',
    urls: [
      { path: '/particuliers/vosdroits/F23267', label: 'Micro-entreprise (404)', section: 'MICRO', verified: null },
      { path: '/particuliers/vosdroits/F32744', label: 'Location meublée (mauvaise page)', section: 'DEFICIT', verified: null },
    ]
  },
  ECONOMIE_GOUV: {
    name: 'Ministère de l\'Économie',
    baseUrl: 'https://www.economie.gouv.fr',
    status: 'active',
    urls: [
      { path: '/particuliers/gerer-mon-argent/gerer-mon-budget-et-mon-epargne/comment-fonctionne-le-plan-depargne', label: 'PER - Plafonds déduction (35194€)', section: 'PER', verified: '2025-11-08' },
    ]
  },
  LEGIFRANCE: {
    name: 'Legifrance',
    baseUrl: 'https://www.legifrance.gouv.fr',
    status: 'inactive',
    urls: [
      { path: '/codes/section_lc/LEGISCTA000006173390', label: 'CGI Article 197 (barème)', section: 'IR', verified: null },
    ]
  }
};

export function SourceConfigModal({ open, onClose }: SourceConfigModalProps) {
  const [sources, setSources] = useState(DEFAULT_SOURCES);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Charger la configuration depuis la base de données
  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tax/sources/config');
      if (response.ok) {
        const data = await response.json();
        if (!data.isDefault && data.sources) {
          setSources(data.sources);
        } else {
          setSources(DEFAULT_SOURCES);
        }
      }
    } catch (error) {
      console.error('[SourceConfig] Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSources(DEFAULT_SOURCES);
    setHasChanges(true); // Marquer comme modifié pour permettre la sauvegarde
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/tax/sources/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources })
      });

      if (!response.ok) {
        throw new Error('Erreur HTTP ' + response.status);
      }

      const data = await response.json();
      console.log('[SourceConfig] Sauvegarde réussie:', data);
      
      setHasChanges(false);
      alert(`✅ Configuration sauvegardée avec succès !\n\n${data.count} source(s) enregistrée(s) en base de données.`);
      
      onClose();
    } catch (error: any) {
      console.error('[SourceConfig] Erreur sauvegarde:', error);
      alert(`❌ Erreur lors de la sauvegarde de la configuration.\n\n${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Configuration des sources de scraping
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement de la configuration...</p>
            </div>
          </div>
        ) : (
          <>
        <div className="space-y-6 mt-4">
          {/* OpenFisca */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-lg">🔵 OpenFisca</h3>
                <Badge variant={sources.OPENFISCA.status === 'active' ? 'default' : 'secondary'}>
                  {sources.OPENFISCA.status === 'active' ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
              <a 
                href={sources.OPENFISCA.baseUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Ouvrir
              </a>
            </div>

            <div className="mb-3">
              <Label>URL de base</Label>
              <Input value={sources.OPENFISCA.baseUrl} readOnly className="bg-gray-50" />
            </div>

            <div className="space-y-2">
              <Label>Paramètres récupérés ({sources.OPENFISCA.parameters.length})</Label>
              <div className="text-xs space-y-1 bg-gray-50 p-3 rounded max-h-40 overflow-y-auto">
                {sources.OPENFISCA.parameters.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{p.section}</Badge>
                    <code className="text-gray-600">{p.id}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BOFIP */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-lg">🟢 BOFIP</h3>
                <Badge variant={sources.BOFIP.status === 'active' ? 'default' : 'secondary'}>
                  {sources.BOFIP.status === 'active' ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              {sources.BOFIP.urls.map((url, i) => (
                <div key={i} className="space-y-2 pb-3 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{url.section}</Badge>
                    <span className="font-medium text-gray-900">{url.label}</span>
                    {url.verified ? (
                      <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Vérifié {url.verified}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        À vérifier
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Input
                      value={url.path}
                      onChange={(e) => {
                        const newSources = { ...sources };
                        newSources.BOFIP.urls[i].path = e.target.value;
                        setSources(newSources);
                        setHasChanges(true);
                      }}
                      className="font-mono text-xs flex-1"
                      placeholder="/bofip/..."
                    />
                    <a 
                      href={`${sources.BOFIP.baseUrl}${url.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DGFiP */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-lg">🟢 DGFiP / impots.gouv.fr</h3>
                <Badge variant={sources.DGFIP.status === 'active' ? 'default' : 'secondary'}>
                  {sources.DGFIP.status === 'active' ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              {sources.DGFIP.urls.map((url, i) => (
                <div key={i} className="space-y-2 pb-3 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{url.section}</Badge>
                    <span className="font-medium text-gray-900">{url.label}</span>
                    {url.verified ? (
                      <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Vérifié {url.verified}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        À vérifier
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Input
                      value={url.path}
                      onChange={(e) => {
                        const newSources = { ...sources };
                        newSources.DGFIP.urls[i].path = e.target.value;
                        setSources(newSources);
                        setHasChanges(true);
                      }}
                      className="font-mono text-xs flex-1"
                      placeholder="/particulier/..."
                    />
                    <a 
                      href={`${sources.DGFIP.baseUrl}${url.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ministère de l'Économie */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-lg">🔵 Ministère de l'Économie</h3>
                <Badge variant={sources.ECONOMIE_GOUV.status === 'active' ? 'default' : 'secondary'}>
                  {sources.ECONOMIE_GOUV.status === 'active' ? 'Actif' : 'Inactif'}
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              {sources.ECONOMIE_GOUV.urls.map((url, i) => (
                <div key={i} className="space-y-2 pb-3 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{url.section}</Badge>
                    <span className="font-medium text-gray-900">{url.label}</span>
                    {url.verified ? (
                      <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Vérifié {url.verified}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        À vérifier
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Input
                      value={url.path}
                      onChange={(e) => {
                        const newSources = { ...sources };
                        newSources.ECONOMIE_GOUV.urls[i].path = e.target.value;
                        setSources(newSources);
                        setHasChanges(true);
                      }}
                      className="font-mono text-xs flex-1"
                      placeholder="/particuliers/..."
                    />
                    <a 
                      href={`${sources.ECONOMIE_GOUV.baseUrl}${url.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sources inactives */}
          <details className="border rounded-lg p-4">
            <summary className="cursor-pointer font-semibold text-gray-500">
              🔴 Sources inactives (2)
            </summary>
            <div className="mt-4 space-y-4">
              {/* Service-Public */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium">{sources.SERVICE_PUBLIC.name}</h4>
                  <Badge variant="secondary">Inactif (URLs obsolètes)</Badge>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  {sources.SERVICE_PUBLIC.urls.map((url, i) => (
                    <div key={i}>• {url.label}: <code className="bg-gray-100 px-1">{url.path}</code></div>
                  ))}
                </div>
              </div>

              {/* Legifrance */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium">{sources.LEGIFRANCE.name}</h4>
                  <Badge variant="secondary">Inactif (Cloudflare 403)</Badge>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  {sources.LEGIFRANCE.urls.map((url, i) => (
                    <div key={i}>• {url.label}: <code className="bg-gray-100 px-1">{url.path}</code></div>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* Indicateur de modifications */}
        {hasChanges && (
          <div className="mt-4 text-sm bg-orange-50 border border-orange-200 rounded p-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <span className="text-orange-900 font-medium">Modifications non sauvegardées</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Réinitialiser
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!hasChanges || saving}
              className={(!hasChanges || saving) ? 'cursor-not-allowed opacity-50' : ''}
              title={!hasChanges ? 'Aucune modification détectée. Modifiez un champ pour activer la sauvegarde.' : 'Sauvegarder les modifications'}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Sauvegarder {hasChanges && '✓'}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Info */}
        <div className="mt-4 text-xs text-gray-500 bg-green-50 border border-green-200 rounded p-3">
          <p className="font-medium text-green-900 mb-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Sauvegarde en base de données
          </p>
          <p>Les modifications sont automatiquement enregistrées en base de données PostgreSQL et chargées à chaque ouverture du modal.</p>
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}

