import test from 'node:test';
import assert from 'node:assert/strict';
import { toMinor, toDecimal } from '../src/utils/money.js';
import { isDate, addDays, dayCount } from '../src/utils/dates.js';
test('money conversion handles cents, max amount and rejects floating values', () => {
  assert.equal(toMinor('0.29'), 29);
  assert.equal(toMinor('10.5'), 1050);
  assert.equal(toMinor('999999999.99'), 99999999999);
  assert.equal(toDecimal(10025), '100.25');
  assert.throws(() => toMinor(1.1));
  assert.throws(() => toMinor('Infinity'));
});
test('calendar dates reject rollover and correctly handle leap years', () => {
  assert.equal(isDate('2024-02-29'), true);
  assert.equal(isDate('2025-02-29'), false);
  assert.equal(isDate('2026-13-01'), false);
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(dayCount('2024-02-28', '2024-03-01'), 3);
});
