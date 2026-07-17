import { describe, expect, it } from 'vitest';
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
});
