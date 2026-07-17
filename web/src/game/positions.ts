import type { Zone } from '../../../server/protocol.js';

export type CanvasPosition = { x: number; y: number };

const positions: Record<Zone, readonly CanvasPosition[]> = {
  desk: [
    { x: 260, y: 280 },
    { x: 340, y: 280 },
    { x: 420, y: 280 }
  ],
  coffee: [
    { x: 120, y: 470 },
    { x: 180, y: 470 }
  ],
  lounge: [
    { x: 500, y: 470 },
    { x: 570, y: 470 }
  ],
  attention: [
    { x: 720, y: 120 },
    { x: 780, y: 120 }
  ]
};

export function toCanvasPosition(zone: Zone, slot: number): CanvasPosition {
  const seats = positions[zone];
  if (!seats) return { x: 0, y: 0 };
  const index = ((slot % seats.length) + seats.length) % seats.length;
  return seats[index] ?? { x: 0, y: 0 };
}
