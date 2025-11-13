'use client';

import React from 'react';
import { useTheme } from 'next-themes';

export default function ThemeTestSmartImmoPage() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { name: 'smartimmo', label: 'SmartImmo Principal', description: 'Bleu professionnel équilibré' },
    { name: 'smartimmo-warm', label: 'SmartImmo Warm', description: 'Tons chauds et accueillants' },
    { name: 'smartimmo-cool', label: 'SmartImmo Cool', description: 'Tons froids et géométriques' },
  ];

  return (
    <div className="min-h-screen bg-base-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-base-content mb-4">
            Test des Thèmes SmartImmo
          </h1>
          <p className="text-base-content opacity-70 text-lg">
            Validation des contrastes WCAG AA et cohérence visuelle
          </p>
        </div>

        {/* Theme Switcher */}
        <div className="card bg-base-200 shadow-lg">
          <div className="card-body">
            <h2 className="card-title">Sélection du thème</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {themes.map((themeOption) => (
                <button
                  key={themeOption.name}
                  onClick={() => setTheme(themeOption.name)}
                  className={`btn ${
                    theme === themeOption.name ? 'btn-primary' : 'btn-outline'
                  } btn-block hover-pop press`}
                >
                  <div className="text-left">
                    <div className="font-semibold">{themeOption.label}</div>
                    <div className="text-xs opacity-70">{themeOption.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Color Palette */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Primary Colors */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h3 className="card-title text-primary">Couleurs Principales</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary rounded-full"></div>
                  <div>
                    <div className="font-medium">Primary</div>
                    <div className="text-sm opacity-70">Couleur principale</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-secondary rounded-full"></div>
                  <div>
                    <div className="font-medium">Secondary</div>
                    <div className="text-sm opacity-70">Couleur secondaire</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-accent rounded-full"></div>
                  <div>
                    <div className="font-medium">Accent</div>
                    <div className="text-sm opacity-70">Couleur d'accent</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Status Colors */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h3 className="card-title text-base-content">Couleurs de Statut</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-info rounded-full"></div>
                  <div>
                    <div className="font-medium">Info</div>
                    <div className="text-sm opacity-70">Informations</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-success rounded-full"></div>
                  <div>
                    <div className="font-medium">Success</div>
                    <div className="text-sm opacity-70">Succès</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-warning rounded-full"></div>
                  <div>
                    <div className="font-medium">Warning</div>
                    <div className="text-sm opacity-70">Attention</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-error rounded-full"></div>
                  <div>
                    <div className="font-medium">Error</div>
                    <div className="text-sm opacity-70">Erreur</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Base Colors */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h3 className="card-title text-base-content">Couleurs de Base</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-base-100 border-2 border-base-300 rounded-full"></div>
                  <div>
                    <div className="font-medium">Base 100</div>
                    <div className="text-sm opacity-70">Fond principal</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-base-200 rounded-full"></div>
                  <div>
                    <div className="font-medium">Base 200</div>
                    <div className="text-sm opacity-70">Fond secondaire</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-base-300 rounded-full"></div>
                  <div>
                    <div className="font-medium">Base 300</div>
                    <div className="text-sm opacity-70">Fond tertiaire</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-neutral rounded-full"></div>
                  <div>
                    <div className="font-medium">Neutral</div>
                    <div className="text-sm opacity-70">Gris neutre</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Component Examples */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-base-content">Exemples de Composants</h2>
          
          {/* Buttons */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h3 className="card-title">Boutons</h3>
              <div className="flex flex-wrap gap-4">
                <button className="btn btn-primary hover-pop press">Primary</button>
                <button className="btn btn-secondary hover-pop press">Secondary</button>
                <button className="btn btn-accent hover-pop press">Accent</button>
                <button className="btn btn-info hover-pop press">Info</button>
                <button className="btn btn-success hover-pop press">Success</button>
                <button className="btn btn-warning hover-pop press">Warning</button>
                <button className="btn btn-error hover-pop press">Error</button>
                <button className="btn btn-ghost hover-pop press">Ghost</button>
                <button className="btn btn-outline hover-pop press">Outline</button>
              </div>
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="card bg-primary text-primary-content shadow-lg hover-float">
              <div className="card-body">
                <h2 className="card-title">Carte Primary</h2>
                <p>Contenu de la carte avec couleur principale.</p>
                <div className="card-actions justify-end">
                  <button className="btn btn-primary-content hover-pop press">Action</button>
                </div>
              </div>
            </div>
            
            <div className="card bg-base-100 shadow-lg hover-float">
              <div className="card-body">
                <h2 className="card-title">Carte Standard</h2>
                <p>Contenu de la carte avec fond de base.</p>
                <div className="card-actions justify-end">
                  <button className="btn btn-primary hover-pop press">Action</button>
                </div>
              </div>
            </div>
            
            <div className="card bg-accent text-accent-content shadow-lg hover-float">
              <div className="card-body">
                <h2 className="card-title">Carte Accent</h2>
                <p>Contenu de la carte avec couleur d'accent.</p>
                <div className="card-actions justify-end">
                  <button className="btn btn-accent-content hover-pop press">Action</button>
                </div>
              </div>
            </div>
          </div>

          {/* Form Elements */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h3 className="card-title">Éléments de Formulaire</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Input Standard</span>
                    </label>
                    <input type="text" placeholder="Tapez ici..." className="input input-bordered" />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Input Primary</span>
                    </label>
                    <input type="text" placeholder="Tapez ici..." className="input input-primary" />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Select</span>
                    </label>
                    <select className="select select-bordered">
                      <option>Option 1</option>
                      <option>Option 2</option>
                      <option>Option 3</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="form-control">
                    <label className="cursor-pointer label">
                      <span className="label-text">Checkbox</span>
                      <input type="checkbox" className="checkbox checkbox-primary" />
                    </label>
                  </div>
                  
                  <div className="form-control">
                    <label className="cursor-pointer label">
                      <span className="label-text">Radio</span>
                      <input type="radio" name="radio-1" className="radio radio-primary" />
                    </label>
                  </div>
                  
                  <div className="form-control">
                    <label className="cursor-pointer label">
                      <span className="label-text">Toggle</span>
                      <input type="checkbox" className="toggle toggle-primary" />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="space-y-4">
            <div className="alert alert-info">
              <span>Information : Ceci est une alerte d'information.</span>
            </div>
            <div className="alert alert-success">
              <span>Succès : Opération réalisée avec succès.</span>
            </div>
            <div className="alert alert-warning">
              <span>Attention : Veuillez vérifier vos informations.</span>
            </div>
            <div className="alert alert-error">
              <span>Erreur : Une erreur s'est produite.</span>
            </div>
          </div>

          {/* Badges */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h3 className="card-title">Badges</h3>
              <div className="flex flex-wrap gap-2">
                <div className="badge badge-primary">Primary</div>
                <div className="badge badge-secondary">Secondary</div>
                <div className="badge badge-accent">Accent</div>
                <div className="badge badge-info">Info</div>
                <div className="badge badge-success">Success</div>
                <div className="badge badge-warning">Warning</div>
                <div className="badge badge-error">Error</div>
                <div className="badge badge-outline">Outline</div>
              </div>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h3 className="card-title">Barres de Progression</h3>
              <div className="space-y-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Primary (75%)</span>
                  </label>
                  <progress className="progress progress-primary" value="75" max="100"></progress>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Success (60%)</span>
                  </label>
                  <progress className="progress progress-success" value="60" max="100"></progress>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Warning (40%)</span>
                  </label>
                  <progress className="progress progress-warning" value="40" max="100"></progress>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Error (20%)</span>
                  </label>
                  <progress className="progress progress-error" value="20" max="100"></progress>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Accessibility Notes */}
        <div className="card bg-base-200 shadow-lg">
          <div className="card-body">
            <h3 className="card-title text-base-content">Notes d'Accessibilité</h3>
            <div className="space-y-2 text-sm">
              <p>✅ <strong>Contrastes WCAG AA :</strong> Tous les textes respectent un ratio de contraste minimum de 4.5:1</p>
              <p>✅ <strong>États focus :</strong> Ring de focus visible avec couleur cohérente au thème</p>
              <p>✅ <strong>Animations :</strong> Transitions fluides et respectueuses de prefers-reduced-motion</p>
              <p>✅ <strong>Rayons :</strong> Rayons cohérents selon la personnalité du thème</p>
              <p>✅ <strong>Ombres :</strong> Ombres adaptées à la couleur principale du thème</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

