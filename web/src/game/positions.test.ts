import { describe, expect, it } from 'vitest';
import { toCanvasPosition } from './positions.js';

describe('toCanvasPosition', () => {
  it('maps attention slot 0 to the first attention seat', () => {
    expect(toCanvasPosition('attention', 0)).toEqual({ x: 720, y: 120 });
  });

  it('maps desk slot 1 to the second desk', () => {
    expect(toCanvasPosition('desk', 1)).toEqual({ x: 340, y: 280 });
  });

  it('maps coffee slot 1 to the second coffee seat', () => {
    expect(toCanvasPosition('coffee', 1)).toEqual({ x: 180, y: 470 });
  });

  it('maps lounge slot 0 to the first lounge seat', () => {
    expect(toCanvasPosition('lounge', 0)).toEqual({ x: 500, y: 470 });
  });

  it('wraps slots when a zone has more agents than seats', () => {
    expect(toCanvasPosition('attention', 2)).toEqual({ x: 720, y: 120 });
  });
});
