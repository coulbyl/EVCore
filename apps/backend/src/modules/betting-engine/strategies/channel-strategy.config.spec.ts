import { describe, it, expect } from 'vitest';
import { getChannelStrategyConfig } from './channel-strategy.config';

describe('getChannelStrategyConfig — DOMINANT channel', () => {
  it('returns the BL1 DOMINANT config (enabled, threshold 0.5)', () => {
    const cfg = getChannelStrategyConfig('DOMINANT', 'BL1');
    expect(cfg.enabled).toBe(true);
    expect(cfg.threshold).toBe(0.5);
    expect(cfg.minSampleN).toBe(10);
  });

  it('returns disabled config for D2 (no threshold clears floor)', () => {
    const cfg = getChannelStrategyConfig('DOMINANT', 'D2');
    expect(cfg.enabled).toBe(false);
  });

  it('returns disabled config for CH (enabled: true, threshold 0.6)', () => {
    const cfg = getChannelStrategyConfig('DOMINANT', 'CH');
    expect(cfg.enabled).toBe(true);
    expect(cfg.threshold).toBe(0.6);
  });

  it('returns DOMINANT_DEFAULT (disabled, threshold 0.99) for unknown league', () => {
    const cfg = getChannelStrategyConfig('DOMINANT', 'UNKNOWN');
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });

  it('returns DOMINANT_DEFAULT for null competition code', () => {
    const cfg = getChannelStrategyConfig('DOMINANT', null);
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });

  it('returns DOMINANT_DEFAULT for undefined competition code', () => {
    const cfg = getChannelStrategyConfig('DOMINANT', undefined);
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });
});

describe('getChannelStrategyConfig — DRAW channel', () => {
  it('returns the POR DRAW config (enabled, threshold 0.30)', () => {
    const cfg = getChannelStrategyConfig('DRAW', 'POR');
    expect(cfg.enabled).toBe(true);
    expect(cfg.threshold).toBe(0.3);
  });

  it('returns the MX1 DRAW config (disabled, threshold 0.36)', () => {
    const cfg = getChannelStrategyConfig('DRAW', 'MX1');
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.36);
  });

  it('returns disabled for PL DRAW (explicitly disabled after backtest)', () => {
    const cfg = getChannelStrategyConfig('DRAW', 'PL');
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.34);
  });

  it('returns the BL1 DRAW config (enabled, threshold 0.28)', () => {
    const cfg = getChannelStrategyConfig('DRAW', 'BL1');
    expect(cfg.enabled).toBe(true);
    expect(cfg.threshold).toBe(0.28);
  });

  it('falls back to DRAW_DEFAULT for unknown league', () => {
    const cfg = getChannelStrategyConfig('DRAW', 'UNKNOWN');
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });

  it('falls back to DRAW_DEFAULT for null', () => {
    const cfg = getChannelStrategyConfig('DRAW', null);
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });
});

describe('getChannelStrategyConfig — BTTS channel', () => {
  it('returns the PL BTTS config (enabled, threshold 0.58)', () => {
    const cfg = getChannelStrategyConfig('BTTS', 'PL');
    expect(cfg.enabled).toBe(true);
    expect(cfg.threshold).toBe(0.58);
  });

  it('returns the SA BTTS config (enabled, threshold 0.52)', () => {
    const cfg = getChannelStrategyConfig('BTTS', 'SA');
    expect(cfg.enabled).toBe(true);
    expect(cfg.threshold).toBe(0.52);
  });

  it('returns the ERD BTTS config (enabled, threshold 0.6)', () => {
    const cfg = getChannelStrategyConfig('BTTS', 'ERD');
    expect(cfg.enabled).toBe(true);
    expect(cfg.threshold).toBe(0.6);
  });

  it('falls back to BTTS_DEFAULT for POR (no BTTS config defined)', () => {
    const cfg = getChannelStrategyConfig('BTTS', 'POR');
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });

  it('falls back to BTTS_DEFAULT for unknown league', () => {
    const cfg = getChannelStrategyConfig('BTTS', 'UNKNOWN');
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });

  it('falls back to BTTS_DEFAULT for null', () => {
    const cfg = getChannelStrategyConfig('BTTS', null);
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });
});

describe('getChannelStrategyConfig — channel isolation', () => {
  it('BL1: DOMINANT, DRAW and BTTS all enabled independently', () => {
    expect(getChannelStrategyConfig('DOMINANT', 'BL1').enabled).toBe(true);
    expect(getChannelStrategyConfig('BTTS', 'BL1').enabled).toBe(true);
    expect(getChannelStrategyConfig('DRAW', 'BL1').enabled).toBe(true);
  });

  it('PL: all three channels have independent configs', () => {
    const dominant = getChannelStrategyConfig('DOMINANT', 'PL');
    const draw = getChannelStrategyConfig('DRAW', 'PL');
    const btts = getChannelStrategyConfig('BTTS', 'PL');
    expect(dominant.enabled).toBe(true);
    expect(draw.enabled).toBe(false);
    expect(btts.enabled).toBe(true);
    expect(dominant.threshold).not.toBe(draw.threshold);
    expect(draw.threshold).not.toBe(btts.threshold);
  });

  it('MX1: DOMINANT and BTTS enabled, DRAW disabled — canaux indépendants', () => {
    expect(getChannelStrategyConfig('DOMINANT', 'MX1').enabled).toBe(true);
    expect(getChannelStrategyConfig('DRAW', 'MX1').enabled).toBe(false);
    expect(getChannelStrategyConfig('BTTS', 'MX1').enabled).toBe(true);
  });

  it('SA: DOMINANT, DRAW and BTTS all enabled independently', () => {
    expect(getChannelStrategyConfig('DOMINANT', 'SA').enabled).toBe(true);
    expect(getChannelStrategyConfig('BTTS', 'SA').enabled).toBe(true);
    expect(getChannelStrategyConfig('DRAW', 'SA').enabled).toBe(true);
  });
});
