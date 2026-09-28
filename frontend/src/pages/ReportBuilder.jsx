import React, { useEffect, useState } from 'react';
import { Download, FileText, Printer, Search } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useOlapQuery from '../hooks/useOlapQuery';
import { fetchOverview } from '../lib/api';
import { formatNumber } from '../lib/formatters';
import { parseReportRequest } from '../lib/reportIntent';

const presets = [
  { id: 'weekly', title: 'Weekly fraud summary', description: 'Confirmed fraud by simulation week', granularity: 'WEEK', type_filter: null, is_night: null },
  { id: 'cashout', title: 'Cash-out review', description: 'Confirmed cash-out cases by day', granularity: 'DAY', type_filter: 'CASH_OUT', is_night: null },
  { id: 'transfer', title: 'Transfer review', description: 'Transfers and confirmed cases by week', granularity: 'WEEK', type_filter: 'TRANSFER', is_night: null },
  { id: 'night', title: 'Night activity', description: 'Overnight transactions and cases by day', granularity: 'DAY', type_filter: null, is_night: true },
];
const examples = [
  'Show one month of transaction data',
  'Show cash-out fraud by week for the first month',
  'Show transfer amount by day for the last 7 days',
];
const amount = n => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);
const periodLabel = (level, value) => `${level === 'MONTH' ? 'Simulation month' : level === 'HOUR' ? 'Hour' : level === 'WEEK' ? 'Week' : 'Day'} ${value}`;
const presetReport = preset => ({
  id: preset.id,
  title: preset.title,
  description: preset.description,
  metric: 'fraud_count',
  params: { operation: 'ROLLUP', granularity: preset.granularity, type_filter: preset.type_filter, is_night: preset.is_night, fraud_only: false },
  interpretation: [
    `Roll-up: ${preset.granularity.toLowerCase()}`,
    'All ingested simulation steps',
    preset.type_filter ? `Slice: ${preset.type_filter.replace('_', ' ')}` : 'All transaction types',
    preset.is_night ? 'Night only' : 'All hours',
    'Measures: transactions, confirmed fraud, amount',
  ],
});

