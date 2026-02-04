/**
 * Implémentation in-memory du repository de locataires
 */

import type { ITenantRepository, Tenant, TenantWhere } from '../interfaces/ITenantRepository';

export class InMemoryTenantRepository implements ITenantRepository {
  private tenants: Map<string, Tenant> = new Map();
  private nextId = 1;

  private generateId(): string {
    return `tenant_${this.nextId++}_${Date.now()}`;
  }

  async findFirst(where: TenantWhere): Promise<Tenant | null> {
    let results = Array.from(this.tenants.values());

    if (where.organizationId) {
      results = results.filter(tenant => tenant.organizationId === where.organizationId);
    }
    if (where.id) {
      results = results.filter(tenant => tenant.id === where.id);
    }

    return results[0] || null;
  }

  // Méthodes utilitaires pour les tests
  clear(): void {
    this.tenants.clear();
    this.nextId = 1;
  }

  seed(tenants: Tenant[]): void {
    for (const tenant of tenants) {
      this.tenants.set(tenant.id, tenant);
    }
  }

  getAll(): Tenant[] {
    return Array.from(this.tenants.values());
  }

  snapshot(): { tenants: Tenant[] } {
    return {
      tenants: Array.from(this.tenants.values()),
    };
  }
}


