/**
 * Construit un lien mailto avec les paramètres encodés
 */
export const buildMailto = ({ 
  to, 
  subject, 
  body, 
  bcc 
}: { 
  to: string; 
  subject: string; 
  body: string; 
  bcc?: string;
}) => {
  const params = new URLSearchParams({
    subject,
    body,
  });
  
  if (bcc) {
    params.append('bcc', bcc);
  }
  
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
};

/**
 * Template plaintext pour quittance (mailto)
 */
export const receiptPlainTemplate = (p: {
  tenantName: string;
  pdfUrl: string;
  monthName: string;
  year: number;
  rentFr: string;
  chargesFr: string;
  totalFr: string;
  paymentDateFr: string;
  landlordName: string;
}) => `Bonjour ${p.tenantName},

Votre quittance de loyer est disponible :
${p.pdfUrl}

• Mois : ${p.monthName} ${p.year}
• Loyer : ${p.rentFr} • Charges : ${p.chargesFr} • Total : ${p.totalFr}
• Paiement : ${p.paymentDateFr}

Cordialement,
${p.landlordName}`;

/**
 * Template plaintext pour bail (mailto)
 */
export const leasePlainTemplate = (p: {
  tenantName: string;
  propertyName: string;
  pdfUrl: string;
  propertyAddress: string;
  startFr: string;
  endFr: string;
  rentFr: string;
  chargesFr: string;
  landlordName: string;
}) => `Bonjour ${p.tenantName},

Voici votre bail pour ${p.propertyName}.
Téléchargement :
${p.pdfUrl}

• Bien : ${p.propertyName}
• Adresse : ${p.propertyAddress}
• Période : ${p.startFr} → ${p.endFr}
• Loyer HC : ${p.rentFr} • Charges : ${p.chargesFr}

Cordialement,
${p.landlordName}`;

/**
 * Template HTML pour quittance
 */
export const receiptHtmlTemplate = (p: {
  tenantName: string;
  pdfUrl: string;
  monthName: string;
  year: number;
  rentFr: string;
  chargesFr: string;
  totalFr: string;
  paymentDateFr: string;
  landlordName: string;
}) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;line-height:1.5;color:#111">
  <div style="max-width:600px;margin:0 auto;background:#fff">
    <div style="background:#0076A3;color:#fff;padding:16px 20px;font-weight:700;font-size:18px">
      SmartImmo
    </div>
    <div style="padding:20px">
      <h2 style="margin:0 0 12px;color:#0076A3">Quittance de loyer</h2>
      <p style="margin:0 0 12px">Bonjour <strong>${p.tenantName}</strong>,</p>
      <p style="margin:0 0 16px">Votre quittance de loyer pour <strong>${p.monthName} ${p.year}</strong> est disponible en pièce jointe.</p>
      
      <div style="background:#f5f5f5;padding:12px;border-radius:6px;margin:16px 0">
        <div style="margin:4px 0">• <strong>Mois :</strong> ${p.monthName} ${p.year}</div>
        <div style="margin:4px 0">• <strong>Loyer :</strong> ${p.rentFr}</div>
        <div style="margin:4px 0">• <strong>Charges :</strong> ${p.chargesFr}</div>
        <div style="margin:4px 0">• <strong>Total :</strong> ${p.totalFr}</div>
        <div style="margin:4px 0">• <strong>Paiement :</strong> ${p.paymentDateFr}</div>
      </div>
      
      <div style="margin:20px 0">
        <a href="${p.pdfUrl}" style="background:#0076A3;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-weight:600">
          Télécharger la quittance (PDF)
        </a>
      </div>
      
      <p style="margin:20px 0 0;color:#666;font-size:14px">
        Cordialement,<br>
        ${p.landlordName}
      </p>
    </div>
    <div style="background:#f5f5f5;padding:12px;text-align:center;font-size:12px;color:#666">
      SmartImmo – Gestion locative simplifiée
    </div>
  </div>
</body>
</html>
`;

/**
 * Template HTML pour bail
 */
export const leaseHtmlTemplate = (p: {
  tenantName: string;
  propertyName: string;
  pdfUrl: string;
  propertyAddress: string;
  startFr: string;
  endFr: string;
  rentFr: string;
  chargesFr: string;
  landlordName: string;
}) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;line-height:1.5;color:#111">
  <div style="max-width:600px;margin:0 auto;background:#fff">
    <div style="background:#0076A3;color:#fff;padding:16px 20px;font-weight:700;font-size:18px">
      SmartImmo
    </div>
    <div style="padding:20px">
      <h2 style="margin:0 0 12px;color:#0076A3">Votre bail de location</h2>
      <p style="margin:0 0 12px">Bonjour <strong>${p.tenantName}</strong>,</p>
      <p style="margin:0 0 16px">Veuillez trouver ci-joint votre bail de location pour <strong>${p.propertyName}</strong>.</p>
      
      <div style="background:#f5f5f5;padding:12px;border-radius:6px;margin:16px 0">
        <div style="margin:4px 0">• <strong>Bien :</strong> ${p.propertyName}</div>
        <div style="margin:4px 0">• <strong>Adresse :</strong> ${p.propertyAddress}</div>
        <div style="margin:4px 0">• <strong>Période :</strong> ${p.startFr} → ${p.endFr}</div>
        <div style="margin:4px 0">• <strong>Loyer HC :</strong> ${p.rentFr}</div>
        <div style="margin:4px 0">• <strong>Charges :</strong> ${p.chargesFr}</div>
      </div>
      
      <div style="margin:20px 0">
        <a href="${p.pdfUrl}" style="background:#0076A3;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-weight:600">
          Télécharger le bail (PDF)
        </a>
      </div>
      
      <p style="margin:20px 0 0;color:#666;font-size:14px">
        Cordialement,<br>
        ${p.landlordName}
      </p>
    </div>
    <div style="background:#f5f5f5;padding:12px;text-align:center;font-size:12px;color:#666">
      SmartImmo – Gestion locative simplifiée
    </div>
  </div>
</body>
</html>
`;

