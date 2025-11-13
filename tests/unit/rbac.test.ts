import { describe, it, expect } from 'vitest';
import { hasPerm } from '@/lib/rbac';

describe('RBAC hasPerm', () => {
  it('ADMIN a toutes les permissions admin:*', () => {
    expect(hasPerm('ADMIN', 'admin:*')).toBe(true);
  });
  it('USER ne peut pas leases:delete', () => {
    expect(hasPerm('USER', 'leases:delete')).toBe(false);
  });
  it('USER peut documents:classify', () => {
    expect(hasPerm('USER', 'documents:classify')).toBe(true);
  });
});




