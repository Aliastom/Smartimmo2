import { LoginForm } from './LoginForm';
import { MascotPanel } from './MascotPanel';

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full bg-neutral-100 px-4 py-10 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <MascotPanel />
        <div className="flex items-center justify-center">
          <div className="w-full max-w-md rounded-[32px] bg-white p-8 shadow-2xl shadow-[#0F172A]/5">
            <div className="mb-8 space-y-2 text-center">
              <div className="inline-flex items-center gap-3 rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
                🔐 SmartImmo Secure
              </div>
              <h1 className="text-3xl font-bold text-base-content">
                Ravis de vous revoir !
              </h1>
              <p className="text-base text-base-content/60">
                Entrez votre email pour recevoir un lien magique ou utilisez votre compte Google.
              </p>
            </div>
            <LoginForm />
            <p className="mt-8 text-center text-sm text-base-content/50">
              Besoin d&apos;un compte ? Contactez l&apos;administrateur SmartImmo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

