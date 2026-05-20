export const AUTH_SESSION_COOKIE = 'evcore_session';
export const AUTH_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN;

export const OTP_CODE_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_EXPIRES_IN_MINUTES = 10;

export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
export const PASSWORD_RESET_EXPIRES_IN_MINUTES = 15;
export const PASSWORD_RESET_RATE_LIMIT_MAX = 3;
export const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
