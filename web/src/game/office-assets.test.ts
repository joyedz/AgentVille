import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { officeAssetManifest, officeCanvas } from './office-assets.js';

describe('office asset contract', () => {
  it('uses a fixed pixel-art canvas and stable asset URLs', () => {
    expect(officeCanvas).toEqual({ width: 960, height: 640 });
    expect(officeAssetManifest.background).toBe('/assets/office/office-background.png');
    expect(officeAssetManifest.agents.builder).toBe('/assets/office/agent-builder.png');
    expect(officeAssetManifest.agents.tester).toBe('/assets/office/agent-tester.png');
    expect(officeAssetManifest.agents.documenter).toBe('/assets/office/agent-documenter.png');
    expect(officeAssetManifest.markers).toBe('/assets/office/status-markers.png');
    expect(officeAssetManifest.props).toBe('/assets/office/office-props.png');
    expect(officeAssetManifest.nameplates).toBe('/assets/office/nameplates.png');
  });

  it('ships human agent sheets as transparent 4-frame 48x72 sprites', () => {
    for (const file of ['agent-builder.png', 'agent-tester.png', 'agent-documenter.png']) {
      const bytes = readFileSync(join(process.cwd(), 'web/public/assets/office', file));
      expect(bytes.toString('ascii', 1, 4)).toBe('PNG');
      expect(bytes.readUInt32BE(16)).toBe(192);
      expect(bytes.readUInt32BE(20)).toBe(72);
      expect(bytes[25]).toBe(6);
    }
  });
});
