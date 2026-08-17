import { expect, test } from 'bun:test';
import { PRISME_API_PROBE } from './index';

test('la sonde est découverte par le runner de tests', () => {
  expect(PRISME_API_PROBE).toBe('prisme-api');
});
