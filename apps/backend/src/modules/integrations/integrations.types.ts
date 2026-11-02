import type { IntegrationKey } from '@evcore/db';

/** A field of Réglages › Intégrations, as the screen sees it. */
export type IntegrationFieldView = {
  key: string;
  /** The environment variable it replaces. */
  env: string;
  secret: boolean;
  /** Where the value served comes from. */
  source: 'stored' | 'env' | 'none';
  /** Stored but not decryptable with the current key. */
  unreadable: boolean;
  /** An address or a name; always null for a secret. */
  value: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type IntegrationView = {
  key: IntegrationKey;
  fields: IntegrationFieldView[];
};

/** « Tester la connexion »: the outcome said in words. */
export type IntegrationTestResult = {
  ok: boolean;
  /** A short fact: « quota 5 924 / 7 500 », « 3 modèles », or the error. */
  detail: string;
};
