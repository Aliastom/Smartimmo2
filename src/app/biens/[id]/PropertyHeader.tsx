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
    <div className="space-y-4 mb-6 sm:mb-10">
      {/* Première ligne : Titre et Actions */}
      <div className="flex flex-col sm:grid sm:grid-cols-3 items-start sm:items-center gap-4 sm:gap-6">
        {/* Titre - Pleine largeur sur mobile, 1ère colonne sur desktop */}
        <div className="flex-1 w-full sm:w-auto">
          <h1 
            className="text-2xl sm:text-3xl font-bold text-gray-900 border-b-4 pb-2 inline-block" 
            style={{ borderColor }}
          >
            {title}
          </h1>
        </div>
        
        {/* Navigation horizontale - En dessous du titre sur mobile, au centre sur desktop */}
        <div className="flex justify-start sm:justify-center w-full sm:w-auto order-2 sm:order-none">
          <PropertySubNav
            propertyId={propertyId}
            counts={{}}
          />
        </div>
        
        {/* Actions - En dessous sur mobile, à droite sur desktop */}
        <div className="flex items-center gap-3 justify-start sm:justify-end w-full sm:w-auto order-3 sm:order-none">
          {actions}
        </div>
      </div>
      
      {/* Deuxième ligne : Description */}
      <div className="flex flex-col sm:grid sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="flex-1">
          <p className="text-sm sm:text-base text-gray-600">{description}</p>
        </div>
        <div className="hidden sm:block sm:col-span-2"></div>
      </div>
    </div>
  );
}

