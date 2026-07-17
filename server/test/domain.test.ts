import { describe, expect, it } from 'vitest';
import { applyStatus, assignZone } from '../domain.js';

describe('agent placement', () => {
  it('moves a blocked agent to attention', () => {
    expect(assignZone('blocked', 0)).toBe('attention');
  });

  it('keeps a paused agent at its last desk', () => {
    expect(applyStatus({ status: 'working', zone: 'desk' }, 'paused')).toMatchObject({
      status: 'paused',
      zone: 'desk'
    });
  });

  it('rejects resume unless an agent is paused', () => {
    expect(() => applyStatus({ status: 'working', zone: 'desk' }, 'working')).toThrow(
      'Invalid transition'
    );
  });
});
