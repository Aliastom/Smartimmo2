'use client';

import React, { useState } from 'react';
import { Icon, IconWithBadge } from '@/ui/components/Icon';
import { AppModal, ModalFooter } from '@/ui/components/AppModal';
import { ThemeSwitcher } from '@/ui/components/ThemeSwitcher';
import { 
  Home, 
  Building2, 
  Users, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Eye,
  Edit,
  Trash2,
  ExternalLink,
  Settings,
  FileText
} from 'lucide-react';

export default function TestThemeSafetyPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  // Données de test pour les cartes KPI
  const kpiData = [
    { title: 'Biens', value: '12', icon: Building2, variant: 'accent' as const, badgeColor: 'primary' as const },
    { title: 'Locataires', value: '8', icon: Users, variant: 'success' as const, badgeColor: 'success' as const },
    { title: 'Revenus', value: '€2,400', icon: TrendingUp, variant: 'warning' as const, badgeColor: 'warning' as const },
    { title: 'Problèmes', value: '2', icon: AlertCircle, variant: 'error' as const, badgeColor: 'error' as const },
  ];

  // Données de test pour la table
  const tableData = [
    { id: 1, name: 'Appartement A', type: 'T2', price: '€800', status: 'Loué' },
    { id: 2, name: 'Appartement B', type: 'T3', price: '€1200', status: 'Disponible' },
    { id: 3, name: 'Studio C', type: 'T1', price: '€600', status: 'En travaux' },
  ];

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Test Sécurité Thèmes - UI Stabilisée</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-base-content opacity-70">Changer de thème :</span>
          <ThemeSwitcher />
        </div>
      </div>

      {/* Indicateurs de sécurité */}
      <div className="alert alert-info">
        <CheckCircle className="w-6 h-6" />
        <div>
          <h3 className="font-bold">Filet de Sécurité Actif</h3>
          <div className="text-sm mt-1">
            <p>• Thèmes validés uniquement : smartimmo, light, dark</p>
            <p>• Panic button : <code>?theme=smartimmo</code> dans l'URL</p>
            <p>• Feature flag : <code>NEXT_PUBLIC_THEMES_ENABLED=true</code></p>
          </div>
        </div>
      </div>

      {/* Test des liens */}
      <div className="card">
        <div className="card-body">
          <h2 className="card-title">✅ Test des Liens</h2>
          <div className="space-y-2">
            <p>Lien standard : <a href="#">Cliquez ici</a></p>
            <p>Lien dans prose : <span className="prose">Voici un <a href="#">lien dans du texte</a> normal.</span></p>
            <p>Lien discret : <a href="#" className="link-muted">Lien discret</a></p>
            <p>Lien externe : <a href="#" className="link-muted">Documentation <ExternalLink className="inline w-4 h-4 ml-1" /></a></p>
          </div>
        </div>
      </div>

      {/* Test des icônes */}
      <div className="card">
        <div className="card-body">
          <h2 className="card-title">✅ Test des Icônes</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center">
              <Icon variant="default"><Home className="w-5 h-5" /></Icon>
              <p className="text-sm mt-1">Default</p>
            </div>
            <div className="text-center">
              <Icon variant="muted"><Home className="w-5 h-5" /></Icon>
              <p className="text-sm mt-1">Muted</p>
            </div>
            <div className="text-center">
              <Icon variant="accent"><Home className="w-5 h-5" /></Icon>
              <p className="text-sm mt-1">Accent</p>
            </div>
            <div className="text-center">
              <Icon variant="success"><CheckCircle className="w-5 h-5" /></Icon>
              <p className="text-sm mt-1">Success</p>
            </div>
            <div className="text-center">
              <Icon variant="warning"><AlertCircle className="w-5 h-5" /></Icon>
              <p className="text-sm mt-1">Warning</p>
            </div>
            <div className="text-center">
              <Icon variant="error"><XCircle className="w-5 h-5" /></Icon>
              <p className="text-sm mt-1">Error</p>
            </div>
          </div>
        </div>
      </div>

      {/* Test des cartes KPI avec icônes */}
      <div className="card">
        <div className="card-body">
          <h2 className="card-title">✅ Test des Cartes KPI</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiData.map((kpi, index) => (
              <div key={index} className="card">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-base-content opacity-70">{kpi.title}</p>
                      <p className="text-2xl font-bold text-base-content">{kpi.value}</p>
                    </div>
                    <IconWithBadge 
                      variant={kpi.variant}
                      badgeColor={kpi.badgeColor}
                      badgeSize="md"
                    >
                      <kpi.icon className="w-4 h-4" />
                    </IconWithBadge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Test des tables */}
      <div className="card">
        <div className="card-body">
          <h2 className="card-title">✅ Test des Tables</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Prix</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row) => (
                  <tr 
                    key={row.id}
                    className={selectedRow === row.id ? 'active' : ''}
                    onClick={() => setSelectedRow(selectedRow === row.id ? null : row.id)}
                  >
                    <td>{row.name}</td>
                    <td>{row.type}</td>
                    <td>{row.price}</td>
                    <td>
                      <span className={`badge ${
                        row.status === 'Loué' ? 'badge-success' :
                        row.status === 'Disponible' ? 'badge-info' :
                        'badge-warning'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn" title="Voir">
                          <Icon variant="default"><Eye className="w-4 h-4" /></Icon>
                        </button>
                        <button className="btn" title="Modifier">
                          <Icon variant="default"><Edit className="w-4 h-4" /></Icon>
                        </button>
                        <button className="btn" title="Supprimer">
                          <Icon variant="error"><Trash2 className="w-4 h-4" /></Icon>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="alert alert-info mt-4">
            <div>
              <h4 className="font-bold">Instructions :</h4>
              <ul className="text-sm mt-1 list-disc list-inside">
                <li>Survolez les lignes pour voir l'effet hover</li>
                <li>Cliquez sur une ligne pour la sélectionner (classe active)</li>
                <li>Les boutons d'action utilisent des icônes thématisées</li>
                <li>Tab pour naviguer avec le clavier (focus visible)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Test des formulaires */}
      <div className="card">
        <div className="card-body">
          <h2 className="card-title">✅ Test des Formulaires</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text">Nom</span>
                </label>
                <input type="text" placeholder="Votre nom" className="input w-full" />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">Type</span>
                </label>
                <select className="select w-full">
                  <option>Appartement</option>
                  <option>Maison</option>
                  <option>Studio</option>
                </select>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <textarea className="textarea w-full h-24" placeholder="Description..."></textarea>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-primary">Sauvegarder</button>
                <button className="btn btn-outline">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Test de la modale */}
      <div className="card">
        <div className="card-body">
          <h2 className="card-title">✅ Test de la Modale</h2>
          <button 
            className="btn btn-primary"
            onClick={() => setIsModalOpen(true)}
          >
            Ouvrir la Modale de Test
          </button>
          <div className="alert alert-info mt-4">
            <div>
              <h4 className="font-bold">Fonctionnalités de la modale :</h4>
              <ul className="text-sm mt-1 list-disc list-inside">
                <li>Backdrop flouté avec couleur de thème (jamais noir)</li>
                <li>Animation d'ouverture/fermeture (scale + fade)</li>
                <li>Fermeture avec Escape ou clic sur backdrop</li>
                <li>Scroll du body bloqué quand ouverte</li>
                <li>Focus management et aria-labels</li>
                <li>Respect de prefers-reduced-motion</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Test d'accessibilité */}
      <div className="card">
        <div className="card-body">
          <h2 className="card-title">✅ Test d'Accessibilité</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <button className="btn btn-primary">
                <Settings className="w-4 h-4 mr-2" />
                Bouton avec Focus
              </button>
              <button className="btn btn-outline">
                <FileText className="w-4 h-4 mr-2" />
                Autre Bouton
              </button>
            </div>
            <p className="text-sm text-base-content opacity-70">
              Utilisez Tab pour naviguer et vérifier que les focus rings sont visibles sur tous les éléments interactifs.
            </p>
          </div>
        </div>
      </div>

      {/* Instructions générales */}
      <div className="alert alert-success">
        <div>
          <h3 className="font-bold">✅ Critères d'Acceptation</h3>
          <div className="text-sm mt-2 space-y-1">
            <p>1. <strong>Changer de thème</strong> et vérifier que :</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>✅ Tous les liens sont visibles et soulignables au hover</li>
              <li>✅ Les icônes suivent les couleurs du thème</li>
              <li>✅ Les cartes KPI ont des couleurs cohérentes</li>
              <li>✅ Les tables ont un hover et une sélection lisibles</li>
              <li>✅ La modale a un backdrop flou clair (jamais noir)</li>
              <li>✅ Les formulaires utilisent les tokens daisyUI</li>
              <li>✅ Les focus rings sont visibles au clavier</li>
            </ul>
            <p>2. <strong>Thèmes sécurisés</strong> : smartimmo, light, dark</p>
            <p>3. <strong>Vérifier</strong> qu'aucune couleur fixe (blanc, gris, noir) n'apparaît</p>
            <p>4. <strong>Lint</strong> : <code>npm run lint-theme-safety</code> doit passer</p>
          </div>
        </div>
      </div>

      {/* Modale de test */}
      <AppModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Test de la Modale Sécurisée"
        size="md"
      >
        <div className="space-y-4">
          <p>Ceci est une modale test utilisant le composant <code>AppModal</code> sécurisé.</p>
          <p>Elle devrait avoir :</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Un backdrop flouté avec la couleur du thème</li>
            <li>Une animation fluide d'ouverture/fermeture</li>
            <li>Des boutons stylés avec les tokens daisyUI</li>
            <li>Un focus ring visible sur les boutons</li>
          </ul>
          <div className="alert alert-info">
            <CheckCircle className="w-5 h-5" />
            <div>
              <h4 className="font-bold">Sécurité Thème</h4>
              <p className="text-sm">Cette modale respecte les règles de sécurité des thèmes et utilise exclusivement les tokens daisyUI.</p>
            </div>
          </div>
        </div>
        <ModalFooter
          onCancel={() => setIsModalOpen(false)}
          onConfirm={() => {
            alert('Action confirmée ! Thème stable.');
            setIsModalOpen(false);
          }}
          confirmText="Confirmer"
          cancelText="Annuler"
        />
      </AppModal>
    </div>
  );
}
