import { BRANDING, getLogoEmailUrl } from '@/lib/branding';

type LeaseEmailData = {
  tenantFirstName: string;
  tenantLastName: string;
  propertyAddress: string;
  rentAmount: number;
  chargesAmount: number;
  startDate: string;
  endDate?: string | null;
  depositAmount: number;
  downloadUrl?: string;
  supportEmail?: string;
};

const euro = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v || 0);

const frDate = (v?: string | null) => {
  if (!v) return 'Non définie';
  try {
    return new Date(v).toLocaleDateString('fr-FR');
  } catch {
    return 'Non définie';
  }
};

const escapeHtml = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function buildLeaseSignatureEmail(data: LeaseEmailData) {
  const subject = `Bail à signer - ${data.propertyAddress}`;
  const supportEmail = data.supportEmail || 'support@smartimmo.fr';
  const ctaUrl = data.downloadUrl || '#';

  const text = [
    `Bonjour ${data.tenantFirstName},`,
    '',
    'Votre bail est prêt à être signé.',
    '',
    'Merci de :',
    '1. Télécharger le document',
    '2. Le signer',
    '3. Nous le retourner',
    '',
    `Adresse : ${data.propertyAddress}`,
    `Loyer : ${euro(data.rentAmount)}`,
    `Charges : ${euro(data.chargesAmount)}`,
    `Date début : ${frDate(data.startDate)}`,
    `Date fin : ${frDate(data.endDate)}`,
    `Dépôt de garantie : ${euro(data.depositAmount)}`,
    '',
    `Télécharger le bail : ${ctaUrl}`,
    '',
    'Cordialement,',
    "L'équipe Smartimmo",
    `Support : ${supportEmail}`,
  ].join('\n');

  const logoUrl = getLogoEmailUrl();
  const html = `
<div style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border-radius:14px;box-shadow:0 6px 24px rgba(15,23,42,.08);overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;background:linear-gradient(135deg,#b100d6 0%,#6d28d9 100%);color:#fff;text-align:center;">
        ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(BRANDING.name)}" style="height:60px;margin-bottom:12px;display:inline-block;max-width:180px;object-fit:contain;" />` : ''}
        <div style="font-size:20px;font-weight:700;line-height:1.2;">${BRANDING.name}</div>
        <div style="font-size:13px;opacity:.9;margin-top:4px;">Bail à signer</div>
      </div>

      <div style="padding:24px;">
        <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#111827;">Bail à signer</h1>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
          Bonjour <strong>${escapeHtml(data.tenantFirstName)}</strong>,
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
          Votre bail est prêt à être signé.
        </p>
        <p style="margin:0 0 6px;font-size:15px;line-height:1.6;">Merci de :</p>
        <ol style="margin:0 0 20px 20px;padding:0;font-size:15px;line-height:1.7;">
          <li>Télécharger le document</li>
          <li>Le signer</li>
          <li>Nous le retourner</li>
        </ol>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 16px 10px;margin:0 0 22px;">
          <div style="font-size:13px;font-weight:700;color:#334155;margin-bottom:10px;">Résumé du bail</div>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:6px 0;color:#64748b;">Adresse</td><td style="padding:6px 0;text-align:right;font-weight:600;">${escapeHtml(data.propertyAddress)}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Loyer</td><td style="padding:6px 0;text-align:right;font-weight:600;">${euro(data.rentAmount)}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Charges</td><td style="padding:6px 0;text-align:right;font-weight:600;">${euro(data.chargesAmount)}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Date début</td><td style="padding:6px 0;text-align:right;font-weight:600;">${frDate(data.startDate)}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Date fin</td><td style="padding:6px 0;text-align:right;font-weight:600;">${frDate(data.endDate)}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Dépôt de garantie</td><td style="padding:6px 0;text-align:right;font-weight:600;">${euro(data.depositAmount)}</td></tr>
          </table>
        </div>

        <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#b100d6;color:#fff;text-decoration:none;border-radius:10px;padding:12px 18px;font-size:15px;font-weight:700;">
          📄 Télécharger le bail
        </a>

        <p style="margin:24px 0 0;font-size:14px;color:#334155;line-height:1.6;">
          Cordialement,<br/>
          <strong>L'équipe Smartimmo</strong><br/>
          Support : <a href="mailto:${escapeHtml(supportEmail)}" style="color:#6d28d9;text-decoration:none;">${escapeHtml(supportEmail)}</a>
        </p>
      </div>
    </div>
  </div>
</div>`;

  return { subject, text, html };
}

