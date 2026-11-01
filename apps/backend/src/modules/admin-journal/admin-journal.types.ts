/** The kinds of human action the journal keeps (12-admin.md § 4). */
export type AdminActionKind =
  | 'setting'
  | 'integration_set'
  | 'integration_cleared'
  | 'market_reactivated'
  | 'role'
  | 'suspension'
  | 'account_deleted'
  | 'announcement'
  | 'announcement_withdrawn'
  | 'announcement_deleted'
  | 'pass_relaunched'
  | 'queue_retried'
  | 'queue_cleared'
  | 'backfill_paused'
  | 'backfill_resumed'
  | 'settlement_replayed';

export type AdminActionEntry = {
  actorId: string;
  kind: AdminActionKind;
  target: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
};

/** A line of the journal, as Réglages shows it. */
export type AdminActionView = {
  id: string;
  at: string;
  actorId: string | null;
  actor: string;
  kind: string;
  target: string;
  before: unknown;
  after: unknown;
  reason: string | null;
};

/** The journal's filter by type (Réglages): which kinds each group holds. */
export const ADMIN_ACTION_GROUPS = {
  settings: ['setting', 'integration_set', 'integration_cleared'],
  operations: [
    'pass_relaunched',
    'queue_retried',
    'queue_cleared',
    'backfill_paused',
    'backfill_resumed',
    'settlement_replayed',
    'market_reactivated',
  ],
  accounts: ['role', 'suspension', 'account_deleted'],
  announcements: [
    'announcement',
    'announcement_withdrawn',
    'announcement_deleted',
  ],
} as const satisfies Record<string, readonly AdminActionKind[]>;

export type AdminActionGroup = keyof typeof ADMIN_ACTION_GROUPS;
