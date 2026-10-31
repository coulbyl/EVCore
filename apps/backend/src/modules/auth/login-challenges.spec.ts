import { describe, expect, it } from 'vitest';
import {
  LOGIN_CHALLENGE_MAX_ATTEMPTS,
  LOGIN_CHALLENGE_TTL_MS,
  LOGIN_TOTP_FAILURE_WINDOW_MS,
  LOGIN_TOTP_MAX_FAILURES,
  TOTP_USED_CODE_TTL_MS,
} from './auth.constants';
import { LoginChallenges } from './login-challenges';

const T0 = 1_000_000;

describe('LoginChallenges', () => {
  it('hands the challenge back to its player', () => {
    const challenges = new LoginChallenges();
    const token = challenges.issue('user-1', T0);
    expect(challenges.begin(token, T0 + 1)).toBe('user-1');
  });

  it('refuses an unknown or expired challenge', () => {
    const challenges = new LoginChallenges();
    const token = challenges.issue('user-1', T0);
    expect(challenges.begin('autre', T0)).toBeNull();
    expect(challenges.begin(token, T0 + LOGIN_CHALLENGE_TTL_MS)).toBeNull();
  });

  it('cannot be redeemed after a success', () => {
    const challenges = new LoginChallenges();
    const token = challenges.issue('user-1', T0);
    challenges.succeed(token, 'user-1');
    expect(challenges.begin(token, T0)).toBeNull();
  });

  it('allows a few tries per challenge', () => {
    const challenges = new LoginChallenges();
    const token = challenges.issue('user-1', T0);
    for (let i = 0; i < LOGIN_CHALLENGE_MAX_ATTEMPTS; i++) {
      expect(challenges.begin(token, T0)).toBe('user-1');
    }
    expect(challenges.begin(token, T0)).toBeNull();
  });

  it('locks the player out across new challenges, then lets go', () => {
    const challenges = new LoginChallenges();
    for (let i = 0; i < LOGIN_TOTP_MAX_FAILURES; i++) {
      challenges.fail('user-1', T0);
    }
    const fresh = challenges.issue('user-1', T0);
    expect(challenges.begin(fresh, T0)).toBeNull();
    expect(challenges.begin(challenges.issue('user-2', T0), T0)).toBe('user-2');

    const later = T0 + LOGIN_TOTP_FAILURE_WINDOW_MS;
    expect(challenges.begin(challenges.issue('user-1', later), later)).toBe(
      'user-1',
    );
  });

  it('refuses a code already accepted, until it can no longer be valid', () => {
    const challenges = new LoginChallenges();
    expect(challenges.consumeCode('user-1', '123456', T0)).toBe(true);
    expect(challenges.consumeCode('user-1', '123456', T0 + 1_000)).toBe(false);
    expect(challenges.consumeCode('user-2', '123456', T0)).toBe(true);
    expect(
      challenges.consumeCode('user-1', '123456', T0 + TOTP_USED_CODE_TTL_MS),
    ).toBe(true);
  });
});
