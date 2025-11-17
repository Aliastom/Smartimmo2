import { LoginForm } from './LoginForm';

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { redirect?: string };
}) {
  const redirect = searchParams?.redirect;
  return (
    <div className="min-h-screen w-full bg-[#E3EEFA] px-4 py-12 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6">
        <div className="text-center text-slate-800">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            SmartImmo • Auth 2.0
          </p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold">Ravis de vous revoir 👋</h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600">
            Connectez-vous pour reprendre vos opérations SmartImmo.
          </p>
        </div>
        <LoginForm redirectPath={redirect} />
        <p className="text-center text-sm text-slate-500">
          Besoin d&apos;un compte ? Contactez un administrateur SmartImmo pour activer votre accès.
        </p>
      </div>
    </div>
  );
}

