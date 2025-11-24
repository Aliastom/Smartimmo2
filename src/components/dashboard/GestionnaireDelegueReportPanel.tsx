/**
 * Panneau de génération de rapport d'anomalies pour gestionnaire délégué
 */

'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader2, FileText, Mail } from 'lucide-react';
import { createEml } from '@/lib/eml';
import type { DelegatedManagementReportRequest } from '@/types/reports';

interface ManagementCompany {
  id: string;
  nom: string;
  email?: string | null;
}

interface GestionnaireDelegueReportPanelProps {
  currentMonth: string; // Format: 'YYYY-MM'
}

export function GestionnaireDelegueReportPanel({ currentMonth }: GestionnaireDelegueReportPanelProps) {
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

  // Récupérer les gestionnaires délégués
  const { data: gestionnairesData } = useQuery<{ societes: ManagementCompany[] }>({
    queryKey: ['management-companies'],
    queryFn: async () => {
      const res = await fetch('/api/gestion/societes');
      if (!res.ok) throw new Error('Erreur lors de la récupération des gestionnaires');
      return res.json();
    },
  });

  // Récupérer l'email de l'utilisateur connecté pour l'expéditeur de l'email
  const { data: userData } = useQuery<{ user: { email: string; name: string | null } }>({
    queryKey: ['current-user'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return { user: { email: 'noreply@smartimmo.fr', name: null } };
      return res.json();
    },
  });

  const gestionnaires = gestionnairesData?.societes || [];

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

  const handleGenerateReport = async () => {
    if (!selectedGestionnaireId) {
      alert('Veuillez sélectionner un gestionnaire délégué');
      return;
    }

    setIsGenerating(true);
    try {
      const period = getPeriodDates();
      
      const request: DelegatedManagementReportRequest = {
        gestionnaireId: selectedGestionnaireId,
        period,
        include: includeFlags,
      };

      // Appeler l'API pour générer le rapport
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
      
      if (!result.success || !result.pdfBase64 || !result.reportData) {
        throw new Error('Données du rapport invalides');
      }

      // Convertir le PDF base64 en Blob
      const pdfBlob = await fetch(`data:application/pdf;base64,${result.pdfBase64}`)
        .then(res => res.blob());

      // Récupérer les informations du gestionnaire
      const gestionnaire = gestionnaires.find(g => g.id === selectedGestionnaireId);
      const gestionnaireName = gestionnaire?.nom || 'Gestionnaire délégué';
      const gestionnaireEmail = gestionnaire?.email || 'gestionnaire@example.com';
      
      // Récupérer l'email de l'utilisateur connecté
      const userEmail = userData?.user?.email || 'noreply@smartimmo.fr';
      const userName = userData?.user?.name || 'Propriétaire';

      // Préparer le texte et HTML de l'email
      // Forcer le format jj/mm/yyyy pour éviter les problèmes de conversion et timezone
      const formatDate = (dateStr: string) => {
        // Parser la date ISO string en composants pour éviter les problèmes de timezone
        const parts = dateStr.split('T')[0].split('-'); // YYYY-MM-DD
        if (parts.length === 3) {
          const year = parts[0];
          const month = parts[1];
          const day = parts[2];
          return `${day}/${month}/${year}`;
        }
        // Fallback si le format n'est pas ISO
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      };
      
      const periodFrom = formatDate(period.from);
      const periodTo = formatDate(period.to);
      
      const textBody = `Bonjour,

Suite à la vérification de la gestion locative déléguée pour la période du ${periodFrom} au ${periodTo}, plusieurs anomalies ont été détectées via mon outil de suivi Smartimmo.

Vous trouverez ci-joint un rapport PDF détaillant :
${includeFlags.lateRents ? '- les loyers en retard pour les biens en gestion déléguée,\n' : ''}${includeFlags.unmatchedTransactions ? '- les transactions bancaires non rapprochées,\n' : ''}${includeFlags.amountGaps ? '- les éventuels écarts entre loyers attendus et montants reversés,\n' : ''}${includeFlags.missingIndexations ? '- les indexations non appliquées le cas échéant.\n' : ''}
Je vous remercie de bien vouloir analyser ces éléments, me confirmer les actions correctives envisagées et, le cas échéant, procéder aux régularisations nécessaires.

N'hésitez pas à revenir vers moi si vous avez besoin de compléments.

Cordialement.`;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">Rapport d'anomalies - Gestion locative déléguée</h2>
          <p>Bonjour,</p>
          <p>Suite à la vérification de la gestion locative déléguée pour la période du <strong>${periodFrom}</strong> au <strong>${periodTo}</strong>, plusieurs anomalies ont été détectées via mon outil de suivi Smartimmo.</p>
          <p>Vous trouverez ci-joint un rapport PDF détaillant :</p>
          <ul>
            ${includeFlags.lateRents ? '<li>les loyers en retard pour les biens en gestion déléguée,</li>' : ''}
            ${includeFlags.unmatchedTransactions ? '<li>les transactions bancaires non rapprochées,</li>' : ''}
            ${includeFlags.amountGaps ? '<li>les éventuels écarts entre loyers attendus et montants reversés,</li>' : ''}
            ${includeFlags.missingIndexations ? '<li>les indexations non appliquées le cas échéant.</li>' : ''}
          </ul>
          <p>Je vous remercie de bien vouloir analyser ces éléments, me confirmer les actions correctives envisagées et, le cas échéant, procéder aux régularisations nécessaires.</p>
          <p>N'hésitez pas à revenir vers moi si vous avez besoin de compléments.</p>
          <p>Cordialement.</p>
        </div>
      `;

      // Objet de l'email
      const emailSubject = `Anomalies de gestion - ${gestionnaireName} - ${periodFrom} à ${periodTo}`;

      // Générer l'EML avec le PDF en pièce jointe
      await createEml({
        from: `${userName} <${userEmail}>`,
        to: gestionnaireEmail,
        subject: emailSubject,
        text: textBody,
        html: htmlBody,
        attachments: [{
          filename: result.pdfFileName,
          blob: pdfBlob,
        }],
      });

      alert('Fichier .eml généré avec succès ! Le PDF est inclus en pièce jointe.');
    } catch (error) {
      console.error('Erreur lors de la génération du rapport:', error);
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

        {/* Bouton de génération */}
        <Button
          onClick={handleGenerateReport}
          disabled={!selectedGestionnaireId || isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4 mr-2" />
              Générer le mail + PDF
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

