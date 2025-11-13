'use client';

import React from 'react';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import LeasePdf from '@/pdf/LeasePdf';
import { Button } from '@/components/ui/Button';

interface LeasePdfGeneratorProps {
  lease: any;
  onPdfGenerated?: (pdfBlob: Blob) => void;
  showViewer?: boolean;
  showDownloadButton?: boolean;
  buttonText?: string;
}

export default function LeasePdfGenerator({ 
  lease, 
  onPdfGenerated,
  showViewer = false,
  showDownloadButton = true,
  buttonText = "Télécharger le PDF"
}: LeasePdfGeneratorProps) {
  if (!lease) return null;

  return (
    <div className="space-y-4">
      {showViewer && (
        <div className="border rounded-lg overflow-hidden">
          <PDFViewer width="100%" height="600px">
            <LeasePdf lease={lease} />
          </PDFViewer>
        </div>
      )}
      
      {showDownloadButton && (
        <PDFDownloadLink 
          document={<LeasePdf lease={lease} />} 
          fileName={`bail-${lease.Property?.name || lease.id}.pdf`}
          className="inline-block"
        >
          {({ blob, url, loading, error }) => {
            if (loading) return (
              <Button disabled>
                Génération du PDF...
              </Button>
            );
            
            if (error) return (
              <Button variant="outline" className="text-red-600">
                Erreur de génération
              </Button>
            );
            
            // Appeler le callback si fourni
            if (blob && onPdfGenerated) {
              onPdfGenerated(blob);
            }
            
            return (
              <Button>
                {buttonText}
              </Button>
            );
          }}
        </PDFDownloadLink>
      )}
    </div>
  );
}
