export const officeCanvas = { width: 960, height: 640 } as const;

/** Four horizontal human poses per sheet, rendered at native pixel size. */
export const agentSprite = { frameWidth: 48, frameHeight: 72 } as const;

export const agentPresentation = {
  scale: 1.5,
  frameDurationMs: 140,
  frameWidth: 48,
  frameHeight: 72,
  walkFrames: [0, 1]
} as const;

export const officeAssetManifest = {
  background: '/assets/office/office-background-furniture.png',
  agents: {
    builder: '/assets/office/agent-builder.png',
    tester: '/assets/office/agent-tester.png',
    documenter: '/assets/office/agent-documenter.png'
  },
  markers: '/assets/office/status-markers.png',
  props: '/assets/office/office-props.png',
  nameplates: '/assets/office/nameplates.png'
} as const;
