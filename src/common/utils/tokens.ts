import { randomBytes } from 'crypto';

export function randomToken(byteLength: number): string {
  return randomBytes(byteLength).toString('base64url');
}

/** Short invite codes for share-sheet messages (~48 bits). */
export function inviteToken(): string {
  return randomToken(6).slice(0, 8);
}

/** Opaque pay-link token (≥128 bits). */
export function payToken(): string {
  return randomToken(16);
}
