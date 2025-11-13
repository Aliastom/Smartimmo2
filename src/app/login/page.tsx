import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="max-w-md w-full">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h1 className="card-title text-2xl font-bold text-center mb-4">
              Connexion à SmartImmo
            </h1>
            <p className="text-center text-base-content/70 mb-6">
              Entrez votre email pour recevoir un lien de connexion
            </p>
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}

