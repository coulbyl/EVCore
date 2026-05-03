import { describe, it, expect } from 'vitest';
import { PredictionChannel } from '@evcore/db';
import { getPredictionConfig } from './prediction.constants';

describe('getPredictionConfig — CONF channel', () => {
  it('returns the BL1 CONF config (enabled, threshold 0.5)', () => {
    const cfg = getPredictionConfig(PredictionChannel.CONF, 'BL1');
    expect(cfg.enabled).toBe(true);
    expect(cfg.threshold).toBe(0.5);
    expect(cfg.minSampleN).toBe(10);
  });

  it('returns disabled config for D2 (no threshold clears floor)', () => {
    const cfg = getPredictionConfig(PredictionChannel.CONF, 'D2');
    expect(cfg.enabled).toBe(false);
  });

  it('returns disabled config for CH (enabled: true, threshold 0.6)', () => {
    const cfg = getPredictionConfig(PredictionChannel.CONF, 'CH');
    expect(cfg.enabled).toBe(true);
    expect(cfg.threshold).toBe(0.6);
  });

  it('returns CONF_DEFAULT (disabled, threshold 0.99) for unknown league', () => {
    const cfg = getPredictionConfig(PredictionChannel.CONF, 'UNKNOWN');
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });

  it('returns CONF_DEFAULT for null competition code', () => {
    const cfg = getPredictionConfig(PredictionChannel.CONF, null);
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });

  it('returns CONF_DEFAULT for undefined competition code', () => {
    const cfg = getPredictionConfig(PredictionChannel.CONF, undefined);
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });
});

describe('getPredictionConfig — DRAW channel', () => {
  it('returns the POR DRAW config (disabled, threshold 0.35)', () => {
    const cfg = getPredictionConfig(PredictionChannel.DRAW, 'POR');
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.35);
  });

  it('returns the MX1 DRAW config (disabled, threshold 0.36)', () => {
    const cfg = getPredictionConfig(PredictionChannel.DRAW, 'MX1');
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.36);
  });

  it('returns disabled for PL DRAW (explicitly disabled after backtest)', () => {
    const cfg = getPredictionConfig(PredictionChannel.DRAW, 'PL');
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.34);
  });

  it('falls back to DRAW_DEFAULT for BL1 (no DRAW config defined)', () => {
    const cfg = getPredictionConfig(PredictionChannel.DRAW, 'BL1');
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });

  it('falls back to DRAW_DEFAULT for unknown league', () => {
    const cfg = getPredictionConfig(PredictionChannel.DRAW, 'UNKNOWN');
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });

  it('falls back to DRAW_DEFAULT for null', () => {
    const cfg = getPredictionConfig(PredictionChannel.DRAW, null);
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });
});

describe('getPredictionConfig — BTTS channel', () => {
  it('returns the PL BTTS config (enabled, threshold 0.58)', () => {
    const cfg = getPredictionConfig(PredictionChannel.BTTS, 'PL');
    expect(cfg.enabled).toBe(true);
    expect(cfg.threshold).toBe(0.58);
  });

  it('returns the SA BTTS config (enabled, threshold 0.52)', () => {
    const cfg = getPredictionConfig(PredictionChannel.BTTS, 'SA');
    expect(cfg.enabled).toBe(true);
    expect(cfg.threshold).toBe(0.52);
  });

  it('returns the ERD BTTS config (enabled, threshold 0.6)', () => {
    const cfg = getPredictionConfig(PredictionChannel.BTTS, 'ERD');
    expect(cfg.enabled).toBe(true);
    expect(cfg.threshold).toBe(0.6);
  });

  it('falls back to BTTS_DEFAULT for POR (no BTTS config defined)', () => {
    const cfg = getPredictionConfig(PredictionChannel.BTTS, 'POR');
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });

  it('falls back to BTTS_DEFAULT for unknown league', () => {
    const cfg = getPredictionConfig(PredictionChannel.BTTS, 'UNKNOWN');
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });

  it('falls back to BTTS_DEFAULT for null', () => {
    const cfg = getPredictionConfig(PredictionChannel.BTTS, null);
    expect(cfg.enabled).toBe(false);
    expect(cfg.threshold).toBe(0.99);
  });
});

describe('getPredictionConfig — channel isolation', () => {
  it('BL1: CONF and BTTS enabled, DRAW falls to default', () => {
    expect(getPredictionConfig(PredictionChannel.CONF, 'BL1').enabled).toBe(
      true,
    );
    expect(getPredictionConfig(PredictionChannel.BTTS, 'BL1').enabled).toBe(
      true,
    );
    expect(getPredictionConfig(PredictionChannel.DRAW, 'BL1').enabled).toBe(
      false,
    );
  });

  it('PL: all three channels have independent configs', () => {
    const conf = getPredictionConfig(PredictionChannel.CONF, 'PL');
    const draw = getPredictionConfig(PredictionChannel.DRAW, 'PL');
    const btts = getPredictionConfig(PredictionChannel.BTTS, 'PL');
    expect(conf.enabled).toBe(true);
    expect(draw.enabled).toBe(false);
    expect(btts.enabled).toBe(true);
    expect(conf.threshold).not.toBe(draw.threshold);
    expect(draw.threshold).not.toBe(btts.threshold);
  });

  it('MX1: CONF and BTTS enabled, DRAW disabled — canaux indépendants', () => {
    expect(getPredictionConfig(PredictionChannel.CONF, 'MX1').enabled).toBe(
      true,
    );
    expect(getPredictionConfig(PredictionChannel.DRAW, 'MX1').enabled).toBe(
      false,
    );
    expect(getPredictionConfig(PredictionChannel.BTTS, 'MX1').enabled).toBe(
      true,
    );
  });

  it('SA: CONF and BTTS enabled, DRAW disabled — canaux indépendants', () => {
    expect(getPredictionConfig(PredictionChannel.CONF, 'SA').enabled).toBe(
      true,
    );
    expect(getPredictionConfig(PredictionChannel.BTTS, 'SA').enabled).toBe(
      true,
    );
    expect(getPredictionConfig(PredictionChannel.DRAW, 'SA').enabled).toBe(
      false,
    );
  });
});
