import { describe, expect, it } from 'vitest';
import { normalizeTeam, teamMatches } from './odds-historical-import.worker';

describe('OddsHistoricalImportWorker helpers', () => {
  it('normalizes accented team names and separators consistently', () => {
    expect(normalizeTeam('Bodø/Glimt')).toBe('bodo glimt');
    expect(normalizeTeam('Örebro SK')).toBe('orebro sk');
    expect(normalizeTeam('D.C. United')).toBe('dc united');
    expect(normalizeTeam('Çaykur Rizespor')).toBe('caykur rizespor');
  });

  it('matches DB team names to API team names with accent differences', () => {
    expect(
      teamMatches(
        { name: 'Bodo/Glimt', shortName: 'Bodo/Glimt' },
        'Bodø/Glimt',
      ),
    ).toBe(true);
    expect(
      teamMatches({ name: 'AIK Stockholm', shortName: 'AIK Stockholm' }, 'AIK'),
    ).toBe(true);
    expect(
      teamMatches(
        { name: 'D.C. United', shortName: 'D.C. United' },
        'DC United',
      ),
    ).toBe(true);
  });

  it('matches Swedish suffix variations like FF/IF and IK prefixes', () => {
    expect(
      teamMatches(
        { name: 'Hammarby FF', shortName: 'Hammarby FF' },
        'Hammarby IF',
      ),
    ).toBe(true);
    expect(
      teamMatches({ name: 'Halmstad', shortName: 'Halmstad' }, 'Halmstads BK'),
    ).toBe(true);
    expect(
      teamMatches({ name: 'Sirius', shortName: 'Sirius' }, 'IK Sirius'),
    ).toBe(true);
    expect(
      teamMatches(
        { name: 'Varbergs BoIS FC', shortName: 'Varbergs BoIS FC' },
        'Varbergs BoIS',
      ),
    ).toBe(true);
  });
});
