import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agentPresentation, officeAssetManifest, officeCanvas } from './office-assets.js';

function imageRows(bytes: Buffer, width: number, height: number): Buffer {
  const chunks: Buffer[] = [];
  let position = 8;
  while (position < bytes.length) {
    const length = bytes.readUInt32BE(position);
    const kind = bytes.toString('ascii', position + 4, position + 8);
    if (kind === 'IDAT') chunks.push(bytes.subarray(position + 8, position + 8 + length));
    position += length + 12;
  }
  const decoded = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const rows = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    expect(decoded[y * (stride + 1)]).toBe(0);
    decoded.copy(rows, y * stride, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
  }
  return rows;
}

function frameBytes(rows: Buffer, sheetWidth: number, frame: number): Buffer {
  const pixels: Buffer[] = [];
  for (let y = 0; y < 72; y += 1) {
    const start = (y * sheetWidth + frame * 48) * 4;
    pixels.push(rows.subarray(start, start + 48 * 4));
  }
  return Buffer.concat(pixels);
}

describe('office asset contract', () => {
  it('uses the scaled four-frame walk presentation contract for agents', () => {
    expect(agentPresentation).toEqual({
      scale: 1.5,
      frameDurationMs: 90,
      frameWidth: 48,
      frameHeight: 72,
      walkFrames: [4, 5, 6, 7]
    });
  });

  it('uses a fixed pixel-art canvas and stable asset URLs', () => {
    expect(officeCanvas).toEqual({ width: 960, height: 640 });
    expect(officeAssetManifest.background).toBe('/assets/office/office-background-furniture.png');
    expect(officeAssetManifest.agents.builder).toBe('/assets/office/agent-builder.png');
    expect(officeAssetManifest.agents.tester).toBe('/assets/office/agent-tester.png');
    expect(officeAssetManifest.agents.documenter).toBe('/assets/office/agent-documenter.png');
    expect(officeAssetManifest.markers).toBe('/assets/office/status-markers.png');
    expect(officeAssetManifest.props).toBe('/assets/office/office-props.png');
    expect(officeAssetManifest.nameplates).toBe('/assets/office/nameplates.png');
  });

  it('ships transparent RGBA eight-frame role sheets with distinct populated walk poses', () => {
    const accents: Record<string, readonly number[]> = {
      'agent-builder.png': [45, 124, 235],
      'agent-tester.png': [217, 119, 6],
      'agent-documenter.png': [124, 58, 237]
    };
    for (const [file, accent] of Object.entries(accents)) {
      const bytes = readFileSync(join(process.cwd(), 'web/public/assets/office', file));
      expect(bytes.toString('ascii', 1, 4)).toBe('PNG');
      expect(bytes.readUInt32BE(16)).toBe(384);
      expect(bytes.readUInt32BE(20)).toBe(72);
      expect(bytes[25]).toBe(6);

      const rows = imageRows(bytes, 384, 72);
      const walkFrames = [4, 5, 6, 7].map((frame) => frameBytes(rows, 384, frame));
      expect(new Set(walkFrames.map((frame) => frame.toString('hex'))).size).toBe(4);
      for (const frame of walkFrames) {
        let opaque = 0;
        let transparent = 0;
        let hasAccent = false;
        for (let index = 0; index < frame.length; index += 4) {
          if (frame[index + 3] === 0) transparent += 1;
          else opaque += 1;
          hasAccent ||= frame[index] === accent[0] && frame[index + 1] === accent[1] && frame[index + 2] === accent[2] && frame[index + 3] === 255;
        }
        expect(opaque).toBeGreaterThan(0);
        expect(transparent).toBeGreaterThan(0);
        expect(hasAccent).toBe(true);
      }
    }
  });

  it('ships the furniture background and unmodified source pack', () => {
    const background = readFileSync(join(process.cwd(), 'web/public/assets/office/office-background-furniture.png'));
    expect(background.toString('ascii', 1, 4)).toBe('PNG');
    expect(background.readUInt32BE(16)).toBe(960);
    expect(background.readUInt32BE(20)).toBe(640);
    expect(background[25]).toBe(6);

    const furnitureDir = join(process.cwd(), 'web/public/assets/office/furniture');
    const provenance = readFileSync(join(furnitureDir, 'README.md'), 'utf8');
    expect(provenance).toContain('Office Furniture Pixel Art');
    for (const file of ['0-Tileset.png', 'Desk.png', 'Desk-2.png', 'Chair.png', 'Coffee-Machine.png', 'Vending-Machine.png', 'Water-Dispenser.png']) {
      const bytes = readFileSync(join(furnitureDir, file));
      expect(bytes.toString('ascii', 1, 4)).toBe('PNG');
    }
  });
});
