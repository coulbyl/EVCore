import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { RegisterDto } from './register.dto';

const base = {
  email: 'joueur@example.com',
  username: 'joueur_ci',
  fullName: 'Koffi Test',
  password: 'une phrase assez longue',
};

async function errorsFor(input: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(RegisterDto, input));
  return errors.map((e) => e.property);
}

describe('RegisterDto consent', () => {
  it('accepts a sign-up with age confirmed and terms accepted', async () => {
    expect(
      await errorsFor({ ...base, confirmAge: true, acceptTerms: true }),
    ).toEqual([]);
  });

  it('rejects a sign-up without the age confirmation', async () => {
    expect(await errorsFor({ ...base, acceptTerms: true })).toEqual([
      'confirmAge',
    ]);
  });

  it('rejects a sign-up without the terms accepted', async () => {
    expect(await errorsFor({ ...base, confirmAge: true })).toEqual([
      'acceptTerms',
    ]);
  });

  it('rejects truthy values that are not exactly true', async () => {
    expect(
      await errorsFor({ ...base, confirmAge: 'true', acceptTerms: 1 }),
    ).toEqual(['confirmAge', 'acceptTerms']);
  });
});
