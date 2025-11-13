'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Mail } from 'lucide-react';
import { type Lease } from '../hooks/useLeases';
import { toast } from 'sonner';
import { buildMailto } from '@/lib/email';
import { createEml } from '@/lib/eml';
import { leaseHtml, leaseText } from '@/lib/emailTemplates';

interface LeasePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  lease: Lease;
}

export default function LeasePdfModal({ isOpen, onClose, lease }: LeasePdfModalProps) {
  const [includeSignature, setIncludeSignature] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [landlord, setLandlord] = useState<any>(null);
  const [isLoadingLandlord, setIsLoadingLandlord] = useState(true);
  
  // États pour l'envoi par email
  const [sendEmail, setSendEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [sendCopy, setSendCopy] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchLandlord();
    }
  }, [isOpen]);

  // Préremplir le sujet et le corps de l'email quand on active l'envoi
  useEffect(() => {
    if (sendEmail && !emailSubject && lease.Property) {
      setEmailSubject(`Votre bail de location – ${lease.Property.name}`);
    }
  }, [sendEmail, lease.Property, emailSubject]);

  const fetchLandlord = async () => {
    try {
      const response = await fetch('/api/profile');
      if (response.ok) {
        const data = await response.json();
        setLandlord(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoadingLandlord(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (isSending) return;
    
    if (includeSignature && !landlord?.signatureUrl) {
      toast.error('Signature manquante', {
        description: 'Ajoutez votre signature dans Profil > Signature du propriétaire',
        action: {
          label: 'Ouvrir le Profil',
          onClick: () => {
            window.location.href = '/profil';
          },
        },
        duration: 7000,
      });
      return;
    }

    setIsSending(true);
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/leases/${lease.id}/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          includeSignature,
          ownerName: landlord?.fullName,
          ownerCity: landlord?.city,
          signatureUrl: includeSignature ? landlord?.signatureUrl : null,
          signedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la génération');
      }

      const result = await response.json();

      // Si envoi par email activé : créer le .eml sans télécharger le PDF séparément
      if (sendEmail && lease.Tenant?.email) {
        const formatCurrency = (amount: number) => {
          return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
        };

        const startFr = new Date(lease.startDate).toLocaleDateString('fr-FR');
        const endFr = lease.endDate ? new Date(lease.endDate).toLocaleDateString('fr-FR') : 'Indéterminée';
        const pdfUrl = `${window.location.origin}${result.downloadUrl}`;

        // Construire le message avec les données
        const templateData = {
          tenantName: `${lease.Tenant.firstName} ${lease.Tenant.lastName}`,
          propertyName: lease.Property?.name || '',
          pdfUrl: '', // Pas utilisé en mode .eml avec PJ
          propertyAddress: lease.Property?.address || '',
          startFr,
          endFr,
          rentFr: formatCurrency(lease.rentAmount || 0),
          chargesFr: formatCurrency(lease.charges || 0),
          landlordName: landlord?.fullName || '',
        };

        const textBody = leaseText(templateData);
        const htmlBody = leaseHtml(templateData, true); // withAttachment = true

        await createEml({
          from: `${landlord?.fullName} <${landlord?.email}>`,
          to: lease.Tenant.email,
          bcc: sendCopy ? landlord?.email : undefined,
          subject: emailSubject,
          text: textBody,
          html: htmlBody,
          attachments: [{
            filename: result.fileName,
            url: pdfUrl,
          }],
        });

        // Logger l'envoi EML
        await fetch('/api/email/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leaseId: lease.id,
            tenantId: lease.tenantId,
            type: 'LEASE',
            mode: 'EML',
            to: lease.Tenant.email,
            subject: emailSubject,
          }),
        });

        toast.success('Email .eml créé avec succès !', {
          description: 'Ouvrez le fichier .eml dans votre client mail pour envoyer.',
        });
      } else {
        // Mode normal : télécharger le PDF seulement
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success('PDF généré avec succès !', {
          description: `Le bail a été téléchargé : ${result.fileName}`,
        });
      }

      onClose();
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error('Erreur lors de la génération du PDF', {
        description: error.message || 'Une erreur inattendue s\'est produite',
      });
    } finally {
      setIsGenerating(false);
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-base-content bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-neutral-800">Générer le bail PDF</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X size={24} />
          </button>
        </div>

        {isLoadingLandlord ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-neutral-600">Chargement des informations...</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-sm text-neutral-600 mb-4">
                Générer le bail PDF pour <span className="font-medium">{lease.Tenant?.firstName} {lease.Tenant?.lastName}</span>
                {' '}pour le bien <span className="font-medium">{lease.Property?.name}</span>.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="includeSignature"
                    checked={includeSignature}
                    onChange={(e) => setIncludeSignature(e.target.checked)}
                    className="w-4 h-4 text-primary bg-base-200 border-base-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="includeSignature" className="text-sm font-medium text-neutral-700">
                    Inclure la signature du bailleur
                  </label>
                </div>
                
                {includeSignature && (
                  <div className="ml-7 text-xs">
                    {landlord?.signatureUrl ? (
                      <div className="flex items-center gap-2 text-success">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Signature disponible</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>Ajoutez votre signature dans <button onClick={() => window.location.href = '/profil'} className="underline font-medium">Profil</button></span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bloc envoi par email */}
              <div className="border-t border-neutral-200 pt-4 mt-4">
                <div className="flex items-center space-x-2 mb-3">
                  <input
                    type="checkbox"
                    id="sendEmailLease"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    disabled={!lease.Tenant?.email}
                    className="w-4 h-4 text-primary bg-base-200 border-base-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="sendEmailLease" className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                    <Mail size={16} />
                    Envoyer au locataire par email
                  </label>
                </div>

                {!lease.Tenant?.email && (
                  <p className="text-xs text-error ml-6 mb-2">
                    ⚠ Le locataire n'a pas d'email renseigné
                  </p>
                )}

                {sendEmail && lease.Tenant?.email && (
                  <div className="ml-6 space-y-3 p-3 bg-neutral-50 rounded-md">
                    {/* Sujet */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Sujet
                      </label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
                        placeholder="Sujet de l'email"
                      />
                    </div>

                    {/* Hint */}
                    <div className="mt-2">
                      <div className="w-full max-w-full overflow-hidden break-words whitespace-normal rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs leading-snug text-sky-700">
                        ✓ Le PDF sera joint automatiquement. Le texte HTML est généré pour vous.
                      </div>
                    </div>

                    {/* Copie au bailleur */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="sendCopyLease"
                        checked={sendCopy}
                        onChange={(e) => setSendCopy(e.target.checked)}
                        className="w-4 h-4 text-primary"
                      />
                      <label htmlFor="sendCopyLease" className="text-xs text-neutral-700">
                        S'envoyer une copie (BCC)
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-md hover:bg-neutral-200 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleGeneratePdf}
                disabled={isGenerating || (includeSignature && !landlord?.signatureUrl)}
                className="px-4 py-2 text-sm font-medium text-base-100 bg-primary rounded-md hover:bg-primary transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={includeSignature && !landlord?.signatureUrl ? "Ajoutez votre signature dans le profil" : ""}
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Génération...
                  </>
                ) : (
                  <>
                    <FileText size={16} />
                    Générer le PDF
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
