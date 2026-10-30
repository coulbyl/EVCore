export const AUTH_SESSION_COOKIE = 'evcore_session';
export const AUTH_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN;

export const OTP_CODE_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_EXPIRES_IN_MINUTES = 10;

// Connexion avec application d'authentification (11 § 3) : le mot de passe
// donne un défi court, le code à six chiffres l'échange contre une session.
export const LOGIN_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const LOGIN_CHALLENGE_MAX_ATTEMPTS = 5;
// Mauvais codes par joueur, tous défis confondus : le mot de passe seul
// permet d'en obtenir d'autres.
export const LOGIN_TOTP_MAX_FAILURES = 10;
export const LOGIN_TOTP_FAILURE_WINDOW_MS = 15 * 60 * 1000;
// Un code accepté ne resert pas : retenu plus longtemps que sa tolérance
// (30 s par pas, un pas de part et d'autre au plus).
export const TOTP_USED_CODE_TTL_MS = 2 * 60 * 1000;

export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
export const PASSWORD_RESET_EXPIRES_IN_MINUTES = 15;
export const PASSWORD_RESET_RATE_LIMIT_MAX = 3;
export const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Version des conditions d'utilisation et de la politique de confidentialité
 * acceptées à l'inscription (date de mise à jour des pages /cgu et
 * /confidentialite). À changer en même temps que ces pages.
 */
export const TERMS_VERSION = '2026-10-27';
