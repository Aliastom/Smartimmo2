/**
 * Interface pour le repository de locataires
 */

export interface Tenant {
  id: string;
  organizationId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

export interface TenantWhere {
  id?: string;
  organizationId?: string;
}

export interface ITenantRepository {
  findFirst(where: TenantWhere): Promise<Tenant | null>;
}


