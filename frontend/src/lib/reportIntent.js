const HOURS = { hour: 1, day: 24, week: 168, month: 720 };
const WORD_NUMBERS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };
const TYPES = [
  ['CASH_OUT', /\bcash[ -]?out\b/],
  ['CASH_IN', /\bcash[ -]?in\b/],
  ['TRANSFER', /\btransfers?\b/],
  ['PAYMENT', /\bpayments?\b/],
  ['DEBIT', /\bdebits?\b/],
];
const LEVELS = { month: 'MONTH', week: 'WEEK', day: 'DAY', hour: 'HOUR' };
const PLURALS = { month: 'months', week: 'weeks', day: 'days', hour: 'hours' };

// A small, auditable language grammar. Never silently turn unknown dimensions
// into a plausible-looking warehouse answer.
export function parseReportRequest(sentence, coverage = {}) {
  const text = String(sentence || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text) return { error: 'Enter a question, such as “Show one month of transaction data”.' };
  if (/\b(branch|customer|merchant|region|city|country|loan|credit card|account|calendar|january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(text)) {
    return { error: 'This sample cannot report by branch, customer, account, geography, or calendar month. Ask about simulated time, transaction type, amount, or confirmed fraud.' };
  }
  if (!/\b(data|transactions?|fraud|amount|volume|activity|cash[ -]?out|cash[ -]?in|transfers?|payments?|debits?)\b/.test(text)) {
    return { error: 'Ask about transactions, confirmed fraud, or amount. For example: “Show one month of transaction data”.' };
  }

  const matchingTypes = TYPES.filter(([, pattern]) => pattern.test(text));
  if (matchingTypes.length > 1) return { error: 'Please ask about one transaction type at a time.' };
  if (/\bnight\b|\bovernight\b/.test(text) && /\bdaytime\b/.test(text)) return { error: 'Choose night or daytime, not both.' };

  const groupMatch = text.match(/\b(?:by|per|each|to) (?:simulation )?(month|week|day|hour)\b/) ||
    text.match(/\b(monthly|weekly|daily|hourly)\b/);
  const groupWord = groupMatch?.[1]?.replace(/ly$/, '').replace(/^dai$/, 'day') || null;
  const group = groupWord === 'month' || groupWord === 'week' || groupWord === 'day' || groupWord === 'hour'
    ? LEVELS[groupWord] : (groupMatch?.[1] === 'daily' ? 'DAY' : null);

  // “one month” means the first 30-day simulation bucket. “last 7 days”
  // is relative to the latest ingested step; neither is a calendar period.
  const periodMatch = text.match(/\b(first|last|past|previous)?\s*(\d+|one|two|three|four|a|an)\s+(months?|weeks?|days?|hours?)\b/) ||
    text.match(/\b(first|last|past|previous)\s+(months?|weeks?|days?|hours?)\b/);
  let range = null;
  let rangeLabel = 'All ingested simulation steps';
  if (periodMatch) {
    const hasCount = periodMatch.length === 4;
    const direction = periodMatch[1] || 'first';
    const count = hasCount ? (Number(periodMatch[2]) || WORD_NUMBERS[periodMatch[2]]) : 1;
    const unit = (hasCount ? periodMatch[3] : periodMatch[2]).replace(/s$/, '');
    if (!Number.isInteger(count) || count < 1 || count > 30) return { error: 'Choose a period between 1 and 30 simulated months, weeks, days, or hours.' };
    const span = count * HOURS[unit];
    if (direction === 'last' || direction === 'past' || direction === 'previous') {
      const latest = Number(coverage.last_step);
      if (!Number.isFinite(latest) || latest < 1) return { error: 'The warehouse needs ingested transactions before a “last” period can be calculated.' };
      range = { start: Math.max(1, latest - span + 1), end: latest, expectedStart: latest - span + 1 };
      rangeLabel = `Last ${count} simulated ${count === 1 ? unit : PLURALS[unit]} ending at step ${latest}`;
    } else {
      range = { start: 1, end: span, expectedStart: 1 };
      rangeLabel = `First ${count} simulated ${count === 1 ? unit : PLURALS[unit]} (steps 1–${span})`;
    }
    if (!group) {
      // A request for a period defaults to that period's aggregation level.
      // e.g. “one month of data” produces a genuine MONTH roll-up.
      range.group = LEVELS[unit];
    }
  }
  const granularity = group || range?.group;
  if (!granularity) return { error: 'Include a time grouping, such as “by week”, “monthly”, or “one month of data”.' };

  const isNight = /\bnight\b|\bovernight\b/.test(text) ? true : /\bdaytime\b/.test(text) ? false : null;
  const metric = /\bamount\b|\bvalue\b/.test(text) ? 'total_amount' : /\bfraud\b/.test(text) ? 'fraud_count' : 'tx_count';
  const type = matchingTypes[0]?.[0] || null;
  const first = Number(coverage.first_step);
  const last = Number(coverage.last_step);
  const partial = range && Number.isFinite(last) && last > 0 && (last < range.end || first > range.expectedStart);
  return {
    title: 'Question-driven warehouse report',
    description: sentence.trim(),
    metric,
    params: {
      operation: 'ROLLUP',
      granularity,
      type_filter: type,
      fraud_only: false,
      is_night: isNight,
      step_range_start: range?.start ?? null,
      step_range_end: range?.end ?? null,
    },
    interpretation: [
      `Roll-up: ${granularity.toLowerCase()}${granularity === 'MONTH' ? ' (30 simulated days)' : ''}`,
      rangeLabel,
      type ? `Slice: ${type.replace('_', ' ')}` : 'All transaction types',
      isNight === null ? 'All hours' : isNight ? 'Night only' : 'Daytime only',
      'Measures: transactions, confirmed fraud, amount',
    ],
    warning: partial ? `Partial coverage: ingested steps are ${first}–${last}; the requested period extends beyond the available sample.` : null,
  };
}
