import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CircleAlert, DatabaseZap, FileBarChart, Filter, RefreshCw, ShieldCheck } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchOverview, fetchRecentTransactions } from '../lib/api';
import { formatNumber } from '../lib/formatters';

const percent = (part, total) => total ? `${(100 * part / total).toFixed(1)}%` : '—';
const amount = value => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value || 0);
const typeLabel = value => (value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

export default function CommandCenter() {
  const [overview, setOverview] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const reload = async () => {
    setLoading(true); setError('');
    try {
      const [summary, transactions] = await Promise.all([fetchOverview(), fetchRecentTransactions(30)]);
      setOverview(summary); setRecent(transactions);
    } catch (err) { setError(err.response?.data?.detail || 'Unable to load warehouse data. Check the API connection.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);
  const s = overview?.summary || {};
  const selected = useMemo(() => filter === 'flagged' ? recent.filter(x => x.isFraudPrediction) : recent, [recent, filter]);
  const precision = percent(s.true_positives, s.flagged);
  const recall = percent(s.true_positives, s.confirmed);
  return <div className="dashboard-page">
    <div className="dashboard-hero"><div className="dashboard-hero-shade"/><div className="dashboard-hero-copy">
      <span className="eyebrow light">SENTINEL / RISK OVERVIEW</span><h1>Know where to focus today.</h1>
      <p>Monitor fraud exposure and investigation signals from one traceable transaction warehouse.</p>
      <div className="hero-actions"><Link to="/reports" className="hero-button">Build a report <ArrowRight size={16}/></Link><Link to="/olap" className="hero-link">Explore patterns <ArrowRight size={16}/></Link></div>
    </div><div className="hero-data-tag">PaySim synthetic sample<br/>Simulation steps {s.first_step ?? '—'}–{s.last_step ?? '—'}</div></div>

    <div className="section-heading"><div><span className="eyebrow">MANAGER SNAPSHOT</span><h2>Transaction risk at a glance</h2><p>Confirmed means the dataset label; flagged means the model prediction. These are different counts.</p></div><button className="subtle-button" onClick={reload} disabled={loading}><RefreshCw size={16}/>{loading?'Refreshing…':'Refresh data'}</button></div>
    {error && <div className="data-error" role="alert"><CircleAlert size={18}/>{error}<button onClick={reload}>Try again</button></div>}
    <div className="metric-grid">
      <Metric label="Transactions reviewed" value={loading?'—':formatNumber(s.transactions || 0)} detail="Ingested fact rows" icon={<DatabaseZap size={20}/>} />
      <Metric label="Confirmed fraud" value={loading?'—':formatNumber(s.confirmed || 0)} detail={`${percent(s.confirmed, s.transactions)} of reviewed`} icon={<ShieldCheck size={20}/>} tone="red" />
      <Metric label="Flagged for review" value={loading?'—':formatNumber(s.flagged || 0)} detail={`${percent(s.flagged, s.transactions)} of reviewed`} icon={<Filter size={20}/>} tone="amber" />
      <Metric label="Alert precision" value={loading?'—':precision} detail="Confirmed fraud ÷ model flags" icon={<FileBarChart size={20}/>} tone="teal" />
    </div>
    <div className="context-strip"><CircleAlert size={18}/><span><strong>{s.flagged && s.true_positives/s.flagged < .2 ? 'Alert quality needs review:' : 'Model context:'}</strong> Precision is {precision} and recall is {recall} for the ingested sample. {s.flagged && s.true_positives/s.flagged < .2 ? 'Review alert thresholds and investigator capacity before using flags for decisions. ' : ''}A model flag is a lead for review, not a finding of fraud.</span></div>

    <div className="analysis-grid">
      <section className="surface-card trend-card"><div className="card-heading"><div><span className="eyebrow">SIMULATED TIME</span><h3>Weekly risk pattern</h3><p>Compare model alerts with confirmed labels by simulation week.</p></div><Link to="/olap">Open analysis <ArrowRight size={15}/></Link></div>
        {loading ? <div className="chart-placeholder">Loading warehouse view…</div> : overview?.by_week?.length ? <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={overview.by_week} margin={{top:12,right:12,left:0,bottom:8}}><CartesianGrid vertical={false} stroke="#e8eeec"/><XAxis dataKey="period" tickFormatter={v=>`W${v}`} tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false}/><Tooltip labelFormatter={v=>`Simulation week ${v}`}/><Legend/><Bar dataKey="confirmed" name="Confirmed fraud" fill="#0b716a" radius={[4,4,0,0]}/><Bar dataKey="flagged" name="Model flagged" fill="#d59551" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div> : <div className="chart-placeholder">No transactions have been ingested yet.</div>}
      </section>
      <section className="surface-card type-card"><div className="card-heading"><div><span className="eyebrow">DIMENSION: TRANSACTION TYPE</span><h3>Where confirmed fraud occurs</h3><p>A warehouse slice by transaction type.</p></div></div>
        <div className="type-list">{overview?.by_type?.length ? overview.by_type.map(row => <div className="type-row" key={row.type}><div className="type-row-head"><span>{typeLabel(row.type)}</span><strong>{formatNumber(row.confirmed)}</strong></div><div className="bar-track"><div style={{width:`${s.confirmed ? 100*row.confirmed/s.confirmed:0}%`}}/></div><small>{formatNumber(row.transactions)} transactions · {percent(row.confirmed,row.transactions)} confirmed</small></div>) : <div className="empty-copy">{loading?'Loading…':'No transaction types to show.'}</div>}</div>
      </section>
    </div>
    <section className="surface-card recent-card"><div className="card-heading"><div><span className="eyebrow">LATEST WAREHOUSE ROWS</span><h3>Recent transactions</h3><p>Sample records ordered by ingestion. Amounts use unspecified local currency units in PaySim.</p></div><div className="segmented" role="group" aria-label="Transaction filter"><button className={filter==='all'?'selected':''} onClick={()=>setFilter('all')}>All</button><button className={filter==='flagged'?'selected':''} onClick={()=>setFilter('flagged')}>Flagged</button></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Transaction</th><th>Simulation step</th><th>Type</th><th>Amount · local units</th><th>Model review</th><th>Dataset label</th></tr></thead><tbody>{selected.slice(0,10).map(tx=><tr key={tx.tx_id}><td>#{tx.tx_id}</td><td>{tx.step}</td><td>{typeLabel(tx.type)}</td><td>{amount(tx.amount)}</td><td><span className={`state-pill ${tx.isFraudPrediction?'warning':'neutral'}`}>{tx.isFraudPrediction?'Flagged':'Not flagged'}</span></td><td><span className={`state-pill ${tx.is_fraud_actual?'danger':'neutral'}`}>{tx.is_fraud_actual?'Confirmed fraud':'Not fraud'}</span></td></tr>)}</tbody></table>{!selected.length && <div className="empty-copy">{loading?'Loading transactions…':'No transactions match this view.'}</div>}</div>
    </section>
    <section className="decision-card"><div className="decision-copy"><span className="eyebrow">FROM SIGNAL TO DECISION</span><h3>Bring evidence into the next review.</h3><p>Start with the confirmed cases, narrow by transaction type and simulated time, then export a scoped report for your team.</p><Link to="/reports">Create a report <ArrowRight size={16}/></Link></div><div className="decision-image" role="img" aria-label="Analyst reviewing transaction charts"/></section>
    <div className="source-note">Source: {overview?.source || 'PaySim synthetic sample'} · Grain: {overview?.grain || 'one transaction'} · Last ingest: {s.last_ingested ? new Date(s.last_ingested).toLocaleString() : 'No rows yet'}</div>
  </div>;
}
function Metric({ label, value, detail, icon, tone='' }) { return <div className={`metric-tile ${tone}`}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value}</strong><small>{detail}</small></div>; }
