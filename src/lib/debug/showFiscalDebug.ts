/**
 * Panneaux DEBUG fiscal / transactions : uniquement si override explicite (y compris en local).
 */
export function showSmartimmoFiscalDebug(): boolean {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SMARTIMMO_DEBUG_FISCAL === 'true') {
    return true;
  }
  return false;
}
