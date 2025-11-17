import Link from 'next/link';

/**
 * Page d'accueil publique - Nécessaire pour l'installation PWA
 * Cette page doit être accessible sans authentification pour permettre
 * au service worker de s'installer correctement.
 */
export default function HomePage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo / Titre */}
        <div className="space-y-4">
          <h1 className="text-5xl font-bold text-slate-800">
            Smart<span className="text-blue-600">Immo</span>
          </h1>
          <p className="text-lg text-slate-600">
            Gestion immobilière moderne et intuitive
          </p>
        </div>

        {/* Description */}
        <div className="space-y-2 text-slate-500">
          <p>
            Gérez vos biens, locataires, baux et transactions en toute simplicité.
          </p>
        </div>

        {/* Bouton de connexion */}
        <div className="pt-4">
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            Se connecter
          </Link>
        </div>

        {/* Footer minimaliste */}
        <div className="pt-8 text-sm text-slate-400">
          <p>Application Progressive Web App</p>
        </div>
      </div>
    </div>
  );
}
