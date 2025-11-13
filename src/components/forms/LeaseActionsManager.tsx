'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { pdf } from '@react-pdf/renderer';
import { RentReceiptPDF } from '@/components/pdf/RentReceiptPDF';
import { createEml } from '@/lib/eml';
import { receiptHtml, receiptText } from '@/lib/emailTemplates';
import { 
  Download,
  Receipt,
  X,
  Calendar
} from 'lucide-react';

interface Lease {
  id: string;
  propertyId: string;
  tenantId: string;
  type: string;
  furnishedType: string;
  startDate: string;
  endDate?: string;
  rentAmount: number;
  charges: number;
  deposit: number;
  paymentDay: number;
  status: string;
  notes?: string;
  signedPdfUrl?: string | null;
  property?: any;
  tenant?: any;
}

interface LeaseActionsManagerProps {
  lease: Lease;
  onClose: () => void;
  onSuccess?: () => void;
  initialAction?: 'generate-receipt' | 'download-pdf' | null;
}

export default function LeaseActionsManager({ lease, onClose, onSuccess, initialAction = null }: LeaseActionsManagerProps) {
  const [activeAction, setActiveAction] = useState<string | null>(initialAction);
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptData, setReceiptData] = useState({
    selectedMonth: new Date().getMonth() + 1,
    selectedYear: new Date().getFullYear(),
    rentAmount: lease.rentAmount,
    chargesAmount: lease.charges,
    paymentDate: new Date().toISOString().split('T')[0],
    generateReceipt: false,
    sendEmail: false,
  });

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



  const handleGenerateReceipt = async () => {
    setIsProcessing(true);
    try {
      // Récupérer les informations du profil utilisateur
      const profileResponse = await fetch('/api/profile');
      if (!profileResponse.ok) {
        alert('Impossible de récupérer les informations du profil');
        setIsProcessing(false);
        return;
      }
      const landlord = await profileResponse.json();

      // Vérifier les champs obligatoires
      if (!landlord.fullName || landlord.fullName.trim() === '') {
        alert('Nom du propriétaire manquant. Veuillez compléter votre profil sur http://localhost:3000/profil');
        setIsProcessing(false);
        return;
      }
      if (!landlord.city || landlord.city.trim() === '') {
        alert('Ville manquante. Veuillez compléter votre profil sur http://localhost:3000/profil');
        setIsProcessing(false);
        return;
      }
      
      // Avertissement si la signature est manquante (non bloquant)
      if (!landlord.signatureUrl) {
        console.warn('Signature électronique manquante. Vous pouvez l\'ajouter sur votre profil.');
      }

      // Préparer les données pour le PDF
      const monthLabel = months.find(m => m.value === receiptData.selectedMonth)?.label || 'Mois';
      const paymentDate = new Date(receiptData.paymentDate);
      
      const receiptDataForPDF = {
        month: monthLabel,
        year: receiptData.selectedYear,
        monthNumber: receiptData.selectedMonth, // Ajouter le numéro du mois
        propertyAddress: lease.Property?.address || 'Adresse non renseignée',
        tenantName: `${lease.Tenant?.firstName || ''} ${lease.Tenant?.lastName || ''}`.trim(),
        ownerName: landlord.fullName || 'Propriétaire',
        rent: receiptData.rentAmount,
        charges: receiptData.chargesAmount,
        paymentDate: paymentDate,
        paymentDay: lease.paymentDay || 1,
        signatureUrl: landlord.signatureUrl || null,
        city: landlord.city || 'Ville non définie', // Utiliser la ville du bailleur
        logoUrl: landlord.logoUrl || null, // Logo du bailleur si disponible
      };

      // Générer le PDF avec le template professionnel
      const pdfBlob = await pdf(<RentReceiptPDF {...receiptDataForPDF} />).toBlob();
      
      const fileName = `quittance_${monthLabel.toLowerCase()}_${receiptData.selectedYear}_${lease.Tenant?.lastName || 'locataire'}.pdf`;

      // Si envoi par email activé : créer le fichier .eml
      if (receiptData.sendEmail && lease.Tenant?.email) {
        const formatCurrency = (amount: number) => {
          return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
        };

        const total = receiptData.rentAmount + receiptData.chargesAmount;
        const paymentDateFr = paymentDate.toLocaleDateString('fr-FR');
        
        const templateData = {
          tenantName: `${lease.Tenant.firstName} ${lease.Tenant.lastName}`,
          pdfUrl: '', // Pas utilisé en mode .eml
          monthName: monthLabel,
          year: receiptData.selectedYear,
          rentFr: formatCurrency(receiptData.rentAmount),
          chargesFr: formatCurrency(receiptData.chargesAmount),
          totalFr: formatCurrency(total),
          paymentDateFr,
          landlordName: landlord.fullName || 'Propriétaire',
        };

        const textBody = receiptText(templateData);
        const htmlBody = receiptHtml(templateData, true); // withAttachment = true

        await createEml({
          from: `${landlord.fullName || 'Propriétaire'} <${landlord.email || 'proprietaire@example.com'}>`,
          to: lease.Tenant.email,
          subject: `Quittance de loyer - ${monthLabel} ${receiptData.selectedYear}`,
          text: textBody,
          html: htmlBody,
          attachments: [{
            filename: fileName,
            blob: pdfBlob,
          }],
        });

        alert('Fichier .eml généré avec succès ! Le PDF est inclus en pièce jointe.');
      } else {
        // Télécharger directement le PDF
        const link = document.createElement('a');
        link.href = URL.createObjectURL(pdfBlob);
        link.download = fileName;
        link.click();
        
        alert('Quittance PDF générée avec succès !');
      }

      // Si demandé, enregistrer comme paiement reçu
      if (receiptData.generateReceipt) {
        try {
          await fetch('/api/receipts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              leaseId: lease.id,
              month: receiptData.selectedMonth,
              year: receiptData.selectedYear,
              rentAmount: receiptData.rentAmount,
              chargesAmount: receiptData.chargesAmount,
              paymentDate: receiptData.paymentDate,
              recordPayment: true,
              sendEmail: false, // Déjà géré ci-dessus
            }),
          });
        } catch (error) {
          console.error('Error recording payment:', error);
          // Ne pas faire échouer toute l'opération pour cela
        }
      }

      onSuccess?.();
    } catch (error) {
      console.error('Error generating receipt:', error);
      alert('Erreur lors de la génération de la quittance');
    } finally {
      setIsProcessing(false);
      setActiveAction(null);
    }
  };


  const handleDownloadPDF = async () => {
    try {
      if (lease.signedPdfUrl) {
        const link = document.createElement('a');
        link.href = lease.signedPdfUrl;
        link.download = `bail-signe-${lease.id}.pdf`;
        link.click();
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Erreur lors du téléchargement');
    }
  };

  const handleWorkflowAction = async (action: string) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      let result = null;
      
      switch (action) {
        case 'cancel-send':
          const cancelResponse = await fetch(`/api/leases/${lease.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'BROUILLON' })
          });
          
          if (!cancelResponse.ok) {
            const errorData = await cancelResponse.json();
            throw new Error(errorData.error || 'Erreur lors de l\'annulation');
          }
          
          result = await cancelResponse.json();
          break;
      }
      
      // Fermer la modal et déclencher onSuccess
      onClose();
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (error) {
      console.error('Error executing workflow action:', error);
      alert(`Erreur lors de l'exécution de l'action: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsProcessing(false);
    }
  };



  const renderReceiptGeneration = () => (
    <div className="space-y-4">
      <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Receipt className="h-5 w-5 text-purple-600" />
          <span className="font-medium text-purple-900">Génération de quittance</span>
        </div>
        <p className="text-sm text-purple-800">
          Créez une quittance de loyer pour une période donnée.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mois
          </label>
          <select
            value={receiptData.selectedMonth}
            onChange={(e) => setReceiptData(prev => ({ ...prev, selectedMonth: parseInt(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {months.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Année
          </label>
          <input
            type="number"
            value={receiptData.selectedYear}
            onChange={(e) => setReceiptData(prev => ({ ...prev, selectedYear: parseInt(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Montant du loyer (€)
          </label>
          <input
            type="number"
            step="0.01"
            value={receiptData.rentAmount}
            onChange={(e) => setReceiptData(prev => ({ ...prev, rentAmount: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Montant des charges (€)
          </label>
          <input
            type="number"
            step="0.01"
            value={receiptData.chargesAmount}
            onChange={(e) => setReceiptData(prev => ({ ...prev, chargesAmount: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Date de paiement
        </label>
        <div className="relative">
          <input
            type="date"
            value={receiptData.paymentDate}
            onChange={(e) => setReceiptData(prev => ({ ...prev, paymentDate: e.target.value }))}
            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="generateReceipt"
            checked={receiptData.generateReceipt}
            onChange={(e) => setReceiptData(prev => ({ ...prev, generateReceipt: e.target.checked }))}
            className="mr-2"
          />
          <label htmlFor="generateReceipt" className="text-sm font-medium text-gray-700">
            Enregistrer comme paiement reçu
          </label>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="sendReceiptEmail"
            checked={receiptData.sendEmail}
            onChange={(e) => setReceiptData(prev => ({ ...prev, sendEmail: e.target.checked }))}
            className="mr-2"
          />
          <label htmlFor="sendReceiptEmail" className="text-sm font-medium text-gray-700">
            Générer un fichier .eml (avec PDF en pièce jointe)
          </label>
        </div>
        
        <div className="p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>📧 Fichier .eml :</strong> Crée un fichier email prêt à envoyer avec le PDF en pièce jointe. 
            Compatible avec Outlook, Apple Mail, Thunderbird, etc.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleGenerateReceipt} disabled={isProcessing}>
          {isProcessing ? 'Génération...' : 'Générer la quittance'}
        </Button>
        <Button variant="ghost" onClick={() => setActiveAction(null)}>
          Annuler
        </Button>
      </div>
    </div>
  );


  const renderDownloadPDF = () => (
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Download className="h-5 w-5 text-gray-600" />
          <span className="font-medium text-gray-900">Télécharger le bail signé</span>
        </div>
        <p className="text-sm text-gray-800">
          Téléchargez le PDF du bail signé par le locataire.
        </p>
      </div>

      {lease.signedPdfUrl ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm">PDF disponible</span>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              Le bail signé est disponible au téléchargement.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-yellow-50 rounded-lg">
          <p className="text-sm text-yellow-800">
            Aucun PDF signé n'est disponible pour ce bail.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="ghost" onClick={() => setActiveAction(null)}>
          Fermer
        </Button>
        {lease.signedPdfUrl && (
          <Button onClick={handleDownloadPDF}>
            Télécharger le PDF
          </Button>
        )}
      </div>
    </div>
  );


  const renderActionContent = () => {
    switch (activeAction) {
      case 'generate-receipt': return renderReceiptGeneration();
      case 'download-pdf': return renderDownloadPDF();
      default: return null;
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Actions du bail"
      size="lg"
      footer={
        !activeAction ? (
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Fermer
            </Button>
          </div>
        ) : null
      }
    >
      <div className="space-y-6">
        {!activeAction ? (
          <>
            {/* Informations du bail */}
            <Card>
              <CardHeader>
                <CardTitle>Informations du bail</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Bien</p>
                    <p className="font-medium">{lease.Property?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Locataire</p>
                    <p className="font-medium">
                      {lease.Tenant?.firstName} {lease.Tenant?.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Loyer mensuel</p>
                    <p className="font-medium">{lease.rentAmount.toFixed(2)} €</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Statut</p>
                    <Badge 
                      variant={lease.status === 'ACTIVE' ? 'success' : 'warning'}
                    >
                      {lease.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions disponibles */}
            <Card>
              <CardHeader>
                <CardTitle>Actions disponibles</CardTitle>
                <CardDescription>
                  Choisissez l'action que vous souhaitez effectuer
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-center gap-2"
                    onClick={() => setActiveAction('generate-receipt')}
                  >
                    <Receipt className="h-6 w-6 text-purple-500" />
                    <span className="font-medium">Générer quittance</span>
                    <span className="text-xs text-gray-500">Reçu de loyer</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-center gap-2"
                    onClick={() => setActiveAction('download-pdf')}
                    disabled={!lease.signedPdfUrl}
                  >
                    <Download className="h-6 w-6 text-gray-500" />
                    <span className="font-medium">Télécharger PDF</span>
                    <span className="text-xs text-gray-500">Bail signé</span>
                  </Button>

                  {/* Annuler l'envoi - seulement pour ENVOYÉ */}
                  {lease.status === 'ENVOYÉ' && (
                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-center gap-2 border-orange-200 text-orange-600 hover:bg-orange-50"
                      onClick={() => handleWorkflowAction('cancel-send')}
                      disabled={isProcessing}
                    >
                      <X className="h-6 w-6 text-orange-500" />
                      <span className="font-medium">
                        {isProcessing ? 'Annulation...' : 'Annuler l\'envoi'}
                      </span>
                      <span className="text-xs text-gray-500">Statut → BROUILLON</span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          renderActionContent()
        )}
      </div>
    </Modal>
  );
}
