'use client';

import React from 'react';
import { AvatarBadge } from '@/ui/components/AvatarBadge';

export default function TestAvatarBadgesPage() {
  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Test AvatarBadge - Thèmes</h1>
      
      {/* Test des tailles */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Test des Tailles - Centrage Amélioré</h2>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <AvatarBadge text="S" size="xs" />
              <p className="text-sm mt-2">XS (24px)</p>
              <p className="text-xs text-base-content opacity-60">text-[9px]</p>
            </div>
            <div className="text-center">
              <AvatarBadge text="S" size="sm" />
              <p className="text-sm mt-2">SM (32px)</p>
              <p className="text-xs text-base-content opacity-60">text-[13px]</p>
            </div>
            <div className="text-center">
              <AvatarBadge text="S" size="md" />
              <p className="text-sm mt-2">MD (40px)</p>
              <p className="text-xs text-base-content opacity-60">text-[16px]</p>
            </div>
            <div className="text-center">
              <AvatarBadge text="S" size="lg" />
              <p className="text-sm mt-2">LG (48px)</p>
              <p className="text-xs text-base-content opacity-60">text-[20px]</p>
            </div>
          </div>
          <div className="alert alert-info mt-4">
            <div>
              <h4 className="font-bold">Améliorations du centrage :</h4>
              <ul className="text-sm mt-1 list-disc list-inside">
                <li><code>leading-[1]</code> : Line-height de 1 pour un centrage parfait</li>
                <li><code>style={{ lineHeight: '1' }}</code> : Force le line-height via CSS inline</li>
                <li>Tailles de police optimisées pour chaque cercle</li>
                <li><code>select-none</code> : Empêche la sélection du texte</li>
                <li><code>flex items-center justify-center</code> : Centrage horizontal et vertical</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Test avec et sans ring */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Test avec et sans Ring</h2>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <AvatarBadge text="S" size="md" ring={true} />
              <p className="text-sm mt-2">Avec Ring</p>
            </div>
            <div className="text-center">
              <AvatarBadge text="S" size="md" ring={false} />
              <p className="text-sm mt-2">Sans Ring</p>
            </div>
          </div>
        </div>
      </div>

      {/* Test des différents utilisateurs */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Test Utilisateurs</h2>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <AvatarBadge text="U" size="sm" />
              <p className="text-sm mt-2">Utilisateur</p>
            </div>
            <div className="text-center">
              <AvatarBadge text="A" size="sm" />
              <p className="text-sm mt-2">Admin</p>
            </div>
            <div className="text-center">
              <AvatarBadge text="M" size="sm" />
              <p className="text-sm mt-2">Manager</p>
            </div>
            <div className="text-center">
              <AvatarBadge text="JD" size="sm" />
              <p className="text-sm mt-2">Jean Dupont</p>
            </div>
          </div>
        </div>
      </div>

      {/* Test avec hover */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Test Hover Effects</h2>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <AvatarBadge 
                text="S" 
                size="md" 
                className="shadow-sm hover:opacity-90 transition" 
              />
              <p className="text-sm mt-2">Logo avec Hover</p>
            </div>
            <div className="text-center">
              <AvatarBadge 
                text="U" 
                size="md" 
                className="shadow-lg hover:shadow-xl transition-shadow" 
              />
              <p className="text-sm mt-2">User avec Shadow</p>
            </div>
          </div>
        </div>
      </div>

      {/* Test de centrage précis */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Test de Centrage Précis</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="relative inline-block">
                <AvatarBadge text="S" size="sm" />
                <div className="absolute inset-0 border-2 border-red-500 rounded-full opacity-30"></div>
              </div>
              <p className="text-sm mt-2">SM avec grille de référence</p>
            </div>
            <div className="text-center">
              <div className="relative inline-block">
                <AvatarBadge text="U" size="sm" />
                <div className="absolute inset-0 border-2 border-red-500 rounded-full opacity-30"></div>
              </div>
              <p className="text-sm mt-2">SM avec grille de référence</p>
            </div>
            <div className="text-center">
              <div className="relative inline-block">
                <AvatarBadge text="A" size="sm" />
                <div className="absolute inset-0 border-2 border-red-500 rounded-full opacity-30"></div>
              </div>
              <p className="text-sm mt-2">SM avec grille de référence</p>
            </div>
            <div className="text-center">
              <div className="relative inline-block">
                <AvatarBadge text="M" size="sm" />
                <div className="absolute inset-0 border-2 border-red-500 rounded-full opacity-30"></div>
              </div>
              <p className="text-sm mt-2">SM avec grille de référence</p>
            </div>
          </div>
          <div className="alert alert-warning mt-4">
            <div>
              <h4 className="font-bold">Grille de référence :</h4>
              <p className="text-sm">Le cercle rouge montre les limites exactes du badge. Les lettres doivent être parfaitement centrées à l'intérieur.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions de test */}
      <div className="alert alert-info">
        <div>
          <h3 className="font-bold">Instructions de Test</h3>
          <div className="text-sm mt-2 space-y-1">
            <p>1. <strong>Changer de thème</strong> et vérifier que :</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Le fond des badges = <code>bg-primary</code> du thème</li>
              <li>Le texte des badges = <code>text-primary-content</code> du thème</li>
              <li>Le ring (si activé) = <code>ring-primary/30</code> du thème</li>
              <li>Le ring-offset = <code>ring-offset-base-100</code> du thème</li>
            </ul>
            <p>2. <strong>Thèmes à tester</strong> : smartimmo, smartimmo-warm, smartimmo-cool, light, dark, corporate</p>
            <p>3. <strong>Vérifier</strong> qu'aucun badge ne garde de couleur fixe (blanc, gris, orange)</p>
          </div>
        </div>
      </div>

      {/* Palette des thèmes */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Palette des Thèmes</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 bg-primary text-primary-content rounded-lg">
              <h3 className="font-semibold">Primary</h3>
              <p className="text-sm opacity-90">bg-primary / text-primary-content</p>
            </div>
            <div className="p-4 bg-base-100 text-base-content border border-base-300 rounded-lg">
              <h3 className="font-semibold">Base</h3>
              <p className="text-sm opacity-70">bg-base-100 / text-base-content</p>
            </div>
            <div className="p-4 bg-base-200 text-base-content rounded-lg">
              <h3 className="font-semibold">Base-200</h3>
              <p className="text-sm opacity-70">bg-base-200 / text-base-content</p>
            </div>
          </div>
        </div>
      </div>

      {/* Test d'accessibilité */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Test d'Accessibilité</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <button className="btn btn-ghost btn-circle focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100">
                <AvatarBadge text="S" size="sm" />
              </button>
              <p className="text-sm">Badge avec focus visible (Tab pour tester)</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="dropdown dropdown-end">
                <label 
                  tabIndex={0} 
                  className="btn btn-ghost btn-circle focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
                  aria-label="Menu utilisateur test"
                >
                  <AvatarBadge text="U" size="sm" />
                </label>
                <ul tabIndex={0} className="dropdown-content menu bg-base-100 border border-base-300 rounded-box shadow mt-2 w-56">
                  <li><a>Profil</a></li>
                  <li><a>Paramètres</a></li>
                  <li><a>Déconnexion</a></li>
                </ul>
              </div>
              <p className="text-sm">Dropdown avec focus visible et aria-label</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
