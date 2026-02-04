/**
 * Panneau de génération de rapport d'anomalies pour gestionnaire délégué
 */

'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader2, FileText, Mail } from 'lucide-react';
import type { DelegatedManagementReportRequest } from '@/types/reports';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { computeDelegatedManagementIssuesOffline } from '@/services/reports/delegatedManagementReportOffline';
import { generateReportHTML } from '@/services/reports/generateReportHTML';
import { getLocalDB } from '@/lib/offline/db';
import { pdf } from '@react-pdf/renderer';
import { DelegatedManagementReportPDF } from '@/components/pdf/DelegatedManagementReportPDF';
import { createEml } from '@/lib/eml';

interface ManagementCompany {
  id: string;
  nom: string;
  email?: string | null;
}

interface GestionnaireDelegueReportPanelProps {
  currentMonth: string; // Format: 'YYYY-MM'
  mode?: 'normal' | 'app-shell'; // Mode de fonctionnement
}

export function GestionnaireDelegueReportPanel({ currentMonth, mode = 'normal' }: GestionnaireDelegueReportPanelProps) {
  const { organizationId } = useCurrentOrganization();
  const [selectedGestionnaireId, setSelectedGestionnaireId] = useState<string>('');
  const [periodType, setPeriodType] = useState<'current' | 'last3' | 'year' | 'custom'>('current');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [includeFlags, setIncludeFlags] = useState({
    lateRents: true,
    unmatchedTransactions: true,
    amountGaps: false,
    missingIndexations: false,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [gestionnairesLocal, setGestionnairesLocal] = useState<ManagementCompany[]>([]);
  const [userLocal, setUserLocal] = useState<{ email: string; name: string | null } | null>(null);

  // Charger les gestionnaires depuis IndexedDB en mode app-shell
  React.useEffect(() => {
    if (mode === 'app-shell' && organizationId) {
      let cancelled = false;
      async function loadFromIndexedDB() {
        try {
          const { getLocalDB } = await import('@/lib/offline/db');
          const db = await getLocalDB();
          // Filtrer par organizationId et actif: true
          const allCompanies = await db.ManagementCompany
            .where('organizationId')
            .equals(organizationId)
            .toArray();
          const companies = allCompanies.filter(c => c.actif === true);
          if (!cancelled) {
            setGestionnairesLocal(companies.map(c => ({
              id: c.id,
              nom: c.nom, // CachedManagementCompany utilise 'nom', pas 'name'
              email: c.email || null,
            })));
          }
        } catch (e) {
          console.warn('[GestionnaireDelegueReportPanel] Erreur chargement IndexedDB:', e);
        }
      }
      loadFromIndexedDB();
      return () => { cancelled = true; };
    }
  }, [mode, organizationId]);

  // Charger l'utilisateur depuis localStorage en mode app-shell
  React.useEffect(() => {
    if (mode === 'app-shell') {
      try {
        const localUserStr = localStorage.getItem('localUser');
        if (localUserStr) {
          const localUser = JSON.parse(localUserStr);
          setUserLocal({
            email: localUser.email || 'noreply@smartimmo.fr',
            name: localUser.name || null,
          });
        } else {
          setUserLocal({ email: 'noreply@smartimmo.fr', name: null });
        }
      } catch (e) {
        setUserLocal({ email: 'noreply@smartimmo.fr', name: null });
      }
    }
  }, [mode]);

  // Récupérer les gestionnaires délégués (mode normal uniquement)
  const { data: gestionnairesData } = useQuery<{ societes: ManagementCompany[] }>({
    queryKey: ['management-companies'],
    queryFn: async () => {
      const res = await fetch('/api/gestion/societes');
      if (!res.ok) throw new Error('Erreur lors de la récupération des gestionnaires');
      return res.json();
    },
    enabled: mode === 'normal',
  });

  // Récupérer l'email de l'utilisateur connecté (mode normal uniquement)
  const { data: userData } = useQuery<{ user: { email: string; name: string | null } }>({
    queryKey: ['current-user'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return { user: { email: 'noreply@smartimmo.fr', name: null } };
      return res.json();
    },
    enabled: mode === 'normal',
  });

  const gestionnaires = mode === 'app-shell' ? gestionnairesLocal : (gestionnairesData?.societes || []);
  const userInfo = mode === 'app-shell' ? userLocal : userData?.user;

  // Calculer les dates de période
  const getPeriodDates = (): { from: string; to: string } => {
    const now = new Date();
    
    switch (periodType) {
      case 'current': {
        const [year, month] = currentMonth.split('-').map(Number);
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        return {
          from: firstDay.toISOString().split('T')[0],
          to: lastDay.toISOString().split('T')[0],
        };
      }
      case 'last3': {
        // 3 derniers mois complets : il y a 2 mois, mois dernier, mois actuel
        // Exemple en novembre 2025 : septembre, octobre, novembre
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Fin du mois actuel
        const from = new Date(now.getFullYear(), now.getMonth() - 2, 1); // Début d'il y a 2 mois
        return {
          from: from.toISOString().split('T')[0],
          to: to.toISOString().split('T')[0],
        };
      }
      case 'year': {
        const year = now.getFullYear();
        const firstDay = new Date(year, 0, 1); // 01/01/XXXX
        const lastDay = new Date(year, 11, 31); // 31/12/XXXX
        return {
          from: firstDay.toISOString().split('T')[0],
          to: lastDay.toISOString().split('T')[0],
        };
      }
      case 'custom': {
        return {
          from: customFrom || new Date().toISOString().split('T')[0],
          to: customTo || new Date().toISOString().split('T')[0],
        };
      }
    }
  };

  // Fonction helper pour récupérer les données du rapport
  const fetchReportData = async () => {
    const period = getPeriodDates();
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    
    // ⚠️ OFFLINE-FIRST: Toujours essayer de générer depuis IndexedDB en priorité
    let reportData: any;
    let isFromLocalData = false;
    let pendingOpsCount = 0;

    try {
      // 1. Compter les pendingOps pour informer l'utilisateur
      if (mode === 'app-shell') {
        // ⚠️ IMPORT STATIQUE pour éviter ChunkLoadError en mode offline
        const db = await getLocalDB();
        const allPendingOps = await db.pendingOperations
          .where('organizationId')
          .equals(organizationId!)
          .toArray();
        pendingOpsCount = allPendingOps.filter(op => op.status === 'pending').length;
      }

      // 2. Générer le rapport depuis IndexedDB (offline-first)
      // ⚠️ IMPORT STATIQUE pour éviter ChunkLoadError en mode offline
      reportData = await computeDelegatedManagementIssuesOffline({
        gestionnaireId: selectedGestionnaireId,
        period: {
          from: new Date(period.from),
          to: new Date(period.to),
        },
        include: includeFlags,
        organizationId: organizationId!,
      });
      isFromLocalData = true;
      console.log('[GestionnaireDelegueReportPanel] ✅ Rapport généré depuis IndexedDB');
    } catch (offlineError) {
      console.warn('[GestionnaireDelegueReportPanel] ⚠️ Erreur génération offline:', offlineError);
      
      // 3. Fallback: Si offline et erreur, afficher un message
      if (!isOnline) {
        throw new Error(
          `Impossible de générer le rapport en mode offline: ${offlineError instanceof Error ? offlineError.message : 'Données manquantes'}. ` +
          'Veuillez synchroniser vos données puis réessayer.'
        );
      }

      // 4. Si online, essayer l'API en fallback
      console.log('[GestionnaireDelegueReportPanel] ⚠️ Fallback vers API serveur');
      const request: DelegatedManagementReportRequest = {
        gestionnaireId: selectedGestionnaireId,
        period,
        include: includeFlags,
      };

      const response = await fetch('/api/reports/gestionnaire-delegue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la génération du rapport');
      }

      const result = await response.json();
      
      if (!result.success || !result.reportData) {
        throw new Error('Données du rapport invalides');
      }

      reportData = result.reportData;
      isFromLocalData = false;
    }

    return { reportData, isFromLocalData, pendingOpsCount, period, isOnline };
  };

  const handleGenerateHTML = async () => {
    if (!selectedGestionnaireId) {
      alert('Veuillez sélectionner un gestionnaire délégué');
      return;
    }

    if (!organizationId) {
      alert('Organisation non trouvée');
      return;
    }

    setIsGenerating(true);
    try {
      const { reportData, isFromLocalData, pendingOpsCount, period, isOnline } = await fetchReportData();

      // Générer le HTML imprimable
      const htmlContent = generateReportHTML(reportData);

      // Créer un Blob HTML et le télécharger
      const htmlBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(htmlBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rapport-gestionnaire-${selectedGestionnaireId}-${period.from}-${period.to}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Afficher un message informatif
      let message = 'Rapport HTML généré avec succès !';
      if (isFromLocalData) {
        message += '\n\nRapport généré depuis les données locales.';
        if (pendingOpsCount > 0) {
          message += `\n⚠️ Attention: ${pendingOpsCount} opération(s) en attente de synchronisation. Les données peuvent être incomplètes.`;
        }
        if (!isOnline) {
          message += '\n📴 Mode offline: certaines données peuvent manquer.';
        }
      }
      alert(message);
    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
      alert(error instanceof Error ? error.message : 'Erreur lors de la génération du rapport');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateEMLPDF = async () => {
    if (!selectedGestionnaireId) {
      alert('Veuillez sélectionner un gestionnaire délégué');
      return;
    }

    if (!organizationId) {
      alert('Organisation non trouvée');
      return;
    }

    setIsGenerating(true);
    try {
      const { reportData, isFromLocalData, pendingOpsCount, period, isOnline } = await fetchReportData();

      // Générer le PDF côté client (utiliser pdf().toBlob() pour le navigateur)
      const pdfDocument = React.createElement(DelegatedManagementReportPDF, {
        data: reportData,
      });
      const pdfBlob = await pdf(pdfDocument).toBlob();

      // Préparer le contenu de l'email
      const selectedGestionnaire = gestionnaires.find(g => g.id === selectedGestionnaireId);
      const gestionnaireName = selectedGestionnaire?.nom || 'Gestionnaire délégué';
      const gestionnaireEmail = selectedGestionnaire?.email || userInfo?.email || 'noreply@smartimmo.fr';
      
      const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      };

      const subject = `Rapport d'Anomalies - ${gestionnaireName} - ${formatDate(period.from)} au ${formatDate(period.to)}`;
      
      const emailText = `Bonjour,

Veuillez trouver ci-joint le rapport d'anomalies pour le gestionnaire délégué ${gestionnaireName} pour la période du ${formatDate(period.from)} au ${formatDate(period.to)}.

${isFromLocalData ? '⚠️ Ce rapport a été généré depuis les données locales.' : ''}
${pendingOpsCount > 0 ? `⚠️ Attention: ${pendingOpsCount} opération(s) en attente de synchronisation.` : ''}
${!isOnline ? '📴 Mode offline: certaines données peuvent manquer.' : ''}

Cordialement,
SmartImmo`;

      const emailHTML = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <p>Bonjour,</p>
            <p>Veuillez trouver ci-joint le rapport d'anomalies pour le gestionnaire délégué <strong>${gestionnaireName}</strong> pour la période du <strong>${formatDate(period.from)}</strong> au <strong>${formatDate(period.to)}</strong>.</p>
            ${isFromLocalData ? '<p>⚠️ <em>Ce rapport a été généré depuis les données locales.</em></p>' : ''}
            ${pendingOpsCount > 0 ? `<p>⚠️ <em>Attention: ${pendingOpsCount} opération(s) en attente de synchronisation.</em></p>` : ''}
            ${!isOnline ? '<p>📴 <em>Mode offline: certaines données peuvent manquer.</em></p>' : ''}
            <p>Cordialement,<br>SmartImmo</p>
          </body>
        </html>
      `;

      // Créer le nom de fichier PDF
      const pdfFileName = `rapport-gestionnaire-${selectedGestionnaireId}-${period.from}-${period.to}.pdf`;

      // Créer et télécharger l'EML avec le PDF en pièce jointe
      await createEml({
        from: userInfo?.email || 'noreply@smartimmo.fr',
        to: gestionnaireEmail,
        subject,
        text: emailText,
        html: emailHTML,
        attachments: [
          {
            filename: pdfFileName,
            blob: pdfBlob,
            mime: 'application/pdf',
          },
        ],
      });

      alert('Rapport EML avec PDF généré avec succès !');
    } catch (error) {
      console.error('Erreur lors de la génération du rapport EML+PDF:', error);
      alert(error instanceof Error ? error.message : 'Erreur lors de la génération du rapport');
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedGestionnaire = gestionnaires.find(g => g.id === selectedGestionnaireId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Rapport gestionnaire délégué
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sélection du gestionnaire */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gestionnaire délégué *
          </label>
          <select
            value={selectedGestionnaireId}
            onChange={(e) => setSelectedGestionnaireId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isGenerating}
          >
            <option value="">Sélectionner un gestionnaire...</option>
            {gestionnaires.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nom}
              </option>
            ))}
          </select>
        </div>

        {/* Sélection de la période */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Période
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                value="current"
                checked={periodType === 'current'}
                onChange={(e) => setPeriodType(e.target.value as any)}
                className="mr-2"
                disabled={isGenerating}
              />
              <span className="text-sm">Mois courant ({currentMonth})</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="last3"
                checked={periodType === 'last3'}
                onChange={(e) => setPeriodType(e.target.value as any)}
                className="mr-2"
                disabled={isGenerating}
              />
              <span className="text-sm">3 derniers mois</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="year"
                checked={periodType === 'year'}
                onChange={(e) => setPeriodType(e.target.value as any)}
                className="mr-2"
                disabled={isGenerating}
              />
              <span className="text-sm">Année en cours</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="custom"
                checked={periodType === 'custom'}
                onChange={(e) => setPeriodType(e.target.value as any)}
                className="mr-2"
                disabled={isGenerating}
              />
              <span className="text-sm">Période personnalisée</span>
            </label>
            {periodType === 'custom' && (
              <div className="ml-6 flex gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  disabled={isGenerating}
                />
                <span className="self-center text-sm text-gray-500">à</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  disabled={isGenerating}
                />
              </div>
            )}
          </div>
        </div>

        {/* Types de constats à inclure */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Types de constats à inclure
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeFlags.lateRents}
                onChange={(e) =>
                  setIncludeFlags({ ...includeFlags, lateRents: e.target.checked })
                }
                className="mr-2"
                disabled={isGenerating}
              />
              <span className="text-sm">Loyers en retard</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeFlags.unmatchedTransactions}
                onChange={(e) =>
                  setIncludeFlags({ ...includeFlags, unmatchedTransactions: e.target.checked })
                }
                className="mr-2"
                disabled={isGenerating}
              />
              <span className="text-sm">Transactions non rapprochées</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeFlags.amountGaps}
                onChange={(e) =>
                  setIncludeFlags({ ...includeFlags, amountGaps: e.target.checked })
                }
                className="mr-2"
                disabled={isGenerating}
              />
              <span className="text-sm">Écarts de montant (loyer contractuel vs reversé)</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeFlags.missingIndexations}
                onChange={(e) =>
                  setIncludeFlags({ ...includeFlags, missingIndexations: e.target.checked })
                }
                className="mr-2"
                disabled={isGenerating}
              />
              <span className="text-sm">Indexations non appliquées</span>
            </label>
          </div>
        </div>

        {/* Boutons de génération */}
        <div className="flex gap-2">
          <Button
            onClick={handleGenerateHTML}
            disabled={!selectedGestionnaireId || isGenerating}
            className="flex-1"
            variant="outline"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Télécharger HTML
              </>
            )}
          </Button>
          <Button
            onClick={handleGenerateEMLPDF}
            disabled={!selectedGestionnaireId || isGenerating}
            className="flex-1"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Générer EML + PDF
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

