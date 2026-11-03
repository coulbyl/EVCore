import { describe, expect, it } from 'vitest';
import { TODAY_HERO_RELAY, TODAY_PRODUCTS } from '@config/screens.constants';
import {
  TODAY_PRODUCT_TARGETS,
  oddsBandOf,
  productOfTarget,
} from './today-products';

describe('today products — half-time draw hunter', () => {
  it('comes right after the draw hunter, on screen and in the hero relay', () => {
    for (const order of [TODAY_PRODUCTS, TODAY_HERO_RELAY]) {
      const list: readonly string[] = order;
      expect(list.indexOf('HUNTER_HT_DRAW')).toBe(
        list.indexOf('HUNTER_DRAW') + 1,
      );
    }
  });

  it('is read back from its own 2.10 target, with its 2.10–2.80 band', () => {
    expect(TODAY_PRODUCT_TARGETS).toContain(2.1);
    expect(productOfTarget(2.1)).toBe('HUNTER_HT_DRAW');
    expect(oddsBandOf('HUNTER_HT_DRAW')).toEqual({ min: 2.1, max: 2.8 });
  });

  it('gives every product of the screen a distinct target', () => {
    expect(new Set(TODAY_PRODUCT_TARGETS).size).toBe(
      TODAY_PRODUCT_TARGETS.length,
    );
  });
});
