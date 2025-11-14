'use client';

import { useEffect, useRef, useState } from 'react';
import { Chrome, Sparkles } from 'lucide-react';
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
  const [riveSrc, setRiveSrc] = useState(LOCAL_RIVE_SRC);

  useEffect(() => {
    let cancelled = false;
    fetch(LOCAL_RIVE_SRC, { method: 'HEAD' })
      .then((res) => {
        if (!cancelled && !res.ok) {
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

  const { rive, RiveComponent } = useRive({
    src: riveSrc,
    stateMachines: STATE_MACHINE_NAME,
    autoplay: true,
    layout: new Layout({
      fit: Fit.Cover,
      alignment: Alignment.Center,
    }),
  });

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
    <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="relative overflow-hidden rounded-[32px] bg-slate-900 text-white shadow-2xl">
        <div className="absolute inset-0">
          <RiveComponent className="h-full w-full" />
        </div>
        <div className="relative z-10 flex h-full flex-col justify-between p-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-white/80">
              <Sparkles className="h-4 w-4" />
              Auth sécurisée
            </p>
            <h2 className="mt-5 text-4xl font-bold leading-tight">Votre concierge digital vous attend</h2>
            <p className="mt-4 text-base text-white/70">
              Saisissez votre email ou utilisez Google pour recevoir instantanément un lien sécurisé.
              Le compagnon Rive suit vos actions en temps réel.
            </p>
          </div>
          <div className="text-sm text-white/60">
            Animations propulsées par Rive • Middleware Supabase & Prisma
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-[32px] bg-white p-8 shadow-2xl shadow-slate-900/5">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-primary">Connexion SmartImmo</p>
          <h1 className="text-3xl font-bold text-base-content">Ravis de vous revoir 👋</h1>
          <p className="text-sm text-base-content/60">
            Envoi immédiat d&apos;un lien magique ou authentification Google.
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
            className={`alert ${message.type === 'success' ? 'alert-success' : 'alert-error'}`}
          >
            <span>{message.text}</span>
          </div>
        )}

        <button
          type="submit"
          className={`btn btn-primary w-full ${loading ? 'loading' : ''}`}
          disabled={loading || googleLoading}
        >
          {loading ? 'Envoi en cours...' : 'Envoyer le lien de connexion'}
        </button>

        <div className="flex items-center gap-4 text-base-content/40">
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

        <p className="text-xs text-center text-base-content/50">
          En continuant, vous acceptez nos conditions d&apos;utilisation et notre politique de confidentialité.
        </p>
      </form>
    </div>
  );
}

