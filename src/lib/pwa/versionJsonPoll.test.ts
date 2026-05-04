import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  VERSION_POLL_SINGLETON_KEY,
  __resetVersionJsonPollForTests,
  fetchDeployVersionJson,
  tryStartVersionJsonPollLoop,
  VERSION_FETCH_MIN_GAP_MS,
} from './versionJsonPoll';

describe('versionJsonPoll', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    __resetVersionJsonPollForTests();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    __resetVersionJsonPollForTests();
    vi.unstubAllGlobals();
  });

  it('singleton empêche deux boucles sur le même window', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_FORCE_VERSION_POLL', '1');

    const w = {
      location: { hostname: 'api.example.com', port: '' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setInterval: vi.fn(() => 99),
      clearInterval: vi.fn(),
    };
    vi.stubGlobal('window', w as unknown as Window & typeof globalThis);
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const tick = vi.fn();
    const a = tryStartVersionJsonPollLoop({ onTick: tick, intervalMs: 60_000 });
    const b = tryStartVersionJsonPollLoop({ onTick: tick, intervalMs: 60_000 });

    expect(a).not.toBeNull();
    expect(b).toBeNull();
    expect((w as unknown as Window & Record<string, boolean>)[VERSION_POLL_SINGLETON_KEY]).toBe(
      true
    );

    a!.teardown();
    expect((w as unknown as Window & Record<string, boolean>)[VERSION_POLL_SINGLETON_KEY]).toBe(
      false
    );
  });

  it('throttle : deux fetch rapprochés → un seul appel réseau', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_FORCE_VERSION_POLL', '1');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ commit: 'abc', buildTime: '', deployEnv: 'production' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const win = {
      location: { hostname: 'api.example.com', port: '' },
    };
    vi.stubGlobal('window', win);

    await fetchDeployVersionJson();
    await fetchDeployVersionJson();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('après VERSION_FETCH_MIN_GAP_MS un second fetch est autorisé', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_FORCE_VERSION_POLL', '1');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ commit: 'abc', buildTime: '', deployEnv: 'production' }),
    });
    vi.stubGlobal('fetch', mockFetch);
    vi.stubGlobal('window', { location: { hostname: 'api.example.com', port: '' } });

    let t = 1_000_000;
    const spyNow = vi.spyOn(Date, 'now').mockImplementation(() => t);
    await fetchDeployVersionJson();
    t += VERSION_FETCH_MIN_GAP_MS + 1000;
    await fetchDeployVersionJson();
    spyNow.mockRestore();

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('cleanup retire singleton pour permettre un nouveau start', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_FORCE_VERSION_POLL', '1');

    const w = {
      location: { hostname: 'api.example.com', port: '' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn(),
    };
    vi.stubGlobal('window', w as unknown as Window & typeof globalThis);
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const first = tryStartVersionJsonPollLoop({ onTick: () => {}, intervalMs: 60_000 });
    expect(first).not.toBeNull();
    first!.teardown();

    const second = tryStartVersionJsonPollLoop({ onTick: () => {}, intervalMs: 60_000 });
    expect(second).not.toBeNull();
  });
});
