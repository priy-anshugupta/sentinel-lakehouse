/**
 * queryParser.js — Maps plain-English report queries to OLAP parameters.
 * Used by the ReportBuilder to translate user questions into DuckDB OLAP queries.
 */

// Pre-built report templates
export const REPORT_TEMPLATES = [
  {
    id: 'weekly_fraud',
    label: 'Weekly Fraud Summary',
    description: 'Total fraud instances broken down by each week of the month',
    icon: '📊',
    query: 'Show me weekly fraud summary',
    params: {
      operation: 'ROLLUP',
      granularity: 'WEEK',
      type_filter: null,
      fraud_only: false,
      is_night: null,
      step_range_start: 0,
      step_range_end: 744,
      measure: 'count'
    },
    metric: 'fraud_count'
  },
  {
    id: 'monthly_volume',
    label: 'Monthly Volume by Type',
    description: 'Total transaction volume (₹) grouped by transaction type',
    icon: '💰',
    query: 'Show me monthly volume by transaction type',
    params: {
      operation: 'ROLLUP',
      granularity: 'WEEK',
      type_filter: null,
      fraud_only: false,
      is_night: null,
      step_range_start: 0,
      step_range_end: 744,
      measure: 'sum_amount'
    },
    metric: 'total_amount'
  },
  {
    id: 'evening_transfers',
    label: 'Evening Transfer Analysis',
    description: 'All transfers during evening/night hours — a common fraud window',
    icon: '🌙',
    query: 'Show me evening transfer activity',
    params: {
      operation: 'SLICE',
      granularity: 'DAY',
      type_filter: 'TRANSFER',
      fraud_only: false,
      is_night: true,
      step_range_start: 0,
      step_range_end: 744,
      measure: 'count'
    },
    metric: 'tx_count'
  },
  {
    id: 'pre_post_drift',
    label: 'Pre vs Post Drift Comparison',
    description: 'Compare fraud patterns before and after the adversarial shift at Step 350',
    icon: '⚡',
    query: 'Compare fraud before and after drift',
    params: {
      operation: 'DICE',
      granularity: 'WEEK',
      type_filter: null,
      fraud_only: false,
      is_night: null,
      step_range_start: 150,
      step_range_end: 550,
      measure: 'count'
    },
    metric: 'fraud_count'
  },
  {
    id: 'high_risk_cashout',
    label: 'High-Risk Cash-Out Report',
    description: 'All cash-out transactions — the most common historical fraud vector',
    icon: '🚨',
    query: 'Show me high risk cash out transactions',
    params: {
      operation: 'DRILLDOWN',
      granularity: 'DAY',
      type_filter: 'CASH_OUT',
      fraud_only: false,
      is_night: null,
      step_range_start: 0,
      step_range_end: 744,
      measure: 'count'
    },
    metric: 'fraud_count'
  },
  {
    id: 'daily_overview',
    label: 'Daily Transaction Overview',
    description: 'Day-by-day breakdown of total transaction count and volume',
    icon: '📅',
    query: 'Show me daily transaction overview',
    params: {
      operation: 'ROLLUP',
      granularity: 'DAY',
      type_filter: null,
      fraud_only: false,
      is_night: null,
      step_range_start: 0,
      step_range_end: 744,
      measure: 'count'
    },
    metric: 'tx_count'
  }
];

/**
 * Parse a plain-English query string into OLAP parameters.
 * This is a keyword-matching approach (not AI/NLP).
 */
export function parseQuery(queryText) {
  const q = queryText.toLowerCase().trim();
  
  // Determine time range
  let stepStart = 0;
  let stepEnd = 744;
  let granularity = 'WEEK';
  
  if (q.includes('1 week') || q.includes('one week') || q.includes('last week')) {
    stepEnd = 168; granularity = 'DAY';
  } else if (q.includes('2 week') || q.includes('two week') || q.includes('fortnight') || q.includes('biweekly')) {
    stepEnd = 336; granularity = 'DAY';
  } else if (q.includes('3 week') || q.includes('three week')) {
    stepEnd = 504; granularity = 'DAY';
  } else if (q.includes('month') || q.includes('full') || q.includes('all')) {
    stepEnd = 744; granularity = 'WEEK';
  } else if (q.includes('daily') || q.includes('day')) {
    granularity = 'DAY';
  } else if (q.includes('hourly') || q.includes('hour')) {
    granularity = 'HOUR';
  }

  // Determine measure / metric
  let measure = 'count';
  let metric = 'tx_count';
  
  if (q.includes('volume') || q.includes('amount') || q.includes('money') || q.includes('₹') || q.includes('rupee')) {
    measure = 'sum_amount';
    metric = 'total_amount';
  } else if (q.includes('fraud') || q.includes('suspicious') || q.includes('risk') || q.includes('alert')) {
    metric = 'fraud_count';
  }

  // Determine type filter
  let typeFilter = null;
  if (q.includes('transfer')) typeFilter = 'TRANSFER';
  else if (q.includes('cash_out') || q.includes('cash out') || q.includes('cashout')) typeFilter = 'CASH_OUT';
  else if (q.includes('payment')) typeFilter = 'PAYMENT';
  else if (q.includes('cash_in') || q.includes('cash in')) typeFilter = 'CASH_IN';

  // Determine time-of-day
  let isNight = null;
  if (q.includes('evening') || q.includes('night') || q.includes('late')) isNight = true;
  if (q.includes('morning') || q.includes('daytime')) isNight = false;

  // Determine fraud-only filter
  const fraudOnly = q.includes('fraud only') || q.includes('only fraud') || q.includes('suspicious only');

  // Determine operation
  let operation = 'ROLLUP';
  if (q.includes('compare') || q.includes('vs') || q.includes('versus') || q.includes('drift')) {
    operation = 'DICE';
    if (q.includes('drift') || q.includes('pre') || q.includes('post')) {
      stepStart = 150;
      stepEnd = 550;
    }
  } else if (q.includes('detail') || q.includes('drill') || q.includes('breakdown') || q.includes('specific')) {
    operation = 'DRILLDOWN';
  } else if (q.includes('slice') || q.includes('filter') || q.includes('only')) {
    operation = 'SLICE';
  }

  // Build a human-readable title
  const timeLabel = stepEnd <= 168 ? 'Week 1' : stepEnd <= 336 ? 'Weeks 1–2' : stepEnd <= 504 ? 'Weeks 1–3' : 'Full Month';
  const typeLabel = typeFilter || 'All Types';
  const metricLabel = metric === 'fraud_count' ? 'Fraud Report' : metric === 'total_amount' ? 'Volume Report (₹)' : 'Transaction Count Report';
  const title = `${metricLabel}: ${typeLabel} — ${timeLabel}`;

  return {
    title,
    params: {
      operation,
      granularity,
      type_filter: typeFilter,
      fraud_only: fraudOnly,
      is_night: isNight,
      step_range_start: stepStart,
      step_range_end: stepEnd,
      measure,
      row_dim: 'day_of_week',
      col_dim: 'type_name'
    },
    metric
  };
}
