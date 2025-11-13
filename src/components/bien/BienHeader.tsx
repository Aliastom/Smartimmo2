'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Edit, 
  MapPin, 
  ExternalLink, 
  MoreVertical,
  Home,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/utils/cn';
import Link from 'next/link';

export interface BienHeaderProps {
  Property: {
    id: string;
    name: string;
    address: string;
    status?: string;
    type?: string;
    surface?: number;
    valeurActuelle?: number;
    dateAcquisition?: string;
    coords?: {
      lat: number;
      lng: number;
    };
  };
  onEdit?: () => void;
  className?: string;
}

const statusConfig = {
  OCCUPE: { label: 'Occupé', color: 'bg-success-100 text-success-800 border-success-200' },
  VACANT: { label: 'Vacant', color: 'bg-warning-100 text-warning-800 border-warning-200' },
  EN_TRAVAUX: { label: 'En travaux', color: 'bg-blue-100 text-blue-800 border-blue-200' },
};

export function BienHeader({ property, onEdit, className }: BienHeaderProps) {
  const status = property.status as keyof typeof statusConfig;
  const statusInfo = statusConfig[status] || { label: property.status, color: 'bg-gray-100 text-gray-800' };

  const handleOpenMaps = () => {
    if (property.coords) {
      window.open(
        `https://www.google.com/maps?q=${property.coords.lat},${property.coords.lng}`,
        '_blank'
      );
    } else if (property.address) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`,
        '_blank'
      );
    }
  };

  const handleCopyAddress = async () => {
    if (property.address) {
      await navigator.clipboard.writeText(property.address);
      // Utiliser notify2 si disponible
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-gray-600 mb-4" aria-label="Breadcrumb">
        <Link href="/biens" className="hover:text-primary-600 transition-colors">
          Biens
        </Link>
        <ArrowRight className="h-4 w-4" />
        <span className="font-medium text-gray-900">{property.name}</span>
        <ArrowRight className="h-4 w-4" />
        <span className="text-gray-500">Vue d'ensemble</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        {/* Infos principales */}
        <div className="flex-1">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary-100 text-primary-700 flex-shrink-0">
              <Home className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {property.name}
              </h1>
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm">{property.address}</span>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {status && (
              <Badge className={statusInfo.color}>
                {statusInfo.label}
              </Badge>
            )}
            {property.type && (
              <Badge variant="outline">
                {property.type}
              </Badge>
            )}
            {property.surface && (
              <Badge variant="outline">
                {property.surface} m²
              </Badge>
            )}
            {property.valeurActuelle && (
              <Badge variant="outline">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  maximumFractionDigits: 0
                }).format(property.valeurActuelle)}
              </Badge>
            )}
            {property.dateAcquisition && (
              <Badge variant="outline">
                Acquis le {new Date(property.dateAcquisition).toLocaleDateString('fr-FR')}
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Modifier
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenMaps}
            className="gap-2"
            title="Ouvrir dans Google Maps"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Itinéraire</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="p-2"
            title="Plus d'actions"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

