import { describe, it, expect } from 'vitest';
import { hasCommitMismatch, getBootAppVersion } from '@/lib/pwa/bootAppVersion';

describe('hasCommitMismatch', () => {
  it('retourne true si les commits diffèrent', () => {
    expect(
      hasCommitMismatch(
        { commit: 'abc', buildTime: '', deployEnv: 'production' },
        { commit: 'def', buildTime: '', deployEnv: 'production' },
      ),
    ).toBe(true);
  });

  it('retourne false si les commits sont identiques', () => {
    expect(
      hasCommitMismatch(
        { commit: 'abc123', buildTime: '', deployEnv: 'production' },
        { commit: 'abc123', buildTime: '', deployEnv: 'production' },
      ),
    ).toBe(false);
  });

  it('ignore si le bundle est « local »', () => {
    expect(
      hasCommitMismatch(
        { commit: 'abc', buildTime: '', deployEnv: 'production' },
        { commit: 'local', buildTime: '', deployEnv: 'development' },
      ),
    ).toBe(false);
  });

  it('ignore si le serveur annonce unknown', () => {
    expect(
      hasCommitMismatch(
        { commit: 'unknown', buildTime: '', deployEnv: 'production' },
        { commit: 'abc', buildTime: '', deployEnv: 'production' },
      ),
    ).toBe(false);
  });
});

describe('getBootAppVersion', () => {
  it('retourne un objet avec les champs attendus', () => {
    const v = getBootAppVersion();
    expect(v).toHaveProperty('commit');
    expect(v).toHaveProperty('buildTime');
    expect(v).toHaveProperty('deployEnv');
  });
});
