import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReportRequest } from './reportIntent.js';

const coverage = { first_step: 1, last_step: 399 };

test('one month becomes a bounded month roll-up with honest coverage', () => {
  const result = parseReportRequest('I want 1 month of transaction data', coverage);
  assert.equal(result.params.operation, 'ROLLUP');
  assert.equal(result.params.granularity, 'MONTH');
  assert.equal(result.params.step_range_start, 1);
  assert.equal(result.params.step_range_end, 720);
  assert.match(result.warning, /Partial coverage/);
});

test('a typed weekly report composes roll-up, slice, and month range', () => {
  const result = parseReportRequest('Show cash-out fraud by week for the first month', coverage);
  assert.equal(result.params.granularity, 'WEEK');
  assert.equal(result.params.type_filter, 'CASH_OUT');
  assert.equal(result.metric, 'fraud_count');
  assert.equal(result.params.step_range_end, 720);
});

test('last seven days use latest ingested simulation step', () => {
  const result = parseReportRequest('Show transfer amount by day for the last 7 days', coverage);
  assert.equal(result.params.granularity, 'DAY');
  assert.equal(result.params.step_range_start, 232);
  assert.equal(result.params.step_range_end, 399);
  assert.equal(result.params.type_filter, 'TRANSFER');
  assert.equal(result.metric, 'total_amount');
});

test('unknown warehouse dimensions are rejected', () => {
  assert.match(parseReportRequest('Show fraud by branch for one month', coverage).error, /cannot report by branch/);
});
