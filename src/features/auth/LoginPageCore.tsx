'use client';

/**
 * Composant core unifié pour la page de login
 * Utilisé à la fois pour le mode normal et le mode app-shell
 * Design de référence : page de login normale avec animation Rive
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chrome } from 'lucide-react';
import {
  useRive,
  useStateMachineInput,
  Fit,
  Alignment,
  Layout,
} from '@rive-app/react-canvas';
import { createBrowserClient } from '@/lib/supabase';
import { useAppAuth } from '@/features/auth/useAppAuth';

const STATE_MACHINE_NAME = 'Login Machine';
const RIVE_SRC = '/rive/login-teddy.riv';
const REMOTE_RIVE_SRC =
  'https://raw.githubusercontent.com/rive-app/rive-use-cases/main-archive/public/login-teddy.riv';

export type LoginMode = 'normal' | 'app-shell';

export interface LoginPageCoreProps {
  mode: LoginMode;
  redirectPath?: string;
  // Callback optionnel après succès (pour app-shell)
  onLoginSuccess?: () => void;
  // Badge personnalisé (optionnel)
  badge?: string;
  // Titre personnalisé (optionnel)
  title?: string;
  // Sous-titre personnalisé (optionnel)
  subtitle?: string;
  // Footer personnalisé (optionnel)
  footer?: React.ReactNode;
}

export function LoginPageCore({
  mode,
  redirectPath,
  onLoginSuccess,
  badge,
  title,
  subtitle,
  footer,
}: LoginPageCoreProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [inputLookMultiplier, setInputLookMultiplier] = useState(0);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const [riveSrc, setRiveSrc] = useState<string>(RIVE_SRC);

  // Pour le mode app-shell, utiliser useAppAuth pour la gestion offline
  // Note: on doit toujours appeler le hook, mais on ne l'utilise que si mode === 'app-shell'
  const appAuth = useAppAuth();
  const isOffline = mode === 'app-shell' ? (appAuth.isOffline ?? false) : false;

  // Valeurs par défaut selon le mode
  const defaultBadge = badge ?? (mode === 'app-shell' ? 'SmartImmo • App Shell' : 'SmartImmo • Auth 2.0');
  const defaultTitle = title ?? (mode === 'app-shell' ? 'Connexion' : 'Ravis de vous revoir 👋');
  const defaultSubtitle = subtitle ?? (mode === 'app-shell' 
    ? 'Connectez-vous pour accéder à SmartImmo en mode App Shell.'
    : 'Connectez-vous pour reprendre vos opérations SmartImmo.');

  // Charger l'animation Rive
  useEffect(() => {
    let cancelled = false;

    fetch(RIVE_SRC, { method: 'HEAD' })
      .then((res) => {
        if (!res.ok && !cancelled) {
          setRiveSrc(REMOTE_RIVE_SRC);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRiveSrc(REMOTE_RIVE_SRC);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const riveParams = useMemo(
    () => ({
      src: riveSrc,
      stateMachines: STATE_MACHINE_NAME,
      autoplay: true,
      layout: new Layout({
        fit: Fit.Cover,
        alignment: Alignment.Center,
      }),
    }),
    [riveSrc]
  );

  const { rive, RiveComponent } = useRive(riveParams, undefined, [riveSrc]);

  const isCheckingInput = useStateMachineInput(rive, STATE_MACHINE_NAME, 'isChecking');
  const numLookInput = useStateMachineInput(rive, STATE_MACHINE_NAME, 'numLook');
  const trigSuccessInput = useStateMachineInput(rive, STATE_MACHINE_NAME, 'trigSuccess');
  const trigFailInput = useStateMachineInput(rive, STATE_MACHINE_NAME, 'trigFail');

  useEffect(() => {
    if (emailInputRef.current && !inputLookMultiplier) {
      setInputLookMultiplier(emailInputRef.current.offsetWidth / 100);
    }
  }, [emailInputRef, inputLookMultiplier]);

  const updateLookDirection = (length: number) => {
    if (!numLookInput || !inputLookMultiplier) return;
    numLookInput.value = Math.min(100, length * inputLookMultiplier);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (isCheckingInput && !isCheckingInput.value) {
      isCheckingInput.value = true;
    }
    updateLookDirection(value.length);
  };

  const handleEmailFocus = () => {
    if (isCheckingInput) {
      isCheckingInput.value = true;
    }
    updateLookDirection(email.length);
  };

  const handleEmailBlur = () => {
    if (isCheckingInput) {
      isCheckingInput.value = false;
    }
  };

  // Gérer la connexion Google
  const handleGoogleLogin = async () => {
    // Vérifier offline pour app-shell
    if (mode === 'app-shell' && isOffline) {
      setMessage({ type: 'error', text: 'Connexion impossible hors-ligne' });
      trigFailInput?.fire();
      return;
    }

    setMessage(null);
    setGoogleLoading(true);

    try {
      const supabase = createBrowserClient();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      
      // Déterminer la redirection selon le mode
      let finalRedirect: string;
      if (mode === 'app-shell') {
        // Mode app-shell : rediriger vers /app?view=dashboard ou la vue demandée
        if (redirectPath && redirectPath.startsWith('/app')) {
          // Si redirectPath est déjà une URL /app, l'utiliser directement
          finalRedirect = redirectPath;
        } else {
          // Sinon, extraire la vue ou utiliser dashboard par défaut
          const view = redirectPath?.includes('view=') 
            ? redirectPath.split('view=')[1]?.split('&')[0] || 'dashboard'
            : redirectPath || 'dashboard';
          finalRedirect = `/app?view=${view}`;
        }
      } else {
        // Mode normal : utiliser redirectPath ou /dashboard
        finalRedirect = redirectPath && redirectPath.startsWith('/') ? redirectPath : '/dashboard';
      }

      const redirectTo = `${appUrl}/auth/callback?redirect=${encodeURIComponent(finalRedirect)}`;
      
      // Pour le mode normal, utiliser state pour passer le redirect
      const safeRedirect = redirectPath && redirectPath.startsWith('/') ? redirectPath : undefined;
      const statePayload = safeRedirect && mode === 'normal'
        ? btoa(encodeURIComponent(JSON.stringify({ redirect: safeRedirect })))
        : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            ...(statePayload ? { state: statePayload } : {}),
          },
        },
      });

      if (error) {
        throw error;
      }
      
      trigSuccessInput?.fire();
      
      // Callback optionnel pour app-shell
      if (mode === 'app-shell' && onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (error: any) {
      console.error('Erreur lors de la connexion Google:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Impossible de démarrer la connexion Google. Réessayez.',
      });
      trigFailInput?.fire();
    } finally {
      setGoogleLoading(false);
    }
  };

  // Gérer l'envoi du magic link (mode normal uniquement)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setMessage({ type: 'error', text: 'Veuillez entrer votre email' });
      trigFailInput?.fire();
      return;
    }

    // En mode app-shell, on ne supporte pas le magic link
    if (mode === 'app-shell') {
      setMessage({ type: 'error', text: 'Veuillez utiliser la connexion Google' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const supabase = createBrowserClient();
      const safeRedirect =
        redirectPath && redirectPath.startsWith('/') ? redirectPath : undefined;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const callbackBase = `${appUrl}/auth/callback`;
      const callbackUrl = safeRedirect
        ? `${callbackBase}?redirect=${encodeURIComponent(safeRedirect)}`
        : callbackBase;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: callbackUrl,
        },
      });

      if (error) {
        throw error;
      }

      setMessage({
        type: 'success',
        text: '✅ Un lien de connexion vous a été envoyé par email. Vérifiez votre boîte de réception.',
      });
      trigSuccessInput?.fire();
      setEmail('');
    } catch (error: any) {
      console.error("Erreur lors de l'envoi du magic link:", error);
      setMessage({
        type: 'error',
        text: error.message || 'Une erreur est survenue. Veuillez réessayer.',
      });
      trigFailInput?.fire();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#E3EEFA] px-4 py-12 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6">
        <div className="text-center text-slate-800">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            {defaultBadge}
          </p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold">{defaultTitle}</h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600">
            {defaultSubtitle}
          </p>
        </div>

        <div className="flex w-full justify-center">
          <div className="relative w-full max-w-4xl rounded-[40px] bg-[#E7F1FA] p-6 shadow-2xl shadow-slate-900/10">
            <div className="relative mx-auto flex flex-col items-center">
              <div className="relative w-full max-w-4xl overflow-hidden rounded-[40px] bg-[#CFE4F9]">
                <div className="h-[460px] w-full bg-gradient-to-b from-[#DFF1FF] to-[#CFE4F9]">
                  <RiveComponent className="h-full w-full" />
                </div>
              </div>

              <form
                onSubmit={handleSubmit}
                className="relative -mt-24 w-full max-w-md rounded-[32px] bg-white/70 p-8 shadow-2xl backdrop-blur-lg"
              >
                <div className="space-y-6">
                  {/* Message d'erreur offline (app-shell uniquement) */}
                  {mode === 'app-shell' && isOffline && (
                    <div className="alert alert-warning">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="stroke-current shrink-0 h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <span>Mode hors-ligne : la connexion nécessite une connexion internet.</span>
                    </div>
                  )}

                  {/* Champ email (mode normal uniquement) */}
                  {mode === 'normal' && (
                    <input
                      ref={emailInputRef}
                      type="email"
                      placeholder="tom.dub02@gmail.com"
                      className="input input-bordered w-full bg-white/80 backdrop-blur"
                      value={email}
                      onChange={handleEmailChange}
                      onFocus={handleEmailFocus}
                      onBlur={handleEmailBlur}
                      disabled={loading || googleLoading}
                      required
                      aria-label="Email professionnel"
                    />
                  )}

                  {/* Messages */}
                  {message && (
                    <div
                      className={`alert mt-4 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}
                    >
                      <span>{message.text}</span>
                    </div>
                  )}

                  {/* Bouton magic link (mode normal uniquement) */}
                  {mode === 'normal' && (
                    <button
                      type="submit"
                      className={`btn btn-primary mt-2 w-full ${loading ? 'loading' : ''}`}
                      disabled={loading || googleLoading}
                    >
                      {loading ? 'Envoi en cours...' : 'Envoyer le lien de connexion'}
                    </button>
                  )}

                  {/* Séparateur (mode normal uniquement) */}
                  {mode === 'normal' && (
                    <div className="my-4 flex items-center gap-4 text-base-content/40">
                      <div className="h-px flex-1 bg-base-200" />
                      <span className="text-xs uppercase tracking-widest">ou</span>
                      <div className="h-px flex-1 bg-base-200" />
                    </div>
                  )}

                  {/* Bouton Google */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className={`btn ${mode === 'app-shell' ? 'btn-primary' : 'btn-outline'} w-full ${googleLoading ? 'loading' : ''}`}
                    disabled={googleLoading || loading || (mode === 'app-shell' && isOffline)}
                  >
                    {googleLoading ? (
                      'Connexion...'
                    ) : (
                      <span className="flex items-center gap-2">
                        <Chrome className="w-4 h-4" />
                        {mode === 'app-shell' ? 'Se connecter avec Google' : 'Continuer avec Google'}
                      </span>
                    )}
                  </button>

                  <p className="mt-6 text-center text-xs text-base-content/50">
                    En continuant, vous acceptez nos conditions d&apos;utilisation et notre politique de confidentialité.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Footer */}
        {footer || (mode === 'normal' && (
          <p className="text-center text-sm text-slate-500">
            Besoin d&apos;un compte ? Contactez un administrateur SmartImmo pour activer votre accès.
          </p>
        ))}
      </div>
    </div>
  );
}
