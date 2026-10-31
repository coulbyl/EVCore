// Automated support-chat messages. Kept here rather than inline in the
// service/gateway so the copy can be tweaked without touching business
// logic — see modules/support/support-automation.service.ts for how it's
// used, and SupportAutomationService for the idempotence guarantee that
// makes it safe to trigger from more than one place.
export const SUPPORT_AUTOMATION_KEYS = {
  WELCOME: 'WELCOME',
} as const;

// Tutoiement, as every text of the player's app (31/10).
export const WELCOME_MESSAGE_CONTENT = `Bienvenue dans EVCore, et merci d'être là ! 👋

Si tu tombes sur un bug, une explication pas claire ou quelque chose qui te semble bizarre, dis-le-nous ici, dans cette conversation. Même les petits détails nous aident à faire évoluer EVCore.

On te répond dès qu'on peut.`;
