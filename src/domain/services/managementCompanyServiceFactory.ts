/**
 * Factory pour créer ManagementCompanyService selon le mode
 */

import { ManagementCompanyService } from './ManagementCompanyService';
import { IndexedDBManagementCompanyRepository } from '@/domain/repositories/adapters/IndexedDBManagementCompanyRepository';
import { ApiManagementCompanyRepository } from '@/domain/repositories/adapters/ApiManagementCompanyRepository';
import { IndexedDBPropertyRepository } from '@/domain/repositories/adapters/IndexedDBPropertyRepository';

export function createManagementCompanyServiceWithMode(mode: 'normal' | 'app-shell') {
  if (mode === 'app-shell') {
    return new ManagementCompanyService({
      managementCompanyRepo: new IndexedDBManagementCompanyRepository(),
      propertyRepo: new IndexedDBPropertyRepository(),
    });
  }

  return new ManagementCompanyService({
    managementCompanyRepo: new ApiManagementCompanyRepository(),
  });
}
