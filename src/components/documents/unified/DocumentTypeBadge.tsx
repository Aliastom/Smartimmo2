'use client';

import React from 'react';
import { Badge } from '@/components/ui/Badge';
import {
  FileText,
  Shield,
  Receipt,
  Award,
  Zap,
  AlertTriangle,
  Flame,
  Map,
  Image,
  FileSignature,
  ClipboardCheck,
  ClipboardX,
  FilePlus,
  IdCard,
  Banknote,
  LogOut,
  Wrench,
  Building,
} from 'lucide-react';

interface DocumentTypeBadgeProps {
  type: {
    code: string;
    label: string;
    icon?: string;
  };
  variant?: 'default' | 'outline' | 'secondary';
  showIcon?: boolean;
}

export function DocumentTypeBadge({
  type,
  variant = 'default',
  showIcon = true,
}: DocumentTypeBadgeProps) {
  // Mapping des icônes selon le code du type
  const iconMap: Record<string, any> = {
    CONTRAT_ASSURANCE: Shield,
    FACTURE: Receipt,
    QUITTANCE: FileText,
    ACTE_PROPRIETE: Award,
    TITRE_PROPRIETE: Award,
    DPE: Zap,
    DIAG_AMIANTE: AlertTriangle,
    DIAG_PLOMB: AlertTriangle,
    DIAG_GAZ: Flame,
    DIAG_ELEC: Zap,
    TAXE_FONCIERE: FileText,
    PLAN_BIEN: Map,
    PHOTO_BIEN: Image,
    BAIL_SIGNE: FileSignature,
    EDL_ENTREE: ClipboardCheck,
    EDL_SORTIE: ClipboardX,
    AVENANT_BAIL: FilePlus,
    ATTESTATION_ASSURANCE_LOCATAIRE: Shield,
    PIECE_IDENTITE_LOCATAIRE: IdCard,
    JUSTIFICATIF_REVENUS: Banknote,
    CONGE_LOCATAIRE: LogOut,
    JUSTIFICATIF_PAIEMENT: Receipt,
    FACTURE_TRAVAUX: Wrench,
    FACTURE_CHARGES: Zap,
    RECU_LOYER: FileText,
    RELEVE_BANCAIRE: Building,
  };

  // Utiliser l'icône depuis le mapping ou celle fournie
  const IconComponent = iconMap[type.code] || FileText;

  return (
    <Badge variant={variant} className="flex items-center gap-1">
      {showIcon && <IconComponent className="h-3 w-3" />}
      {type.label}
    </Badge>
  );
}

