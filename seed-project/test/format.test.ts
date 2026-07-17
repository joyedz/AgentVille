import { expect, it } from 'vitest';
import { titleCase } from '../src/format.js';

it('formats a phrase', () => expect(titleCase('agent ville')).toBe('Agent Ville'));
