/**
 * Utilitaires PIN / appareil de confiance (local uniquement)
 * Stockage léger via localStorage + sessionStorage.
 */

const TRUST_FLAG_KEY = 'appShell_trusted_device';
const PIN_SALT_KEY = 'appShell_pin_salt';
const PIN_HASH_KEY = 'appShell_pin_hash';
const PIN_UNLOCKED_KEY = 'appShell_pin_unlocked';
const TRUST_PROMPT_DISMISSED_KEY = 'appShell_trust_prompt_dismissed';

const LOCAL_USER_KEY = 'appShell_localUser';
const ORGANIZATION_ID_KEY = 'organizationId';

function bufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomSaltHex(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bufferToHex(arr.buffer);
}

async function sha256Hex(input: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(digest);
}

export function isTrustedDeviceEnabled() {
  if (typeof window === 'undefined') return false;
  const flag = localStorage.getItem(TRUST_FLAG_KEY);
  const salt = localStorage.getItem(PIN_SALT_KEY);
  const hash = localStorage.getItem(PIN_HASH_KEY);
  return flag === 'true' && Boolean(salt) && Boolean(hash);
}

export function isTrustPromptDismissed() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(TRUST_PROMPT_DISMISSED_KEY) === 'true';
}

export function dismissTrustPrompt() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TRUST_PROMPT_DISMISSED_KEY, 'true');
}

export function isPinUnlocked() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(PIN_UNLOCKED_KEY) === 'true';
}

export function setPinUnlocked() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(PIN_UNLOCKED_KEY, 'true');
}

export function clearPinUnlocked() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(PIN_UNLOCKED_KEY);
}

export async function setupTrustedDevice(pin: string) {
  if (typeof window === 'undefined') return false;
  const salt = randomSaltHex(16);
  const hash = await sha256Hex(`${salt}:${pin}`);
  localStorage.setItem(TRUST_FLAG_KEY, 'true');
  localStorage.setItem(PIN_SALT_KEY, salt);
  localStorage.setItem(PIN_HASH_KEY, hash);
  localStorage.setItem(TRUST_PROMPT_DISMISSED_KEY, 'true');
  setPinUnlocked();
  return true;
}

export async function verifyPin(pin: string) {
  if (typeof window === 'undefined') return false;
  const salt = localStorage.getItem(PIN_SALT_KEY);
  const hash = localStorage.getItem(PIN_HASH_KEY);
  if (!salt || !hash) return false;
  const computed = await sha256Hex(`${salt}:${pin}`);
  return computed === hash;
}

export function disableTrustedDevice() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TRUST_FLAG_KEY);
  localStorage.removeItem(PIN_SALT_KEY);
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(TRUST_PROMPT_DISMISSED_KEY);
  clearPinUnlocked();
}

export function clearLocalAccessState() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCAL_USER_KEY);
  localStorage.removeItem(ORGANIZATION_ID_KEY);
  disableTrustedDevice();
}
