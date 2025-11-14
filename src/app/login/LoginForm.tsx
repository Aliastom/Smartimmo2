'use client';

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

const STATE_MACHINE_NAME = 'Login Machine';
const LOCAL_RIVE_SRC = '/rive/login-teddy.riv';
const REMOTE_RIVE_SRC =
  'https://raw.githubusercontent.com/rive-app/rive-use-cases/main-archive/public/login-teddy.riv';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [inputLookMultiplier, setInputLookMultiplier] = useState(0);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const [riveSrc, setRiveSrc] = useState(REMOTE_RIVE_SRC);

  useEffect(() => {
    let cancelled = false;
    fetch(LOCAL_RIVE_SRC, { method: 'HEAD' })
      .then((res) => {
        if (!cancelled && res.ok) {
          setRiveSrc(LOCAL_RIVE_SRC);
        }
      })
      .catch(() => {
        /* ignore: fallback already remote */
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
  const isHandsUpInput = useStateMachineInput(rive, STATE_MACHINE_NAME, 'isHandsUp');

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

  const handlePasswordFocus = () => {
    if (isHandsUpInput) {
      isHandsUpInput.value = true;
    }
  };

  const handlePasswordBlur = () => {
    if (isHandsUpInput) {
      isHandsUpInput.value = false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setMessage({ type: 'error', text: 'Veuillez entrer votre email' });
      trigFailInput?.fire();
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback`,
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
      setPassword('');
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

  const handleGoogleLogin = async () => {
    setMessage(null);
    setGoogleLoading(true);

    try {
      const supabase = createBrowserClient();
      const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        throw error;
      }
      trigSuccessInput?.fire();
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

  return (
    <div className="flex w-full justify-center">
      <div className="relative w-full max-w-4xl rounded-[40px] bg-[#E7F1FA] p-6 shadow-2xl shadow-slate-900/10">
        <div className="relative mx-auto flex flex-col items-center">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-[32px] bg-[#CFE4F9]">
            <div className="h-[360px] w-full bg-gradient-to-b from-[#DFF1FF] to-[#CFE4F9]">
              <RiveComponent key={riveSrc} className="h-full w-full" />
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="relative -mt-24 w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl"
          >
            <div className="mb-6 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary/80">
                Auth sécurisée
              </p>
              <h1 className="mt-2 text-2xl font-bold text-base-content">Ravis de vous revoir 👋</h1>
              <p className="text-sm text-base-content/60">
                Envoi immédiat d&apos;un lien magique ou connexion Google.
              </p>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-base-content">Email professionnel</span>
              </label>
              <input
                ref={emailInputRef}
                type="email"
                placeholder="tom.dub02@gmail.com"
                className="input input-bordered w-full"
                value={email}
                onChange={handleEmailChange}
                onFocus={handleEmailFocus}
                onBlur={handleEmailBlur}
                disabled={loading || googleLoading}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text text-base-content">Code de sécurité (optionnel)</span>
                <span className="text-xs text-base-content/50">Pour la future connexion par mot de passe</span>
              </label>
              <input
                type="password"
                placeholder="******"
                className="input input-bordered w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={handlePasswordFocus}
                onBlur={handlePasswordBlur}
                disabled={loading || googleLoading}
              />
            </div>

            {message && (
              <div
                className={`alert mt-4 ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}
              >
                <span>{message.text}</span>
              </div>
            )}

            <button
              type="submit"
              className={`btn btn-primary mt-6 w-full ${loading ? 'loading' : ''}`}
              disabled={loading || googleLoading}
            >
              {loading ? 'Envoi en cours...' : 'Envoyer le lien de connexion'}
            </button>

            <div className="my-4 flex items-center gap-4 text-base-content/40">
              <div className="h-px flex-1 bg-base-200" />
              <span className="text-xs uppercase tracking-widest">ou</span>
              <div className="h-px flex-1 bg-base-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className={`btn btn-outline w-full ${googleLoading ? 'loading' : ''}`}
              disabled={googleLoading || loading}
            >
              {googleLoading ? (
                'Connexion...'
              ) : (
                <span className="flex items-center gap-2">
                  <Chrome className="w-4 h-4" />
                  Continuer avec Google
                </span>
              )}
            </button>

            <p className="mt-6 text-center text-xs text-base-content/50">
              En continuant, vous acceptez nos conditions d&apos;utilisation et notre politique de confidentialité.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

