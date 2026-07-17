import { describe, expect, it } from 'vitest';
import { toCanvasPosition } from './positions.js';

describe('toCanvasPosition', () => {
  it('maps attention slot 0 to the first attention seat', () => {
    expect(toCanvasPosition('attention', 0)).toEqual({ x: 720, y: 120 });
  });

  it('maps desk slot 1 to the second desk', () => {
    expect(toCanvasPosition('desk', 1)).toEqual({ x: 340, y: 280 });
  });
});
