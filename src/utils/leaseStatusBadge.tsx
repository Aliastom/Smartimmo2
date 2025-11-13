import { Badge } from '@/components/ui/Badge';

/**
 * Configuration uniforme des badges de statut de bail
 * Utilisée dans le tableau et la modal d'édition
 */
export function getLeaseStatusBadge(status: string) {
  switch (status) {
    // Statuts anglais (nouveaux)
    case 'DRAFT':
      return <Badge variant="gray">Brouillon</Badge>;
    case 'SENT':
      return <Badge variant="warning">Envoyé</Badge>;
    case 'SIGNED':
      return <Badge variant="primary">Signé</Badge>;
    case 'ACTIVE':
      return <Badge variant="success">Actif</Badge>;
    case 'TERMINATED':
      return <Badge variant="danger">Résilié</Badge>;
    case 'EXPIRED':
      return <Badge variant="danger">Expiré</Badge>;
    
    // Statuts français (legacy - pour compatibilité)
    case 'BROUILLON':
      return <Badge variant="gray">Brouillon</Badge>;
    case 'ENVOYÉ':
    case 'ENVOYE':
      return <Badge variant="warning">Envoyé</Badge>;
    case 'SIGNÉ':
    case 'SIGNE':
      return <Badge variant="primary">Signé</Badge>;
    case 'ACTIF':
      return <Badge variant="success">Actif</Badge>;
    case 'RÉSILIÉ':
    case 'RESILIE':
      return <Badge variant="danger">Résilié</Badge>;
    case 'ARCHIVÉ':
    case 'ARCHIVE':
      return <Badge variant="danger">Archivé</Badge>;
    
    // Autres statuts
    case 'VACANT':
      return <Badge variant="warning">Vacant</Badge>;
    
    default:
      return <Badge variant="gray">{status}</Badge>;
  }
}

/**
 * Obtient la variante de badge pour un statut (sans le composant Badge)
 * Utile pour les conditions inline
 */
export function getLeaseStatusVariant(status: string): 'success' | 'primary' | 'warning' | 'danger' | 'gray' {
  switch (status) {
    // Statuts anglais (nouveaux)
    case 'DRAFT':
    case 'BROUILLON':
      return 'gray';
    case 'SENT':
    case 'ENVOYÉ':
    case 'ENVOYE':
    case 'VACANT':
      return 'warning';
    case 'SIGNED':
    case 'SIGNÉ':
    case 'SIGNE':
      return 'primary';
    case 'ACTIVE':
    case 'ACTIF':
      return 'success';
    case 'TERMINATED':
    case 'RÉSILIÉ':
    case 'RESILIE':
    case 'EXPIRED':
    case 'ARCHIVÉ':
    case 'ARCHIVE':
      return 'danger';
    
    default:
      return 'gray';
  }
}

/**
 * Obtient le libellé français pour un statut
 */
export function getLeaseStatusLabel(status: string): string {
  switch (status) {
    // Statuts anglais (nouveaux)
    case 'DRAFT':
    case 'BROUILLON':
      return 'Brouillon';
    case 'SENT':
    case 'ENVOYÉ':
    case 'ENVOYE':
      return 'Envoyé';
    case 'SIGNED':
    case 'SIGNÉ':
    case 'SIGNE':
      return 'Signé';
    case 'ACTIVE':
    case 'ACTIF':
      return 'Actif';
    case 'TERMINATED':
    case 'RÉSILIÉ':
    case 'RESILIE':
      return 'Résilié';
    case 'EXPIRED':
      return 'Expiré';
    case 'ARCHIVÉ':
    case 'ARCHIVE':
      return 'Archivé';
    case 'VACANT':
      return 'Vacant';
    
    default:
      return status;
  }
}
