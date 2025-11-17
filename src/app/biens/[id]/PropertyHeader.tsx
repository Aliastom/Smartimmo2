'use client';

import { usePathname } from 'next/navigation';
import { PropertySubNav } from '@/components/bien/PropertySubNav';
import { usePropertyHeaderActions } from './PropertyHeaderActionsContext';

interface PropertyHeaderProps {
  propertyId: string;
  propertyName: string;
}

// Configuration des titres, descriptions et couleurs pour chaque sous-page
const pageConfig: Record<string, { title: string; description: string; hue: number }> = {
  '/transactions': {
    title: 'Transactions',
    description: 'Suivi des revenus et dépenses de ce bien',
    hue: 1,
  },
  '/documents': {
    title: 'Documents',
    description: 'Tous les documents liés à ce bien immobilier',
    hue: 210,
  },
  '/photos': {
    title: 'Photos',
    description: 'Galerie photos de ce bien immobilier',
    hue: 280,
  },
  '/leases': {
    title: 'Baux',
    description: 'Gestion des baux de ce bien immobilier',
    hue: 50,
  },
  '/echeances': {
    title: 'Échéances',
    description: 'Charges et revenus récurrents pour ce bien',
    hue: 150,
  },
  '/loans': {
    title: 'Prêts',
    description: 'Gestion des prêts immobiliers de ce bien',
    hue: 186,
  },
};

// Fonction pour convertir hue en couleur HSL
function hueToColor(hue: number): string {
  return `hsl(${hue}, 70%, 50%)`;
}

export function PropertyHeader({ propertyId, propertyName }: PropertyHeaderProps) {
  const pathname = usePathname();
  const { actions } = usePropertyHeaderActions();
  
  // Déterminer la page active et son config
  const activePage = pathname?.replace(`/biens/${propertyId}`, '') || '/transactions';
  const config = pageConfig[activePage] || pageConfig['/transactions'];
  
  const title = `${config.title} - ${propertyName}`;
  const description = config.description;
  const borderColor = hueToColor(config.hue);

  return (
    <div className="space-y-4 mb-10">
      {/* Première ligne : Titre et Actions */}
      <div className="grid grid-cols-3 items-center gap-6">
        <div className="flex-1">
          <h1 
            className="text-3xl font-bold text-gray-900 border-b-4 pb-2 inline-block" 
            style={{ borderColor }}
          >
            {title}
          </h1>
        </div>
        
        <div className="flex justify-center">
          <PropertySubNav
            propertyId={propertyId}
            counts={{}}
          />
        </div>
        
        <div className="flex items-center gap-3 justify-end">
          {actions}
        </div>
      </div>
      
      {/* Deuxième ligne : Description */}
      <div className="grid grid-cols-3 gap-6">
        <div className="flex-1">
          <p className="text-gray-600">{description}</p>
        </div>
        <div className="col-span-2"></div>
      </div>
    </div>
  );
}

