const count = value => Number(value || 0);
const rate = (fraud, transactions) => `${(100 * count(fraud) / count(transactions)).toFixed(2)}%`;
const typeName = value => String(value).replaceAll('_', ' ').toLowerCase();

export function describeDrift(comparison) {
  if (!comparison) return '';
  const rows = comparison.rows || [];
  const totals = period => rows.filter(row => row.period === period).reduce(
    (result, row) => ({transactions: result.transactions + count(row.transactions), confirmed: result.confirmed + count(row.confirmed)}),
    {transactions: 0, confirmed: 0},
  );
  const before = totals('before');
  const after = totals('after');
  const opening = `The model detected a change in prediction errors around simulated hour ${comparison.step}.`;
  if (!before.transactions || !after.transactions) {
    return `${opening} There are not yet transactions on both sides of the event, so a before-and-after fraud pattern cannot be described.`;
  }

  const overall = `In the selected windows, confirmed fraud was ${before.confirmed} of ${before.transactions} transactions (${rate(before.confirmed, before.transactions)}) before and ${after.confirmed} of ${after.transactions} (${rate(after.confirmed, after.transactions)}) after.`;
  const types = [...new Set(rows.map(row => row.type))].map(type => {
    const earlier = rows.find(row => row.period === 'before' && row.type === type) || {};
    const later = rows.find(row => row.period === 'after' && row.type === type) || {};
    return {type, earlier, later, change: Math.abs(count(later.confirmed) / (count(later.transactions) || 1) - count(earlier.confirmed) / (count(earlier.transactions) || 1))};
  }).filter(item => count(item.earlier.transactions) >= 10 && count(item.later.transactions) >= 10 && (count(item.earlier.confirmed) || count(item.later.confirmed)));
  types.sort((a, b) => b.change - a.change);
  if (!types.length) return `${opening} ${overall} There is not enough evidence in each transaction type to name a specific pattern change.`;
  const strongest = types[0];
  const detail = `For ${typeName(strongest.type)} transactions, the confirmed fraud rate was ${rate(strongest.earlier.confirmed, strongest.earlier.transactions)} before and ${rate(strongest.later.confirmed, strongest.later.transactions)} after.`;
  return `${opening} ${overall} ${detail} These observations do not establish what caused the model change.`;
}
