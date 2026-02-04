import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';

function decodeRedirectFromState(state: string | null): string | null {
  if (!state) return null;
  try {
    const decoded = JSON.parse(
      decodeURIComponent(Buffer.from(state, 'base64').toString('utf-8'))
    );
    const redirect = typeof decoded?.redirect === 'string' ? decoded.redirect : null;
    if (redirect && redirect.startsWith('/')) {
      return redirect;
    }
    return null;
  } catch (error) {
    console.warn('[Auth Callback] Impossible de décoder le state OAuth:', error);
    return null;
  }
}

function buildOrganizationSlug(seed: string) {
  const base = seed
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `org-${base || 'portfolio'}-${suffix}`;
}

async function ensureOrganizationForUser(userId: string, name?: string | null, email?: string | null) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (user?.organizationId) {
    return user.organizationId;
  }

  const organization = await prisma.organization.create({
    data: {
      name: name || email || 'Portefeuille',
      slug: buildOrganizationSlug(email || name || userId),
      ownerUserId: userId,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { organizationId: organization.id },
  });

  return organization.id;
}

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

/**
 * Route de callback après authentification Supabase
 * Synchronise l'utilisateur Supabase avec la base Prisma
 */
export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');

    if (!code) {
      console.error('[Auth Callback] Code manquant');
      return NextResponse.redirect(new URL('/login?error=missing_code', requestUrl.origin));
    }

    console.log('[Auth Callback] Échange du code OAuth contre une session en cours...');

    // Échanger le code contre une session
    const supabase = await createServerClient();
    const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

    if (sessionError || !session) {
      console.error('[Auth Callback] Erreur session:', sessionError);
      return NextResponse.redirect(new URL('/login?error=session_failed', requestUrl.origin));
    }

    console.log('[Auth Callback] Session Supabase obtenue, vérification de l\'utilisateur...');

    const { user } = session;
    console.log('[Auth Callback] Payload Supabase user', {
      id: user?.id,
      email: user?.email,
      hasUserMetadata: Boolean(user?.user_metadata),
      identitiesCount: user?.identities?.length ?? 0,
    });

    // ➤ Extraction robuste de l’email pour Google OAuth
    const email =
      user.email ||
      user.user_metadata?.email ||
      user.identities?.[0]?.identity_data?.email ||
      null;

    if (!email) {
      console.error('[Auth Callback] Aucun email récupérable via OAuth');
      return NextResponse.redirect(new URL('/login?error=no_email', requestUrl.origin));
    }

    console.log('[Auth Callback] Utilisateur Supabase:', {
      id: user.id,
      email,
    });

    // Synchroniser avec Prisma
    // 1) Chercher un utilisateur existant par supabaseId OU email
    let prismaUser = await prisma.user.findFirst({
      where: {
        OR: [
          { supabaseId: user.id },
          { email },
        ],
      },
    });

    if (prismaUser) {
      // Utilisateur existant : mettre à jour supabaseId si nécessaire
      if (!prismaUser.supabaseId) {
        console.log('[Auth Callback] Mise à jour supabaseId pour utilisateur existant');
        prismaUser = await prisma.user.update({
          where: { id: prismaUser.id },
          data: {
            supabaseId: user.id,
            emailVerified: new Date(), // Marquer l'email comme vérifié
          },
        });
      }
    } else {
      // Nouvel utilisateur : créer l'enregistrement
      console.log('[Auth Callback] Création d\'un nouvel utilisateur');
      
      // ⚠️ AUTO-PROMOTION ADMIN (décommentez et modifiez l'email pour votre premier admin)
      // const ADMIN_EMAILS = ['votre-email@exemple.com'];
      // const isFirstAdmin = ADMIN_EMAILS.includes(user.email);
      
      // Vérifier s'il existe déjà un admin (sinon, promouvoir le premier utilisateur)
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' },
      });
      
      const shouldBeAdmin = adminCount === 0; // Premier utilisateur = ADMIN
      
      // ⚠️ IMPORTANT : Créer l'organisation AVANT l'utilisateur pour éviter l'erreur de clé étrangère
      // Le schéma Prisma a organizationId avec @default("default"), mais cette organisation n'existe pas après nettoyage
      const userDisplayName = user.user_metadata?.name || email.split('@')[0] || 'Utilisateur';
      const organizationSlug = buildOrganizationSlug(email || userDisplayName);
      
      // Créer l'organisation d'abord
      const organization = await prisma.organization.create({
        data: {
          name: userDisplayName || email || 'Portefeuille',
          slug: organizationSlug,
          ownerUserId: null, // Sera mis à jour après création de l'utilisateur
        },
      });
      
      console.log('[Auth Callback] Organisation créée:', organization.id);
      
      // Maintenant créer l'utilisateur avec le bon organizationId
      prismaUser = await prisma.user.create({
        data: {
          supabaseId: user.id,
          email,
          name: userDisplayName,
          emailVerified: new Date(),
          role: shouldBeAdmin ? 'ADMIN' : 'USER',
          organizationId: organization.id, // ✅ Organisation existante
        },
      });

      // Mettre à jour l'organisation pour définir le propriétaire
      await prisma.organization.update({
        where: { id: organization.id },
        data: { ownerUserId: prismaUser.id },
      });

      if (shouldBeAdmin) {
        console.log('🎉 [Auth Callback] Premier utilisateur créé en tant qu\'ADMIN:', prismaUser.id);
      } else {
        console.log('[Auth Callback] Utilisateur créé:', prismaUser.id);
      }
    }

    // Pour un utilisateur existant, s'assurer qu'il a une organisation
    const organizationId = await ensureOrganizationForUser(
      prismaUser.id,
      prismaUser.name,
      prismaUser.email
    );

    // Redirection finale forcée vers l'App Shell
    return NextResponse.redirect(new URL('/app', requestUrl.origin));

  } catch (error) {
    console.error('[Auth Callback] Erreur complète:', error);
    console.error('[Auth Callback] Stack trace:', error instanceof Error ? error.stack : 'N/A');
    console.error('[Auth Callback] Message:', error instanceof Error ? error.message : String(error));
    
    // Rediriger avec plus de détails sur l'erreur
    const errorMessage = error instanceof Error ? error.message : 'unknown';
    const errorUrl = new URL('/login', request.url);
    errorUrl.searchParams.set('error', 'callback_error');
    errorUrl.searchParams.set('details', errorMessage.substring(0, 100));
    
    return NextResponse.redirect(errorUrl);
  }
}

