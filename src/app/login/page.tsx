import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="text-center text-white/90">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em]">
            SmartImmo • Auth 2.0
          </p>
          <h1 className="mt-4 text-4xl font-bold">Portail sécurisé avec animation Rive</h1>
          <p className="mt-2 text-base text-white/70">
            Inspiré du composant open-source Rive Login Form. Votre avatar interactif suit chaque action.
          </p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-white/60">
          Besoin d&apos;un compte ? Contactez un administrateur SmartImmo pour activer votre accès.
        </p>
      </div>
    </div>
  );
}

