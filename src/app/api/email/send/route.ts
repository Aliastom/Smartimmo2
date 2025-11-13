import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { to, subject, html, attachments, leaseId, tenantId, type } = await req.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Configuration de l'email
    const emailData: any = {
      from: process.env.RESEND_FROM_EMAIL || 'SmartImmo <noreply@smartimmo.app>',
      to,
      subject,
      html,
    };

    // Ajouter les pièces jointes si présentes
    if (attachments && attachments.length > 0) {
      emailData.attachments = attachments.map((att: any) => ({
        filename: att.filename,
        path: att.url.startsWith('http') ? att.url : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${att.url}`,
      }));
    }

    // Envoyer l'email via Resend
    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      console.error('Resend error:', error);
      throw new Error(error.message || 'Erreur lors de l\'envoi de l\'email');
    }

    // Enregistrer dans les logs
    await prisma.emailLog.create({
      data: {
        leaseId: leaseId || null,
        tenantId: tenantId || null,
        type: type || 'LEASE',
        mode: 'HTML',
        to,
        subject,
      },
    });

    return NextResponse.json({ 
      success: true, 
      messageId: data?.id,
      message: 'Email envoyé avec succès'
    });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json({ 
      error: 'Erreur lors de l\'envoi de l\'email',
      details: error.message 
    }, { status: 500 });
  }
}

