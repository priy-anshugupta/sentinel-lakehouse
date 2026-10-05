import test from 'node:test';
import assert from 'node:assert/strict';
import { describeDrift } from './driftNarrative.js';

test('explains the observed type change with denominators', () => {
  const narrative = describeDrift({step: 350, rows: [
    {period: 'before', type: 'CASH_OUT', transactions: 100, confirmed: 2},
    {period: 'after', type: 'CASH_OUT', transactions: 100, confirmed: 8},
  ]});
  assert.match(narrative, /simulated hour 350/);
  assert.match(narrative, /cash out transactions.*2\.00% before and 8\.00% after/);
  assert.match(narrative, /do not establish what caused/);
});

test('does not invent a pattern before post-event transactions arrive', () => {
  const narrative = describeDrift({step: 350, rows: [
    {period: 'before', type: 'CASH_OUT', transactions: 100, confirmed: 2},
  ]});
  assert.match(narrative, /not yet transactions on both sides/);
  assert.doesNotMatch(narrative, /2\.00%/);
});
