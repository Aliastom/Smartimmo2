import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { shouldPollDeployVersion } from './deployVersionPoll';

function mockWindow(hostname: string, port: string): Window {
  return { location: { hostname, port } } as Window;
}

describe('shouldPollDeployVersion', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('NEXT_PUBLIC_FORCE_VERSION_POLL=1 → true même en development sur localhost', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_FORCE_VERSION_POLL', '1');
    expect(shouldPollDeployVersion(mockWindow('localhost', '3000'))).toBe(true);
  });

  it('NODE_ENV development sans FORCE → false', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(shouldPollDeployVersion(mockWindow('app.example.com', ''))).toBe(false);
  });

  it('production + localhost → false', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(shouldPollDeployVersion(mockWindow('localhost', '3000'))).toBe(false);
  });

  it('NEXT_PUBLIC_DISABLE_VERSION_POLL=1 → false même en prod', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_DISABLE_VERSION_POLL', '1');
    expect(shouldPollDeployVersion(mockWindow('smartimmo.vercel.app', ''))).toBe(false);
  });

  it('production + LAN + port 3000 → false', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(shouldPollDeployVersion(mockWindow('192.168.1.10', '3000'))).toBe(false);
  });

  it('production + hostname réel + pas de port dev → true', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(shouldPollDeployVersion(mockWindow('smartimmo.vercel.app', ''))).toBe(true);
  });
});
