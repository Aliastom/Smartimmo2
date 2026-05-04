/**
 * Indique si le polling `/version.json` et la logique SW « prod » sont autorisés.
 *
 * Ordre des règles (priorité décroissante) :
 * 1. NEXT_PUBLIC_FORCE_VERSION_POLL=1 → true (test local / staging volontaire)
 * 2. NEXT_PUBLIC_DISABLE_VERSION_POLL=1 → false
 * 3. NODE_ENV !== 'production' → false
 * 4. hostname loopback → false
 * 5. ports dev typiques (3000–3003) → false
 * 6. sinon production déployée → true
 */
export function shouldPollDeployVersion(win: Window): boolean {
  if (process.env.NEXT_PUBLIC_FORCE_VERSION_POLL === '1') {
    return true;
  }
  if (process.env.NEXT_PUBLIC_DISABLE_VERSION_POLL === '1') {
    return false;
  }
  if (process.env.NODE_ENV !== 'production') {
    return false;
  }

  const { hostname, port } = win.location;

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]'
  ) {
    return false;
  }

  const devPorts = new Set(['3000', '3001', '3002', '3003']);
  if (devPorts.has(port)) {
    return false;
  }

  return true;
}
