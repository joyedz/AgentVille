import { describe, expect, it } from 'vitest';
import { toCanvasPosition } from './positions.js';

describe('toCanvasPosition', () => {
  it('maps every desk slot to the floor anchors in front of its chair', () => {
    expect(toCanvasPosition('desk', 0)).toEqual({ x: 330, y: 335 });
    expect(toCanvasPosition('desk', 1)).toEqual({ x: 480, y: 335 });
    expect(toCanvasPosition('desk', 2)).toEqual({ x: 630, y: 335 });
  });

  it('keeps the coffee, lounge, and attention anchors unchanged', () => {
    expect(toCanvasPosition('coffee', 0)).toEqual({ x: 150, y: 500 });
    expect(toCanvasPosition('coffee', 1)).toEqual({ x: 245, y: 500 });
    expect(toCanvasPosition('lounge', 0)).toEqual({ x: 520, y: 500 });
    expect(toCanvasPosition('lounge', 1)).toEqual({ x: 650, y: 500 });
    expect(toCanvasPosition('attention', 0)).toEqual({ x: 825, y: 155 });
    expect(toCanvasPosition('attention', 1)).toEqual({ x: 890, y: 155 });
  });

  it('wraps slots when a zone has more agents than seats', () => {
    expect(toCanvasPosition('attention', 2)).toEqual({ x: 825, y: 155 });
  });
});
