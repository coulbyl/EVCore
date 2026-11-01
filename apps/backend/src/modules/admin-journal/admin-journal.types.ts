/** The kinds of human action the journal keeps (12-admin.md § 4). */
export type AdminActionKind =
  | 'setting'
  | 'market_reactivated'
  | 'role'
  | 'suspension'
  | 'account_deleted'
  | 'announcement'
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
