import { Injectable } from '@nestjs/common';
import {
  LOGIN_CHALLENGE_MAX_ATTEMPTS,
  LOGIN_CHALLENGE_TTL_MS,
  LOGIN_TOTP_MAX_FAILURES,
  LOGIN_TOTP_FAILURE_WINDOW_MS,
  TOTP_USED_CODE_TTL_MS,
} from './auth.constants';
import { generateSessionToken, hashSessionToken } from './auth.utils';

type Challenge = {
  userId: string;
  /** Epoch ms after which the challenge is refused. */
  expiresAt: number;
  attempts: number;
};

type Failures = { count: number; windowStart: number };

/**
 * The step between a right password and an open session when the player has
 * an authenticator app (11 § 3): the password check hands out a short-lived
 * challenge, the six-digit code redeems it once.
 *
 * In memory, like `SessionCache`: the backend runs as one process. A restart
 * only costs the player retyping the password.
 *
 * Two limits, because the password alone mints new challenges: a few tries
 * per challenge, and a cap on wrong codes per player over a window, whatever
 * the challenge or the address it comes from.
 */
@Injectable()
export class LoginChallenges {
  private readonly challenges = new Map<string, Challenge>();
  private readonly failures = new Map<string, Failures>();
  /** `userId:code` → epoch ms until which that code is refused. */
  private readonly usedCodes = new Map<string, number>();

  issue(userId: string, now: number = Date.now()): string {
    this.prune(now);
    const token = generateSessionToken();
    this.challenges.set(hashSessionToken(token), {
      userId,
      expiresAt: now + LOGIN_CHALLENGE_TTL_MS,
      attempts: 0,
    });
    return token;
  }

  /**
   * The player a live challenge belongs to, counting this try against it, or
   * null when the challenge is unknown, expired, used up, or the player has
   * too many recent wrong codes.
   */
  begin(token: string, now: number = Date.now()): string | null {
    const key = hashSessionToken(token);
    const challenge = this.challenges.get(key);
    if (!challenge || challenge.expiresAt <= now) {
      this.challenges.delete(key);
      return null;
    }
    if (
      challenge.attempts >= LOGIN_CHALLENGE_MAX_ATTEMPTS ||
      this.isLockedOut(challenge.userId, now)
    ) {
      return null;
    }
    challenge.attempts += 1;
    return challenge.userId;
  }

  /** The code was right: the challenge cannot be redeemed twice. */
  succeed(token: string, userId: string): void {
    this.challenges.delete(hashSessionToken(token));
    this.failures.delete(userId);
  }

  fail(userId: string, now: number = Date.now()): void {
    const current = this.failures.get(userId);
    if (!current || now - current.windowStart >= LOGIN_TOTP_FAILURE_WINDOW_MS) {
      this.failures.set(userId, { count: 1, windowStart: now });
      return;
    }
    current.count += 1;
  }

  /**
   * Marks a code the authenticator accepted as used, or says it already
   * was: a code seen over a shoulder cannot open a second session or reset
   * the password within its validity window.
   */
  consumeCode(userId: string, code: string, now: number = Date.now()): boolean {
    const key = `${userId}:${code}`;
    const until = this.usedCodes.get(key);
    if (until !== undefined && until > now) return false;
    this.usedCodes.set(key, now + TOTP_USED_CODE_TTL_MS);
    return true;
  }

  /** Also read by the password reset by code, which needs no challenge. */
  isLockedOut(userId: string, now: number = Date.now()): boolean {
    const current = this.failures.get(userId);
    return (
      current !== undefined &&
      now - current.windowStart < LOGIN_TOTP_FAILURE_WINDOW_MS &&
      current.count >= LOGIN_TOTP_MAX_FAILURES
    );
  }

  private prune(now: number): void {
    for (const [key, challenge] of this.challenges) {
      if (challenge.expiresAt <= now) this.challenges.delete(key);
    }
    for (const [key, until] of this.usedCodes) {
      if (until <= now) this.usedCodes.delete(key);
    }
    for (const [userId, current] of this.failures) {
      if (now - current.windowStart >= LOGIN_TOTP_FAILURE_WINDOW_MS) {
        this.failures.delete(userId);
      }
    }
  }
}
