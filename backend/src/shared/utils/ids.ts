import { customAlphabet } from 'nanoid';

/**
 * Public IDs. Never expose raw ObjectIds in URLs, WhatsApp invites, or QR
 * codes — they leak collection size and insert time (mongodb_schemas.ts).
 *
 * Alphabet excludes look-alikes (0/O, 1/l/I) because these get read aloud
 * over the phone during support calls.
 */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const nano = customAlphabet(ALPHABET, 12);
const nanoShort = customAlphabet('0123456789', 6);
const nanoToken = customAlphabet(ALPHABET, 32);

export function publicId(prefix: string): string {
  return `${prefix}_${nano()}`;
}

/** 6-digit code the arena verifies at the gate. */
export function checkInCode(): string {
  return nanoShort();
}

/** Team invite tokens, embedded in WhatsApp deep links. */
export function inviteToken(): string {
  return nanoToken();
}

export function referralCode(): string {
  return customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8)();
}
