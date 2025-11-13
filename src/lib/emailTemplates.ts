/**
 * Templates d'email pour quittances et baux
 */

export const receiptHtml = (p: {
  tenantName: string;
  pdfUrl?: string;
  monthName: string;
  year: number;
  rentFr: string;
  chargesFr: string;
  totalFr: string;
  paymentDateFr: string;
  landlordName: string;
}, withAttachment = false) => `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;line-height:1.5;color:#111">
  <div style="max-width:600px;margin:0 auto;background:#fff">
    <div style="background:#0076A3;color:#fff;padding:12px 16px;font-weight:700">SmartImmo</div>
    <div style="padding:16px">
      <h2 style="margin:0 0 8px;color:#0076A3">Quittance de loyer – ${p.monthName} ${p.year}</h2>
      <p>Bonjour <b>${p.tenantName}</b>,</p>
      <p>Votre quittance de loyer est disponible ${withAttachment ? '(voir pièce jointe)' : ''}.</p>
      <ul style="margin:12px 0">
        <li>Loyer : <b>${p.rentFr}</b> • Charges : <b>${p.chargesFr}</b> • Total : <b>${p.totalFr}</b></li>
        <li>Paiement : <b>${p.paymentDateFr}</b></li>
      </ul>
      ${withAttachment ? '' : `<p style="margin:16px 0">
        <a href="${p.pdfUrl}" style="background:#0076A3;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;display:inline-block">Télécharger le PDF</a>
      </p>`}
      <p style="margin-top:16px">Cordialement,<br>${p.landlordName}</p>
    </div>
    <div style="background:#f5f5f5;padding:8px;text-align:center;font-size:11px;color:#666">SmartImmo – Gestion locative</div>
  </div>
</body>
</html>`;

export const receiptText = (p: {
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

export const leaseHtml = (p: {
  tenantName: string;
  propertyName: string;
  pdfUrl?: string;
  propertyAddress: string;
  startFr: string;
  endFr: string;
  rentFr: string;
  chargesFr: string;
  landlordName: string;
}, withAttachment = false) => `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;line-height:1.5;color:#111">
  <div style="max-width:600px;margin:0 auto;background:#fff">
    <div style="background:#0076A3;color:#fff;padding:12px 16px;font-weight:700">SmartImmo</div>
    <div style="padding:16px">
      <h2 style="margin:0 0 8px;color:#0076A3">Votre bail de location</h2>
      <p>Bonjour <b>${p.tenantName}</b>,</p>
      <p>Voici votre bail pour <b>${p.propertyName}</b> ${withAttachment ? '(voir pièce jointe)' : ''}.</p>
      <ul style="margin:12px 0">
        <li>Bien : <b>${p.propertyName}</b></li>
        <li>Adresse : ${p.propertyAddress}</li>
        <li>Période : ${p.startFr} → ${p.endFr}</li>
        <li>Loyer HC : <b>${p.rentFr}</b> • Charges : <b>${p.chargesFr}</b></li>
      </ul>
      ${withAttachment ? '' : `<p style="margin:16px 0">
        <a href="${p.pdfUrl}" style="background:#0076A3;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;display:inline-block">Télécharger le bail (PDF)</a>
      </p>`}
      <p style="margin-top:16px">Cordialement,<br>${p.landlordName}</p>
    </div>
    <div style="background:#f5f5f5;padding:8px;text-align:center;font-size:11px;color:#666">SmartImmo – Gestion locative</div>
  </div>
</body>
</html>`;

export const leaseText = (p: {
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

