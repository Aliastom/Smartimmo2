/**
 * Repository in-memory pour ManagementCompany (tests)
 */

import type { ManagementCompany } from '@/lib/gestion/types';
import type {
  IManagementCompanyRepository,
  CreateManagementCompanyData,
  UpdateManagementCompanyData,
} from '../interfaces/IManagementCompanyRepository';

export class InMemoryManagementCompanyRepository implements IManagementCompanyRepository {
  private items = new Map<string, ManagementCompany & { organizationId?: string }>();

  async create(data: CreateManagementCompanyData): Promise<ManagementCompany> {
    const id = crypto.randomUUID();
    const now = new Date();
    const item: ManagementCompany & { organizationId?: string } = {
      id,
      nom: data.nom,
      contact: data.contact ?? null,
      email: data.email ?? null,
      telephone: data.telephone ?? null,
      modeCalcul: data.modeCalcul as any,
      taux: data.taux,
      fraisMin: data.fraisMin ?? null,
      baseSurEncaissement: data.baseSurEncaissement ?? true,
      tvaApplicable: data.tvaApplicable ?? false,
      tauxTva: data.tauxTva ?? null,
      actif: data.actif ?? true,
      createdAt: now,
      updatedAt: now,
      organizationId: data.organizationId,
    };
    this.items.set(id, item);
    return item;
  }

  async update(id: string, data: UpdateManagementCompanyData): Promise<ManagementCompany> {
    const existing = this.items.get(id);
    if (!existing) {
      throw new Error(`ManagementCompany ${id} non trouvée`);
    }
    const updated = {
      ...existing,
      ...data,
      contact: data.contact !== undefined ? data.contact : existing.contact,
      email: data.email !== undefined ? data.email : existing.email,
      telephone: data.telephone !== undefined ? data.telephone : existing.telephone,
      fraisMin: data.fraisMin !== undefined ? data.fraisMin : existing.fraisMin,
      tauxTva: data.tauxTva !== undefined ? data.tauxTva : existing.tauxTva,
      updatedAt: new Date(),
    };
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = this.items.get(id);
    if (!existing) return;
    this.items.set(id, { ...existing, actif: false, updatedAt: new Date() });
  }

  async findById(id: string, organizationId: string): Promise<ManagementCompany | null> {
    const item = this.items.get(id);
    if (!item) return null;
    if (item.organizationId && item.organizationId !== organizationId) return null;
    return item;
  }

  async findAll(organizationId: string): Promise<ManagementCompany[]> {
    return Array.from(this.items.values()).filter(
      item => !item.organizationId || item.organizationId === organizationId
    );
  }
}
