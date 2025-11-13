/**
 * Crée un fichier .eml (email) avec HTML, texte brut et pièces jointes
 * Compatible avec Outlook, Apple Mail, Thunderbird, etc.
 */
export async function createEml({
  from,
  to,
  bcc,
  subject,
  text,
  html,
  attachments
}: {
  from: string;
  to: string;
  bcc?: string;
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; blob?: Blob; url?: string; mime?: string }[];
}) {
  const CRLF = '\r\n';
  const alt = '=_alt_' + Math.random().toString(36).slice(2);
  const mix = '=_mix_' + Math.random().toString(36).slice(2);
  
  // Encoder l'en-tête en base64 UTF-8
  const encH = (s: string) => {
    return `=?utf-8?B?${btoa(unescape(encodeURIComponent(s)))}?=`;
  };
  
  // Quoted-printable encoding pour le corps
  const qp = (s: string) => {
    return s.replace(/=/g, '=3D').replace(/\r?\n/g, '=0D=0A');
  };

  // Convertir blob ou URL en base64
  async function toB64(a: { blob?: Blob; url?: string }) {
    let b: Blob;
    if (a.blob) {
      b = a.blob;
    } else if (a.url) {
      const fullUrl = a.url.startsWith('http') ? a.url : `${window.location.origin}${a.url}`;
      const r = await fetch(fullUrl);
      b = await r.blob();
    } else {
      return '';
    }
    
    const buf = await b.arrayBuffer();
    let bin = '';
    for (const byte of new Uint8Array(buf)) {
      bin += String.fromCharCode(byte);
    }
    return btoa(bin);
  }

  // Construire le fichier EML
  const lines: string[] = [];
  
  // En-têtes
  lines.push(`From: ${from}`);
  lines.push(`To: ${to}`);
  if (bcc) lines.push(`Bcc: ${bcc}`);
  lines.push(`Subject: ${encH(subject)}`);
  lines.push(`MIME-Version: 1.0`);
  lines.push(`Content-Type: multipart/mixed; boundary="${mix}"`);
  lines.push('');

  // Partie multipart/alternative (texte + HTML)
  lines.push(`--${mix}`);
  lines.push(`Content-Type: multipart/alternative; boundary="${alt}"`);
  lines.push('');
  
  // Texte brut
  lines.push(`--${alt}`);
  lines.push(`Content-Type: text/plain; charset="utf-8"`);
  lines.push(`Content-Transfer-Encoding: quoted-printable`);
  lines.push('');
  lines.push(qp(text));
  lines.push('');
  
  // HTML
  lines.push(`--${alt}`);
  lines.push(`Content-Type: text/html; charset="utf-8"`);
  lines.push(`Content-Transfer-Encoding: quoted-printable`);
  lines.push('');
  lines.push(qp(html));
  lines.push('');
  lines.push(`--${alt}--`);

  // Pièces jointes (PDF)
  if (attachments && attachments.length > 0) {
    for (const a of attachments) {
      const b64 = await toB64(a);
      if (b64) {
        const mime = a.mime || 'application/pdf';
        lines.push('');
        lines.push(`--${mix}`);
        lines.push(`Content-Type: ${mime}; name="${a.filename}"`);
        lines.push(`Content-Transfer-Encoding: base64`);
        lines.push(`Content-Disposition: attachment; filename="${a.filename}"`);
        lines.push('');
        lines.push(b64);
      }
    }
  }

  lines.push('');
  lines.push(`--${mix}--`);

  // Créer et télécharger le fichier .eml
  const emlContent = lines.join(CRLF);
  const blobMsg = new Blob([emlContent], { type: 'message/rfc822' });
  const url = URL.createObjectURL(blobMsg);
  
  // Nom de fichier propre
  const safe = subject.replace(/[^a-z0-9\-_\s]/gi, '_').replace(/\s+/g, ' ').trim();
  
  // Télécharger uniquement (pas de window.open)
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe}.eml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  
  // Nettoyer après un délai
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

