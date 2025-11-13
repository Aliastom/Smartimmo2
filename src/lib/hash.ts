import { createHash } from "crypto";

/**
 * Calcule le hash SHA-256 d'un buffer
 * @param buf Buffer à hasher
 * @returns Hash SHA-256 en hexadécimal
 */
export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Calcule le hash SHA-256 d'une string
 * @param str String à hasher
 * @returns Hash SHA-256 en hexadécimal
 */
export function sha256HexString(str: string): string {
  return createHash("sha256").update(str, 'utf8').digest("hex");
}
