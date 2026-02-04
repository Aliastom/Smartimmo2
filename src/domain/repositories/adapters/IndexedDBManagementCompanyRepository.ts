/**
 * Adapter IndexedDB pour IManagementCompanyRepository
 */

import { getLocalDB } from '@/lib/offline/db';
import { v4 as uuidv4 } from 'uuid';
import type { ManagementCompany } from '@/lib/gestion/types';
import type {
  IManagementCompanyRepository,
  CreateManagementCompanyData,
  UpdateManagementCompanyData,
} from '../interfaces/IManagementCompanyRepository';

export class IndexedDBManagementCompanyRepository implements IManagementCompanyRepository {
  private _dbPromise: Promise<any> | null = null;

  private async getDb() {
    if (!this._dbPromise) {
      this._dbPromise = getLocalDB();
    }
    return this._dbPromise;
  }

  async create(data: CreateManagementCompanyData): Promise<ManagementCompany> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const record = {
      id,
      organizationId: data.organizationId,
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
      createdAt: now,
      updatedAt: now,
      cachedAt: now,
    };

    await db.ManagementCompany.put(record);

    await db.pendingOperations.add({
      id: uuidv4(),
      organizationId: data.organizationId,
      entity: 'managementCompany',
      entityId: id,
      operation: 'create',
      payload: {
        nom: record.nom,
        contact: record.contact,
        email: record.email,
        telephone: record.telephone,
        modeCalcul: record.modeCalcul,
        taux: record.taux,
        fraisMin: record.fraisMin,
        baseSurEncaissement: record.baseSurEncaissement,
        tvaApplicable: record.tvaApplicable,
        tauxTva: record.tauxTva,
        actif: record.actif,
      },
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      nom: record.nom,
      contact: record.contact,
      email: record.email,
      telephone: record.telephone,
      modeCalcul: record.modeCalcul as any,
      taux: record.taux,
      fraisMin: record.fraisMin,
      baseSurEncaissement: record.baseSurEncaissement,
      tvaApplicable: record.tvaApplicable,
      tauxTva: record.tauxTva,
      actif: record.actif,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
  }

  async update(id: string, data: UpdateManagementCompanyData): Promise<ManagementCompany> {
    const db = await this.getDb();
    const existing = await db.ManagementCompany.get(id);
    if (!existing) {
      throw new Error(`ManagementCompany ${id} non trouvée`);
    }

    const now = new Date().toISOString();
    const updatedRecord = {
      ...existing,
      ...data,
      contact: data.contact !== undefined ? data.contact : existing.contact,
      email: data.email !== undefined ? data.email : existing.email,
      telephone: data.telephone !== undefined ? data.telephone : existing.telephone,
      fraisMin: data.fraisMin !== undefined ? data.fraisMin : existing.fraisMin,
      tauxTva: data.tauxTva !== undefined ? data.tauxTva : existing.tauxTva,
      updatedAt: now,
      cachedAt: now,
    };

    await db.ManagementCompany.put(updatedRecord);

    const payload: Record<string, unknown> = {};
    if (data.nom !== undefined) payload.nom = data.nom;
    if (data.contact !== undefined) payload.contact = data.contact;
    if (data.email !== undefined) payload.email = data.email;
    if (data.telephone !== undefined) payload.telephone = data.telephone;
    if (data.modeCalcul !== undefined) payload.modeCalcul = data.modeCalcul;
    if (data.taux !== undefined) payload.taux = data.taux;
    if (data.fraisMin !== undefined) payload.fraisMin = data.fraisMin;
    if (data.baseSurEncaissement !== undefined) payload.baseSurEncaissement = data.baseSurEncaissement;
    if (data.tvaApplicable !== undefined) payload.tvaApplicable = data.tvaApplicable;
    if (data.tauxTva !== undefined) payload.tauxTva = data.tauxTva;
    if (data.actif !== undefined) payload.actif = data.actif;

    await db.pendingOperations.add({
      id: uuidv4(),
      organizationId: existing.organizationId,
      entity: 'managementCompany',
      entityId: id,
      operation: 'update',
      payload,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: updatedRecord.id,
      nom: updatedRecord.nom,
      contact: updatedRecord.contact,
      email: updatedRecord.email,
      telephone: updatedRecord.telephone,
      modeCalcul: updatedRecord.modeCalcul as any,
      taux: updatedRecord.taux,
      fraisMin: updatedRecord.fraisMin,
      baseSurEncaissement: updatedRecord.baseSurEncaissement,
      tvaApplicable: updatedRecord.tvaApplicable,
      tauxTva: updatedRecord.tauxTva,
      actif: updatedRecord.actif,
      createdAt: new Date(updatedRecord.createdAt),
      updatedAt: new Date(updatedRecord.updatedAt),
    };
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const db = await this.getDb();
    const existing = await db.ManagementCompany.get(id);
    if (!existing || existing.organizationId !== organizationId) {
      throw new Error(`ManagementCompany ${id} non trouvée`);
    }
    const now = new Date().toISOString();

    await db.ManagementCompany.put({
      ...existing,
      actif: false,
      updatedAt: now,
      cachedAt: now,
    });

    await db.pendingOperations.add({
      id: uuidv4(),
      organizationId,
      entity: 'managementCompany',
      entityId: id,
      operation: 'update',
      payload: { actif: false },
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
  }

  async findById(id: string, organizationId: string): Promise<ManagementCompany | null> {
    const db = await this.getDb();
    const record = await db.ManagementCompany.get(id);
    if (!record || record.organizationId !== organizationId) {
      return null;
    }

    return {
      id: record.id,
      nom: record.nom,
      contact: record.contact ?? null,
      email: record.email ?? null,
      telephone: record.telephone ?? null,
      modeCalcul: record.modeCalcul as any,
      taux: record.taux,
      fraisMin: record.fraisMin ?? null,
      baseSurEncaissement: record.baseSurEncaissement ?? true,
      tvaApplicable: record.tvaApplicable ?? false,
      tauxTva: record.tauxTva ?? null,
      actif: record.actif,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
  }

  async findAll(organizationId: string): Promise<ManagementCompany[]> {
    const db = await this.getDb();
    const records = await db.ManagementCompany
      .where('organizationId')
      .equals(organizationId)
      .toArray();

    return records.map((record: any) => ({
      id: record.id,
      nom: record.nom,
      contact: record.contact ?? null,
      email: record.email ?? null,
      telephone: record.telephone ?? null,
      modeCalcul: record.modeCalcul as any,
      taux: record.taux,
      fraisMin: record.fraisMin ?? null,
      baseSurEncaissement: record.baseSurEncaissement ?? true,
      tvaApplicable: record.tvaApplicable ?? false,
      tauxTva: record.tauxTva ?? null,
      actif: record.actif,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    }));
  }
}
