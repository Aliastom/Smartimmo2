'use client';

import React, { useState } from 'react';
import { X, Download, Mail } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { RentReceiptPDF } from '../../components/pdf/RentReceiptPDF';
import { type Lease } from '../hooks/useLeases';
import { toast } from 'sonner';
import { buildMailto } from '@/lib/email';
import { createEml } from '@/lib/eml';
import { receiptHtml, receiptText } from '@/lib/emailTemplates';
import { useQueryClient } from '@tanstack/react-query';

interface RentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  lease: Lease;
}

const months = [
  { value: 1, label: 'Janvier' },
  { value: 2, label: 'Février' },
  { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' },
  { value: 8, label: 'Août' },
  { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' },
  { value: 12, label: 'Décembre' },
];

export default function RentReceiptModal({ isOpen, onClose, lease }: RentReceiptModalProps) {
  const queryClient = useQueryClient();
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // États pour l'envoi par email
  const [sendEmail, setSendEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [sendCopy, setSendCopy] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // État pour enregistrer le paiement
  const [recordPayment, setRecordPayment] = useState(false);
  
  // États pour les montants éditables
  const [rentAmount, setRentAmount] = useState(lease.rentAmount || 0);
  const [chargesAmount, setChargesAmount] = useState(lease.charges || 0);

  if (!isOpen) return null;

  // Préremplir le sujet et le corps de l'email quand on active l'envoi
  React.useEffect(() => {
    if (sendEmail && !emailSubject) {
      const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
      setEmailSubject(`Quittance de loyer – ${monthLabel} ${selectedYear}`);
    }
  }, [sendEmail, selectedMonth, selectedYear, emailSubject]);

  // Réinitialiser les montants quand le bail change
  React.useEffect(() => {
    setRentAmount(lease.rentAmount || 0);
    setChargesAmount(lease.charges || 0);
  }, [lease.id, lease.rentAmount, lease.charges]);

  const handleGenerateReceipt = async () => {
    if (isSending) return;
    setIsSending(true);
    setIsGenerating(true);
    try {
      // Vérifier que les données nécessaires sont présentes
      if (!lease.Property?.address) {
        toast.error('Adresse du bien manquante');
        setIsGenerating(false);
        setIsSending(false);
        return;
      }
      if (!lease.Tenant?.firstName || !lease.Tenant?.lastName) {
        toast.error('Informations du locataire manquantes');
        setIsGenerating(false);
        setIsSending(false);
        return;
      }

      // Récupérer les informations du profil utilisateur
      const profileResponse = await fetch('/api/profile');
      if (!profileResponse.ok) {
        toast.error('Impossible de récupérer les informations du profil');
        setIsGenerating(false);
        setIsSending(false);
        return;
      }
      const landlord = await profileResponse.json();

      if (!landlord.fullName) {
        toast.error('Nom du bailleur manquant. Veuillez compléter le profil.');
        setIsGenerating(false);
        setIsSending(false);
        return;
      }

      const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
      
      // Préparer les données pour le PDF
      const receiptData = {
        month: monthLabel,
        year: selectedYear,
        propertyAddress: lease.Property.address,
        tenantName: `${lease.Tenant.firstName} ${lease.Tenant.lastName}`,
        ownerName: landlord.fullName,
        rent: rentAmount, // Utiliser les montants éditables
        charges: chargesAmount, // Utiliser les montants éditables
        paymentDate: new Date(paymentDate).toISOString(),
        paymentDay: lease.paymentDay || 1, // Jour de paiement du bail (fallback = 1er)
        signatureUrl: landlord.signatureUrl || null, // Signature du bailleur si disponible
        city: landlord.city || 'Nantes',
        logoUrl: null, // Logo désactivé pour éviter erreur 404
      };

      // Enregistrer le paiement si demandé (AVANT la génération du PDF)
      let transactionResult = null;
      if (recordPayment) {
        try {
          const total = rentAmount + chargesAmount;
          console.log('[RentReceiptModal] Enregistrement du paiement...', {
            leaseId: lease.id,
            rentAmount,
            chargesAmount,
            amount: total,
            monthsCovered: `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`
          });
          
          // Générer le PDF pour l'envoyer à l'API
          const pdfBlob = await pdf(<RentReceiptPDF {...receiptData} />).toBlob();
          const pdfBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(pdfBlob);
          });

          const response = await fetch('/api/receipts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leaseId: lease.id,
              rentAmount,
              chargesAmount,
              amount: total,
              paidAt: new Date(paymentDate).toISOString(),
              method: 'TRANSFER',
              notes: `Paiement du loyer ${monthLabel} ${selectedYear}`,
              generateReceipt: true, // Générer le PDF et l'attacher à la transaction
              receiptPdfBase64: pdfBase64, // Envoyer le PDF en base64
              attachments: [],
              monthsCovered: `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`,
            }),
          });

          console.log('[RentReceiptModal] Réponse API:', response.status, response.ok);

          if (response.ok) {
            transactionResult = await response.json();
            console.log('[RentReceiptModal] Transaction créée:', transactionResult.transaction.id);
            
            // Invalider les queries pour rafraîchir les vues
            await queryClient.invalidateQueries({ queryKey: ['transactions'] });
            await queryClient.invalidateQueries({ queryKey: ['payments'] }); // Pour l'interface
            await queryClient.invalidateQueries({ queryKey: ['documents'] });
            await queryClient.invalidateQueries({ queryKey: ['property-stats', lease.propertyId] });
            await queryClient.invalidateQueries({ queryKey: ['lease-stats', lease.propertyId] });
            
            // Toast avec liens
            toast.success('Paiement enregistré avec succès', {
              description: 'Transaction créée et quittance générée',
              action: {
                label: 'Voir la transaction',
                onClick: () => {
                  // TODO: Naviguer vers la transaction
                  console.log('Transaction ID:', transactionResult.transaction.id);
                }
              }
            });
          } else {
            const error = await response.json();
            console.error('[RentReceiptModal] Erreur API:', error);
            toast.error(error.error || 'Erreur lors de l\'enregistrement du paiement');
          }
        } catch (error) {
          console.error('[RentReceiptModal] Erreur lors de l\'enregistrement du paiement:', error);
          toast.error('Erreur lors de l\'enregistrement du paiement');
          // Ne pas bloquer la génération de quittance si l'enregistrement échoue
        }
      }

      // Générer le PDF côté client (toujours pour le téléchargement)
      let pdfBlob = null;
      let fileName = `quittance_${monthLabel.toLowerCase()}_${selectedYear}_${lease.Tenant.lastName}.pdf`;
      
      if (!recordPayment) {
        // Générer le PDF côté client normalement
        pdfBlob = await pdf(<RentReceiptPDF {...receiptData} />).toBlob();
      } else {
        // Si paiement enregistré, on a déjà généré le PDF pour l'API, on le regénère pour le téléchargement
        pdfBlob = await pdf(<RentReceiptPDF {...receiptData} />).toBlob();
      }

      // Si envoi par email activé : NE PAS télécharger le PDF, juste créer le .eml
      if (sendEmail && lease.Tenant?.email && pdfBlob) {
        const formatCurrency = (amount: number) => {
          return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
        };

        const total = rentAmount + chargesAmount;
        const paymentDateFr = new Date(paymentDate).toLocaleDateString('fr-FR');
        
        const templateData = {
          tenantName: `${lease.Tenant.firstName} ${lease.Tenant.lastName}`,
          pdfUrl: '', // Pas utilisé en mode .eml
          monthName: monthLabel,
          year: selectedYear,
          rentFr: formatCurrency(rentAmount),
          chargesFr: formatCurrency(chargesAmount),
          totalFr: formatCurrency(total),
          paymentDateFr,
          landlordName: landlord.fullName,
        };

        const textBody = receiptText(templateData);
        const htmlBody = receiptHtml(templateData, true); // withAttachment = true

        await createEml({
          from: `${landlord.fullName} <${landlord.email}>`,
          to: lease.Tenant.email,
          bcc: sendCopy ? landlord.email : undefined,
          subject: emailSubject,
          text: textBody,
          html: htmlBody,
          attachments: [{
            filename: fileName,
            blob: pdfBlob,
          }],
        });

        // Logger l'envoi EML
        await fetch('/api/email/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leaseId: lease.id,
            tenantId: lease.tenantId,
            type: 'RECEIPT',
            mode: 'EML',
            to: lease.Tenant.email,
            subject: emailSubject,
          }),
        });

        toast.success('Email .eml créé avec succès !', {
          description: 'Ouvrez le fichier .eml dans votre client mail pour envoyer.',
        });
      } else {
        // Mode normal : télécharger le PDF
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        if (recordPayment) {
          toast.success('Paiement enregistré et quittance téléchargée avec succès !', {
            description: 'La quittance PDF a été générée, attachée à la transaction et téléchargée.',
          });
        } else {
          toast.success('Quittance générée et téléchargée avec succès !');
        }
      }

      onClose();
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast.error('Erreur lors de la génération de la quittance');
    } finally {
      setIsGenerating(false);
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-neutral-900">
            Générer une quittance de loyer
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Informations du bail */}
          <div className="bg-neutral-50 p-4 rounded-lg">
            <h3 className="font-medium text-neutral-900 mb-2">Bail sélectionné</h3>
            <div className="text-sm text-neutral-600">
              <p><strong>Bien:</strong> {lease.Property?.name || 'N/A'}</p>
              <p><strong>Locataire:</strong> {lease.Tenant?.firstName} {lease.Tenant?.lastName}</p>
            </div>
          </div>

          {/* Montants éditables */}
          <div className="space-y-3">
            <h3 className="font-medium text-neutral-900">Montants de la quittance</h3>
            
            {/* Loyer */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Loyer (€)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rentAmount}
                onChange={(e) => setRentAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
                placeholder="0.00"
              />
            </div>

            {/* Charges */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Charges (€)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={chargesAmount}
                onChange={(e) => setChargesAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
                placeholder="0.00"
              />
            </div>

            {/* Total */}
            <div className="pt-2 border-t border-neutral-200">
              <p className="text-sm text-neutral-600">
                <strong>Total quittance : {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(rentAmount + chargesAmount)}</strong>
              </p>
            </div>
          </div>

          {/* Sélection du mois */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Mois de la quittance
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sélection de l'année */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Année
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - 2 + i;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Date de paiement */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Date de paiement
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
            />
          </div>

          {/* Enregistrer le paiement */}
          <div className="border-t border-neutral-200 pt-4 mt-4">
            <div className="flex items-center space-x-2 mb-3">
              <input
                type="checkbox"
                id="recordPayment"
                checked={recordPayment}
                onChange={(e) => setRecordPayment(e.target.checked)}
                className="w-4 h-4 text-success bg-base-200 border-base-300 rounded focus:ring-green-500"
              />
              <label htmlFor="recordPayment" className="text-sm font-medium text-neutral-700">
                Enregistrer ce paiement
              </label>
            </div>
            {recordPayment && (
              <p className="ml-6 text-xs text-neutral-600">
                Un paiement sera créé pour {months.find(m => m.value === selectedMonth)?.label} {selectedYear} ({new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(rentAmount + chargesAmount)})
              </p>
            )}
          </div>

          {/* Bloc envoi par email */}
          <div className="border-t border-neutral-200 pt-4 mt-4">
            <div className="flex items-center space-x-2 mb-3">
              <input
                type="checkbox"
                id="sendEmail"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                disabled={!lease.Tenant?.email}
                className="w-4 h-4 text-primary bg-base-200 border-base-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="sendEmail" className="text-sm font-medium text-neutral-700 flex items-center gap-2">
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
                    id="sendCopy"
                    checked={sendCopy}
                    onChange={(e) => setSendCopy(e.target.checked)}
                    className="w-4 h-4 text-primary"
                  />
                  <label htmlFor="sendCopy" className="text-xs text-neutral-700">
                    S'envoyer une copie (BCC)
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex items-center justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-neutral-600 hover:text-neutral-800 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleGenerateReceipt}
            disabled={isGenerating}
            className="inline-flex items-center px-4 py-2 bg-primary text-base-100 rounded-md hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Génération...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Générer la quittance
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
