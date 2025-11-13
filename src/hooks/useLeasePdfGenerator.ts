'use client';

import { useState } from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import LeasePdf from '@/pdf/LeasePdf';
import { createEml } from '@/lib/eml';

export function useLeasePdfGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateLeasePdfAndEml = async (lease: any, tenantEmail?: string) => {
    setIsGenerating(true);
    setError(null);

    try {
      // Générer le PDF
      const pdfBuffer = await renderToBuffer(React.createElement(LeasePdf, { lease }));
      const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
      
      // Créer et télécharger le fichier EML avec le PDF en pièce jointe
      await createEml({
        from: 'noreply@smartimmo.fr',
        to: tenantEmail || lease.Tenant?.email || 'tenant@example.com',
        subject: `Bail à signer - ${lease.Property?.name}`,
        text: `Bonjour ${lease.Tenant?.firstName} ${lease.Tenant?.lastName},

Veuillez trouver ci-joint votre bail à signer pour le bien ${lease.Property?.name}.

Adresse : ${lease.Property?.address}
Loyer : ${lease.rentAmount}€/mois
Charges : ${lease.charges || 0}€/mois
Début du bail : ${new Date(lease.startDate).toLocaleDateString('fr-FR')}
${lease.endDate ? `Fin du bail : ${new Date(lease.endDate).toLocaleDateString('fr-FR')}` : ''}
Caution : ${lease.deposit || 0}€

Merci de signer le document PDF ci-joint et de nous le retourner.

Cordialement,
L'équipe Smartimmo`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">Bail à signer - ${lease.Property?.name}</h2>
            <p>Bonjour <strong>${lease.Tenant?.firstName} ${lease.Tenant?.lastName}</strong>,</p>
            <p>Veuillez trouver ci-joint votre bail à signer pour le bien :</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p><strong>Adresse :</strong> ${lease.Property?.address}</p>
              <p><strong>Loyer :</strong> ${lease.rentAmount}€/mois</p>
              <p><strong>Charges :</strong> ${lease.charges || 0}€/mois</p>
              <p><strong>Début du bail :</strong> ${new Date(lease.startDate).toLocaleDateString('fr-FR')}</p>
              ${lease.endDate ? `<p><strong>Fin du bail :</strong> ${new Date(lease.endDate).toLocaleDateString('fr-FR')}</p>` : ''}
              <p><strong>Caution :</strong> ${lease.deposit || 0}€</p>
            </div>
            <p><strong>📎 Pièce jointe :</strong> Le bail à signer est disponible en pièce jointe (PDF)</p>
            <p>Merci de signer le document et de nous le retourner.</p>
            <br>
            <p>Cordialement,<br><strong>L'équipe Smartimmo</strong></p>
          </div>
        `,
        attachments: [{
          filename: `bail-${lease.Property?.name || lease.id}.pdf`,
          blob: pdfBlob,
          mime: 'application/pdf'
        }]
      });

      return {
        success: true,
        pdfBlob
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la génération';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateLeasePdfAndEml,
    isGenerating,
    error
  };
}
