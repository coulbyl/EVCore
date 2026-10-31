import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { MailService } from '@modules/mail/mail.service';
import { ConsoleWatchService } from './console-watch.service';
import type { ConsoleRepository } from './console.repository';
import type { ConsoleService } from './console.service';
import type { ConsoleStatus, LightState } from './console.types';

/** The console_light table, with the same rules as its SQL. */
function fakeTable() {
  const rows = new Map<string, { state: string; notifiedAt: Date | null }>();
  return {
    rows,
    recordLight: vi.fn(({ light, state }: { light: string; state: string }) => {
      const row = rows.get(light);
      rows.set(light, {
        state,
        notifiedAt: row && row.state === state ? row.notifiedAt : null,
      });
      return Promise.resolve();
    }),
    claimRedNotice: vi.fn((light: string, now: Date) => {
      const row = rows.get(light);
      if (!row || row.state !== 'red' || row.notifiedAt) {
        return Promise.resolve(false);
      }
      row.notifiedAt = now;
      return Promise.resolve(true);
    }),
  };
}

function harness() {
  let engine: LightState = 'green';
  const table = fakeTable();
  const mail = { sendOpsLightRed: vi.fn(() => Promise.resolve()) };
  const console = {
    getStatus: vi.fn(
      (): Promise<ConsoleStatus> =>
        Promise.resolve({
          at: '',
          lights: { data: 'green', engine, players: 'green' },
          since: { data: null, engine: null, players: null },
          yesterday: { active: 0, follows: 0, signups: 0 },
          passesOff: null,
          todo:
            engine === 'red'
              ? [
                  {
                    kind: 'coupons_missing',
                    light: 'engine',
                    severity: 'red',
                    forDate: '2026-11-02',
                  },
                ]
              : [],
        }),
    ),
  };
  const service = new ConsoleWatchService(
    console as unknown as ConsoleService,
    table as unknown as ConsoleRepository,
    mail as unknown as MailService,
    { get: () => 'https://evcore.app' } as unknown as ConfigService,
  );
  return { service, mail, setEngine: (s: LightState) => (engine = s) };
}

describe('ConsoleWatchService', () => {
  it('one e-mail when a light turns red, none while it stays red', async () => {
    const { service, mail, setEngine } = harness();
    setEngine('red');
    expect((await service.check()).sent).toEqual(['engine']);
    expect((await service.check()).sent).toEqual([]);
    expect(mail.sendOpsLightRed).toHaveBeenCalledTimes(1);
    expect(mail.sendOpsLightRed).toHaveBeenCalledWith(
      expect.objectContaining({
        light: 'Moteur',
        lines: ['Aucun coupon pour demain, 2026-11-02'],
        url: 'https://evcore.app/admin',
      }),
    );
  });

  it('back to green then red again: a second e-mail', async () => {
    const { service, mail, setEngine } = harness();
    setEngine('red');
    await service.check();
    setEngine('green');
    await service.check();
    setEngine('red');
    await service.check();
    expect(mail.sendOpsLightRed).toHaveBeenCalledTimes(2);
  });

  it('orange never writes', async () => {
    const { service, mail, setEngine } = harness();
    setEngine('orange');
    await service.check();
    expect(mail.sendOpsLightRed).not.toHaveBeenCalled();
  });
});
