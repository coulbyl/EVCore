import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Réglages › Intégrations (revue admin du 01/11, on the model of iddia's
 * integrations): the third-party services' keys and addresses, stored in
 * `integration_setting`, a secret encrypted with SETTINGS_ENCRYPTION_KEY and
 * never sent back to a screen. A field without a row keeps reading its
 * environment variable: moving a value from the `.env` changes nothing until
 * it is written here, then the variable can go.
 *
 * Read by apps/backend (API-Football, The Odds API, e-mail, push, storage)
 * and apps/vantage-worker (the LLM providers, web research).
 */
export type IntegrationField = {
  /** The row's key, `<integration>.<field>`. */
  key: string;
  /** The environment variable it replaces. */
  env: string;
  /** Encrypted and never shown again; only replaced. */
  secret: boolean;
};

export type IntegrationKey =
  | "apiFootball"
  | "theOddsApi"
  | "email"
  | "push"
  | "storage"
  | "groq"
  | "cerebras"
  | "together"
  | "fireworks"
  | "tavily";

export const INTEGRATIONS: readonly {
  key: IntegrationKey;
  fields: readonly IntegrationField[];
}[] = [
  {
    key: "apiFootball",
    fields: [{ key: "apiFootball.key", env: "API_FOOTBALL_KEY", secret: true }],
  },
  {
    key: "theOddsApi",
    fields: [{ key: "theOddsApi.key", env: "THE_ODDS_API_KEY", secret: true }],
  },
  {
    key: "email",
    fields: [
      { key: "email.apiKey", env: "RESEND_API_KEY", secret: true },
      { key: "email.from", env: "RESEND_FROM", secret: false },
      { key: "email.adminTo", env: "RESEND_ADMIN_TO", secret: false },
    ],
  },
  {
    key: "push",
    fields: [
      { key: "push.publicKey", env: "VAPID_PUBLIC_KEY", secret: false },
      { key: "push.privateKey", env: "VAPID_PRIVATE_KEY", secret: true },
      { key: "push.subject", env: "VAPID_SUBJECT", secret: false },
    ],
  },
  {
    key: "storage",
    fields: [
      { key: "storage.endpoint", env: "RUSTFS_ENDPOINT", secret: false },
      {
        key: "storage.publicEndpoint",
        env: "RUSTFS_PUBLIC_ENDPOINT",
        secret: false,
      },
      { key: "storage.region", env: "RUSTFS_REGION", secret: false },
      { key: "storage.bucket", env: "RUSTFS_BUCKET", secret: false },
      { key: "storage.accessKey", env: "RUSTFS_ACCESS_KEY", secret: true },
      { key: "storage.secretKey", env: "RUSTFS_SECRET_KEY", secret: true },
    ],
  },
  {
    key: "groq",
    fields: [{ key: "groq.apiKey", env: "GROQ_API_KEY", secret: true }],
  },
  {
    key: "cerebras",
    fields: [{ key: "cerebras.apiKey", env: "CEREBRAS_API_KEY", secret: true }],
  },
  {
    key: "together",
    fields: [{ key: "together.apiKey", env: "TOGETHER_API_KEY", secret: true }],
  },
  {
    key: "fireworks",
    fields: [
      { key: "fireworks.apiKey", env: "FIREWORKS_API_KEY", secret: true },
    ],
  },
  {
    key: "tavily",
    fields: [{ key: "tavily.apiKey", env: "TAVILY_API_KEY", secret: true }],
  },
];

export const INTEGRATION_FIELDS: readonly IntegrationField[] =
  INTEGRATIONS.flatMap((i) => i.fields);

export function integrationFieldOf(key: string): IntegrationField | null {
  return INTEGRATION_FIELDS.find((f) => f.key === key) ?? null;
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/** A 32-byte AES-256 key from SETTINGS_ENCRYPTION_KEY, whatever its length. */
export function deriveSettingsKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

/** A secret for storage: iv:authTag:ciphertext, each base64. */
export function encryptSetting(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString("base64"))
    .join(":");
}

/** Reverses encryptSetting; throws on a malformed value or another key. */
export function decryptSetting(encrypted: string, key: Buffer): string {
  const [iv, tag, text] = encrypted.split(":");
  if (!iv || !tag || text === undefined) {
    throw new Error("Malformed encrypted setting");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(text, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * The stored values, decrypted: field key → value. A secret that cannot be
 * read (no key, another key) is left out, so its environment variable keeps
 * serving, and named in `unreadable`.
 */
export function readIntegrationRows(
  rows: readonly { key: string; value: string; secret: boolean }[],
  key: Buffer | null,
): { values: Map<string, string>; unreadable: string[] } {
  const values = new Map<string, string>();
  const unreadable: string[] = [];
  for (const row of rows) {
    if (!integrationFieldOf(row.key)) continue;
    if (!row.secret) {
      values.set(row.key, row.value);
      continue;
    }
    if (!key) {
      unreadable.push(row.key);
      continue;
    }
    try {
      values.set(row.key, decryptSetting(row.value, key));
    } catch {
      unreadable.push(row.key);
    }
  }
  return { values, unreadable };
}
