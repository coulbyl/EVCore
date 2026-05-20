import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import {
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_TTL_MS,
  COOKIE_DOMAIN,
} from './auth.constants';

const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 128 * SCRYPT_N * SCRYPT_R * SCRYPT_P * 2; // 64 MB

export function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  }).toString('hex');
  return `${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');

  let N: number;
  let r: number;
  let p: number;
  let salt: string;
  let expectedHash: string;

  if (parts.length === 5) {
    // Current format: "N:r:p:salt:hash"
    [N, r, p] = [Number(parts[0]), Number(parts[1]), Number(parts[2])];
    salt = parts[3] ?? '';
    expectedHash = parts[4] ?? '';
  } else if (parts.length === 2) {
    // Legacy format: "salt:hash" (N=16384 default)
    N = 16384;
    r = 8;
    p = 1;
    salt = parts[0] ?? '';
    expectedHash = parts[1] ?? '';
  } else {
    return false;
  }

  if (!salt || !expectedHash || !N || !r || !p) return false;

  const maxmem = 128 * N * r * p * 2;
  const actualHash = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N,
    r,
    p,
    maxmem,
  }).toString('hex');
  return timingSafeEqual(
    Buffer.from(actualHash, 'hex'),
    Buffer.from(expectedHash, 'hex'),
  );
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function parseCookieHeader(
  cookieHeader?: string,
): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, pair) => {
    const index = pair.indexOf('=');
    if (index === -1) return acc;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

export function buildSessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${AUTH_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(AUTH_SESSION_TTL_MS / 1000)}`,
  ];
  if (COOKIE_DOMAIN) parts.push(`Domain=${COOKIE_DOMAIN}`);
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function generateOtpCode(): string {
  return String(Math.floor(100000 + (randomBytes(4).readUInt32BE(0) % 900000)));
}

export function hashOtpCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function generateResetToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const AES_ALGO = 'aes-256-gcm';
const AES_KEY_LEN = 32;
const AES_IV_LEN = 12;
const AES_TAG_LEN = 16;

function deriveAesKey(secret: string): Buffer {
  return scryptSync(secret, 'evcore-totp-salt', AES_KEY_LEN) as Buffer;
}

export function encryptTotpSecret(
  plaintext: string,
  appSecret: string,
): string {
  const key = deriveAesKey(appSecret);
  const iv = randomBytes(AES_IV_LEN);
  const cipher = createCipheriv(AES_ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptTotpSecret(
  ciphertext: string,
  appSecret: string,
): string {
  const key = deriveAesKey(appSecret);
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, AES_IV_LEN);
  const tag = buf.subarray(AES_IV_LEN, AES_IV_LEN + AES_TAG_LEN);
  const encrypted = buf.subarray(AES_IV_LEN + AES_TAG_LEN);
  const decipher = createDecipheriv(AES_ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

export function buildExpiredSessionCookie(secure: boolean): string {
  const parts = [
    `${AUTH_SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (COOKIE_DOMAIN) parts.push(`Domain=${COOKIE_DOMAIN}`);
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