export default function ReportBuilder() {
  const [active, setActive] = useState(() => presetReport(presets[0]));
  const [draft, setDraft] = useState('');
  const [promptError, setPromptError] = useState('');
  const [overview, setOverview] = useState(null);
  const [metric, setMetric] = useState('fraud_count');
  useEffect(() => {
    fetchOverview().then(setOverview).catch(() => setOverview(null));
  }, []);
  const { data, sql, loading, error, execTime } = useOlapQuery(active.params);
  const rows = (data || []).map(row => ({
    ...row,
    tx_count: Number(row.tx_count || 0),
    fraud_count: Number(row.fraud_count || 0),
    total_amount: Number(row.total_amount || 0),
  }));
  const total = rows.reduce((sum, row) => ({
    transactions: sum.transactions + row.tx_count,
    fraud: sum.fraud + row.fraud_count,
    amount: sum.amount + row.total_amount,
  }), { transactions: 0, fraud: 0, amount: 0 });
  const label = value => periodLabel(active.params.granularity, value);

  function runQuestion(question) {
    const parsed = parseReportRequest(question, overview?.summary || {});
    if (parsed.error) {
      setPromptError(parsed.error);
      return;
    }
    setPromptError('');
    setActive({ ...parsed, id: 'question' });
    setMetric(parsed.metric);
  }
  function selectPreset(preset) {
    setActive(presetReport(preset));
    setMetric('fraud_count');
    setPromptError('');
  }
  function exportCsv() {
    const headers = ['period', 'tx_count', 'fraud_count', 'total_amount'];
    const csv = [headers.join(','), ...rows.map(row => headers.map(key => row[key] ?? '').join(','))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `sentinel-${active.id}-report.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <div className="report-page">
    <div className="page-intro"><span className="eyebrow">REPORTING</span><h1>Ask a business question</h1><p>Describe the period and measure you need. The report shows how your request becomes an OLAP query against the transaction warehouse.</p></div>

    <section className="surface-card report-ask" aria-labelledby="report-ask-title">
      <div className="report-ask-heading"><span className="preset-icon"><Search size={20}/></span><div><h2 id="report-ask-title">Ask in plain language</h2><p>Use simulated time, transaction type, confirmed fraud, or amount.</p></div></div>
      <form onSubmit={event => { event.preventDefault(); runQuestion(draft); }}>
        <label htmlFor="report-question">Your question</label>
        <div className="report-ask-row"><input id="report-question" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Show one month of transaction data"/><button type="submit">Run report</button></div>
      </form>
      <div className="report-examples"><span>Try:</span>{examples.map(example => <button type="button" key={example} onClick={() => { setDraft(example); runQuestion(example); }}>{example}</button>)}</div>
      {promptError && <p className="report-prompt-error" role="alert">{promptError}</p>}
      <p className="report-language-note">“One month” means the first 720 simulated hours. “Last” periods end at the latest ingested step. PaySim steps are not calendar dates.</p>
    </section>

    <div className="report-template-heading"><h2>Or start with a common report</h2></div>
    <div className="preset-grid">{presets.map(item => <button key={item.id} className={`preset-card ${active.id === item.id ? 'selected' : ''}`} onClick={() => selectPreset(item)}><span className="preset-icon"><FileText size={19}/></span><strong>{item.title}</strong><small>{item.description}</small></button>)}</div>

    <section className="surface-card report-result"><div className="card-heading"><div><span className="eyebrow">WAREHOUSE REPORT</span><h3>{active.title}</h3><p>{active.description}</p></div><div className="report-actions"><button className="subtle-button" onClick={exportCsv} disabled={!rows.length || loading}><Download size={15}/>CSV</button><button className="subtle-button" onClick={() => window.print()} disabled={!rows.length || loading}><Printer size={15}/>Print</button></div></div>
      <div className="report-scope"><strong>Interpreted as</strong>{active.interpretation.map(item => <span key={item}>{item}</span>)}</div>
      {active.warning && <div className="report-coverage" role="status">{active.warning}</div>}
      {error ? <div className="data-error" role="alert">Could not build this report: {error}</div> : loading ? <div className="chart-placeholder">Running warehouse query…</div> : rows.length ? <>
        <div className="report-metrics"><div><small>Transactions</small><strong>{formatNumber(total.transactions)}</strong></div><div><small>Confirmed fraud</small><strong>{formatNumber(total.fraud)}</strong></div><div><small>Fraud rate</small><strong>{total.transactions ? `${(total.fraud / total.transactions * 100).toFixed(2)}%` : '—'}</strong></div></div>
        <div className="metric-tabs" role="group" aria-label="Chart measure"><button className={metric === 'fraud_count' ? 'selected' : ''} onClick={() => setMetric('fraud_count')}>Confirmed fraud</button><button className={metric === 'tx_count' ? 'selected' : ''} onClick={() => setMetric('tx_count')}>Transactions</button><button className={metric === 'total_amount' ? 'selected' : ''} onClick={() => setMetric('total_amount')}>Amount</button></div>
        <div className="report-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows}><CartesianGrid vertical={false} stroke="#e8eeec"/><XAxis dataKey="period" tickFormatter={label} tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false}/><Tooltip labelFormatter={label} formatter={value => amount(value)}/><Bar dataKey={metric} fill="#0b716a" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Period</th><th>Transactions</th><th>Confirmed fraud</th><th>Fraud rate</th><th>Amount · local units</th></tr></thead><tbody>{rows.map(row => <tr key={row.period}><td>{label(row.period)}</td><td>{formatNumber(row.tx_count)}</td><td>{formatNumber(row.fraud_count)}</td><td>{row.tx_count ? `${(row.fraud_count / row.tx_count * 100).toFixed(2)}%` : '—'}</td><td>{amount(row.total_amount)}</td></tr>)}</tbody></table></div>
      </> : <div className="chart-placeholder">No matching warehouse rows. Try another question or import more data.</div>}
      <details className="report-query"><summary>Show OLAP SQL and definitions</summary><p>Roll-up groups transaction facts by the selected simulated time level. A type or time filter slices those facts before aggregation. Confirmed fraud comes from the PaySim label. One fact row represents one ingested transaction.</p><pre>{sql || 'No query yet.'}</pre></details>
      <div className="source-note">Source: PaySim synthetic sample in DuckDB. Amounts have no specified currency. Query time: {execTime == null ? '—' : `${execTime.toFixed(1)} ms`}.</div>
    </section>
  </div>;
}
