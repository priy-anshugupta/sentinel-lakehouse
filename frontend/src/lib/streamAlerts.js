const typeName = value => String(value || 'transaction').replaceAll('_', ' ').toLowerCase();

export function alertsForTransaction(tx) {
  if (!Number.isInteger(tx.tx_id)) return [];
  const alerts = [];
  if (Boolean(tx.is_fraud_prediction)) {
    alerts.push({
      id: `review-${tx.tx_id}`,
      kind: 'review',
      title: 'Transaction flagged for review',
      body: `The model flagged ${typeName(tx.type)} transaction #${tx.tx_id}. This is a review lead, not confirmed fraud.`,
      link: '/stream',
    });
  }
  if (Number(tx.isFraud) === 1) {
    alerts.push({
      id: `confirmed-${tx.tx_id}`,
      kind: 'confirmed',
      title: 'Confirmed fraud in sample',
      body: `The PaySim dataset labels transaction #${tx.tx_id} as fraud. This is the known sample label.`,
      link: '/stream',
    });
  }
  return alerts;
}

export function alertForDrift(event) {
  if (!Number.isInteger(event.drift_id)) return null;
  return {
    id: `drift-${event.drift_id}`,
    kind: 'drift',
    title: 'Model change detected',
    body: `Prediction errors changed around simulation step ${event.step}. Compare the transaction patterns before and after.`,
    link: `/rules?drift_id=${event.drift_id}`,
  };
}

let previewSequence = 0;
export function previewAlert(kind) {
  previewSequence += 1;
  if (kind === 'drift') return {
    id: `preview-drift-${previewSequence}`,
    kind: 'drift',
    demo: true,
    title: 'Preview: model change detected',
    body: 'Example only: prediction errors changed. A real alert would link to Pattern analysis.',
  };
  return {
    id: `preview-review-${previewSequence}`,
    kind: 'review',
    demo: true,
    title: 'Preview: transaction review lead',
    body: 'Example only: the model flagged a transaction for investigation. No transaction was scored.',
  };
}
