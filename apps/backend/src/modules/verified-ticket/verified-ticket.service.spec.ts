import { describe, expect, it, vi } from 'vitest';
import type { VerifiedTicketRepository } from './verified-ticket.repository';
import { VerifiedTicketService } from './verified-ticket.service';

function harness() {
  const create = vi.fn().mockResolvedValue(undefined);
  const service = new VerifiedTicketService({
    create,
  } as unknown as VerifiedTicketRepository);
  return { service, create };
}

describe('VerifiedTicketService.record', () => {
  it('keeps the shape of the ticket and the server day, nothing else', async () => {
    const { service, create } = harness();
    await service.record(
      { legCount: 8, totalOdds: 25.6289, chance: 0.0218765432109876 },
      new Date('2026-10-31T23:59:30Z'),
    );
    expect(create).toHaveBeenCalledWith({
      day: new Date('2026-10-31T00:00:00Z'),
      legCount: 8,
      totalOdds: '25.629',
      chance: '0.0218765432',
    });
  });

  it('does not count a ticket the columns cannot hold', async () => {
    const { service, create } = harness();
    await service.record({ legCount: 15, totalOdds: 2e12, chance: 1e-12 });
    expect(create).not.toHaveBeenCalled();
  });
});
