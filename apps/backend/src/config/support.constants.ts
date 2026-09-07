// Automated support-chat messages. Kept here rather than inline in the
// service/gateway so the copy can be tweaked without touching business
// logic — see modules/support/support-automation.service.ts for how it's
// used, and SupportAutomationService for the idempotence guarantee that
// makes it safe to trigger from more than one place.
export const SUPPORT_AUTOMATION_KEYS = {
  WELCOME: 'WELCOME',
} as const;

export const WELCOME_MESSAGE_CONTENT = `Bienvenue dans EVCore, et merci de nous avoir rejoints ! 👋

On est ravis de vous compter parmi nous. N'hésitez pas à explorer l'application, à tester les différentes fonctionnalités et à vous faire votre propre avis sur nos analyses.

Si vous tombez sur un bug, une explication pas claire, ou si quelque chose vous semble bizarre ou mal pensé — dites-le-nous ici, dans cette conversation. Vos retours (même les petits détails) sont ce qui nous permet de faire évoluer EVCore dans le bon sens.

On vous lit et on vous répond dès qu'on peut !`;
