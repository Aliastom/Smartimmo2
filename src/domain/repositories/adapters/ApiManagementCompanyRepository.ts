/**
 * Adapter API pour IManagementCompanyRepository (mode normal)
 */

import type { ManagementCompany } from '@/lib/gestion/types';
import type {
  IManagementCompanyRepository,
  CreateManagementCompanyData,
  UpdateManagementCompanyData,
} from '../interfaces/IManagementCompanyRepository';

export class ApiManagementCompanyRepository implements IManagementCompanyRepository {
  async create(data: CreateManagementCompanyData): Promise<ManagementCompany> {
    const res = await fetch('/api/gestion/societes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom: data.nom,
        contact: data.contact ?? null,
        email: data.email ?? null,
        telephone: data.telephone ?? null,
        modeCalcul: data.modeCalcul,
        taux: data.taux,
        fraisMin: data.fraisMin ?? null,
        baseSurEncaissement: data.baseSurEncaissement ?? true,
        tvaApplicable: data.tvaApplicable ?? false,
        tauxTva: data.tauxTva ?? null,
        actif: data.actif ?? true,
      }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erreur lors de la création');
    }
    return res.json();
  }

  async update(id: string, data: UpdateManagementCompanyData): Promise<ManagementCompany> {
    const res = await fetch(`/api/gestion/societes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erreur lors de la mise à jour');
    }
    return res.json();
  }

  async delete(id: string): Promise<void> {
    const res = await fetch(`/api/gestion/societes/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erreur lors de la suppression');
    }
  }

  async findById(id: string): Promise<ManagementCompany | null> {
    const res = await fetch(`/api/gestion/societes/${id}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      const error = await res.json();
      throw new Error(error.error || 'Erreur lors de la récupération');
    }
    return res.json();
  }

  async findAll(): Promise<ManagementCompany[]> {
    const res = await fetch('/api/gestion/societes');
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erreur lors de la récupération');
    }
    const data = await res.json();
    return data.societes || [];
  }

  async assignProperties(id: string, propertyIds: string[]): Promise<void> {
    const res = await fetch(`/api/gestion/societes/${id}/affecter-biens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyIds }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Erreur lors de l\'affectation des biens');
    }
  }
}
