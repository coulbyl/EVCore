/**
 * The bell looks back this far (list and unread badge): an alert never
 * read in three months no longer counts. Nothing is deleted — the rows
 * stay the record of what was sent, which the retention measures and the
 * console count over longer cohorts.
 */
export const NOTIFICATION_BELL_WINDOW_DAYS = 90;
