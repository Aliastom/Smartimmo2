import { redirect } from 'next/navigation';

// Redirection de l'ancien chemin vers le nouveau
export default function SettingsPage() {
  redirect('/parametres');
}
