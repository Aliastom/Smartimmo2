import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // TODO: Ajouter protection authentification admin

  try {
    const { userId, email, name } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email manquant' },
        { status: 400 }
      );
    }

    // Générer le lien d'invitation
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const signInUrl = `${baseUrl}`; // TODO: Ajouter page de connexion quand auth sera réimplémenté

    // Envoyer l'email d'invitation via Resend
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'SmartImmo <noreply@smartimmo.app>',
          to: email,
          subject: 'Invitation à rejoindre SmartImmo',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #1f2937;">Bienvenue sur SmartImmo !</h1>
              <p>Bonjour ${name || email.split('@')[0]},</p>
              <p>Vous avez été invité à rejoindre SmartImmo, votre plateforme de gestion immobilière.</p>
              <p>Votre compte a été créé avec l'adresse email : <strong>${email}</strong></p>
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <a href="${signInUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  Se connecter à SmartImmo
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                Vous pouvez vous connecter avec votre compte Google ou en utilisant l'adresse email ${email}.
              </p>
              <p style="color: #6b7280; font-size: 14px;">
                Si vous avez des questions, n'hésitez pas à contacter un administrateur.
              </p>
              <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
                Cordialement,<br>
                L'équipe SmartImmo
              </p>
            </div>
          `,
          text: `
Bienvenue sur SmartImmo !

Bonjour ${name || email.split('@')[0]},

Vous avez été invité à rejoindre SmartImmo, votre plateforme de gestion immobilière.

Votre compte a été créé avec l'adresse email : ${email}

Pour vous connecter, visitez : ${signInUrl}

Vous pouvez vous connecter avec votre compte Google ou en utilisant l'adresse email ${email}.

Cordialement,
L'équipe SmartImmo
          `,
        });

        return NextResponse.json({
          success: true,
          message: 'Email d\'invitation envoyé avec succès',
        });
      } catch (error: any) {
        console.error('Error sending invitation email:', error);
        return NextResponse.json(
          { success: false, error: 'Erreur lors de l\'envoi de l\'email', details: error.message },
          { status: 500 }
        );
      }
    } else {
      // Si Resend n'est pas configuré, on log juste l'invitation
      console.log('Invitation email (RESEND_API_KEY not configured):', {
        to: email,
        name,
        signInUrl,
      });
      
      return NextResponse.json({
        success: true,
        message: 'Utilisateur créé (email non envoyé - RESEND_API_KEY non configuré)',
        signInUrl,
      });
    }
  } catch (error: any) {
    console.error('Error in invitation API:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Erreur lors de l\'invitation' },
      { status: 500 }
    );
  }
}

