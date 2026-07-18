import type { Zone } from '../../../server/protocol.js';

export type CanvasPosition = { x: number; y: number };

const positions: Record<Zone, readonly CanvasPosition[]> = {
  desk: [
    { x: 330, y: 335 },
    { x: 480, y: 335 },
    { x: 630, y: 335 }
  ],
  coffee: [
    { x: 150, y: 500 },
    { x: 245, y: 500 }
  ],
  lounge: [
    { x: 520, y: 500 },
    { x: 650, y: 500 }
  ],
  attention: [
    { x: 825, y: 155 },
    { x: 890, y: 155 }
  ]
};

export function toCanvasPosition(zone: Zone, slot: number): CanvasPosition {
  const seats = positions[zone];
  if (!seats) return { x: 0, y: 0 };
  const index = ((slot % seats.length) + seats.length) % seats.length;
  return seats[index] ?? { x: 0, y: 0 };
}

export function zoneSeatCount(zone: Zone): number {
  return positions[zone]?.length ?? 0;
}
