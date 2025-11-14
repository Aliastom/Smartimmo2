'use client';

import { useState } from 'react';
import { Chrome } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setMessage({ type: 'error', text: 'Veuillez entrer votre email' });
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
      setEmail('');
    } catch (error: any) {
      console.error('Erreur lors de l\'envoi du magic link:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Une erreur est survenue. Veuillez réessayer.',
      });
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
    } catch (error: any) {
      console.error('Erreur lors de la connexion Google:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Impossible de démarrer la connexion Google. Réessayez.',
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="form-control">
        <label className="label">
          <span className="label-text">Email</span>
        </label>
        <input
          type="email"
          placeholder="votre-email@exemple.com"
          className="input input-bordered w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading || googleLoading}
          required
        />
      </div>

      {message && (
        <div
          className={`alert ${
            message.type === 'success' ? 'alert-success' : 'alert-error'
          }`}
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

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-base-200" />
        <span className="text-xs uppercase tracking-widest text-base-content/50">ou</span>
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

      <p className="text-xs text-center text-base-content/50 mt-4">
        En continuant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
      </p>
    </form>
  );
}

