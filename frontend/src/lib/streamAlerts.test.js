import test from 'node:test';
import assert from 'node:assert/strict';
import { alertForDrift, alertsForTransaction, previewAlert } from './streamAlerts.js';

test('separates a model review lead from a confirmed sample label', () => {
  const alerts = alertsForTransaction({tx_id: 42, type: 'CASH_OUT', is_fraud_prediction: 1, isFraud: 1});
  assert.deepEqual(alerts.map(alert => alert.kind), ['review', 'confirmed']);
  assert.match(alerts[0].body, /not confirmed fraud/);
  assert.match(alerts[1].body, /dataset labels transaction #42/);
});

test('links only a real saved drift event to its analysis', () => {
  assert.equal(alertForDrift({step: 350, drift_id: undefined}), null);
  assert.equal(alertForDrift({step: 405, drift_id: 6}).link, '/rules?drift_id=6');
});

test('preview alerts are visibly examples without warehouse links', () => {
  const alert = previewAlert('review');
  assert.equal(alert.demo, true);
  assert.equal(alert.link, undefined);
  assert.match(alert.body, /No transaction was scored/);
});
