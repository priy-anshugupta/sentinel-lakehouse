import React, { useEffect, useState } from 'react';
import { Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { fetchDataQuality, fetchWarehouseSchema, fetchWarehouseStats } from '../lib/api';
import { formatNumber } from '../lib/formatters';

const description = {
  fact_transactions:'One row per ingested transaction, with amounts, fraud labels, model flags and dimension keys.',
  fact_drift_events:'Recorded shifts in online model error and their analysis windows.',
  dim_time:'Simulation time attributes for weekly, daily and hourly aggregation.',
  dim_transaction_type:'The five transaction categories used to slice risk.',
  dim_account:'Origin and destination account attributes used for analysis.',
};
export default function WarehouseAdmin(){
  const [stats,setStats]=useState([]),[schema,setSchema]=useState({}),[quality,setQuality]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=async()=>{setLoading(true);setError('');try{const [s,c,q]=await Promise.all([fetchWarehouseStats(),fetchWarehouseSchema(),fetchDataQuality()]);setStats(s);setSchema(c);setQuality(q);}catch(e){setError(e.response?.data?.detail||e.message);}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);
  const fact=stats.find(s=>s.table==='fact_transactions');
  return <div className="warehouse-page"><div className="page-intro"><span className="eyebrow">DATA OPERATIONS</span><h1>Warehouse health</h1><p>Check the quality and structure of the data behind every report. The star schema keeps measures in transaction facts and business context in reusable dimensions.</p></div>
    <div className="warehouse-top"><div className="warehouse-kpi"><Database size={21}/><div><small>Ingested transactions</small><strong>{loading?'—':formatNumber(fact?.row_count||0)}</strong></div></div><div className="warehouse-kpi"><ShieldCheck size={21}/><div><small>Quality checks passing</small><strong>{loading?'—':`${quality.filter(q=>q.status==='PASS').length} / ${quality.length}`}</strong></div></div><button className="subtle-button" onClick={load} disabled={loading}><RefreshCw size={15}/>{loading?'Checking…':'Refresh'}</button></div>
    {error&&<div className="data-error" role="alert">{error}</div>}
    <section className="surface-card warehouse-section"><div className="card-heading"><div><span className="eyebrow">TRUST THE NUMBERS</span><h3>Data quality</h3><p>Checks run against the current DuckDB warehouse.</p></div></div><div className="quality-list">{quality.map(q=><div key={q.name}><span className={`quality-status ${q.status.toLowerCase()}`}>{q.status}</span><strong>{q.name}</strong><small>{q.detail}</small></div>)}{!quality.length&&<div className="empty-copy">{loading?'Running checks…':'No checks returned.'}</div>}</div></section>
    <section className="surface-card warehouse-section"><div className="card-heading"><div><span className="eyebrow">DIMENSIONAL MODEL</span><h3>Fact and dimension tables</h3><p>Open a table to inspect its columns and current row count.</p></div></div><div className="schema-grid">{Object.entries(schema).map(([name,columns])=><details key={name} className="schema-card"><summary><span className="schema-kind">{name.startsWith('fact_')?'FACT':'DIMENSION'}</span><strong>{name}</strong><small>{formatNumber(stats.find(s=>s.table===name)?.row_count||0)} rows</small></summary><p>{description[name]||'Warehouse table.'}</p><ul>{columns.map(col=><li key={col.name}><span>{col.name}</span><small>{col.type}</small></li>)}</ul></details>)}{!Object.keys(schema).length&&<div className="empty-copy">{loading?'Loading schema…':'No tables returned.'}</div>}</div></section>
    <div className="source-note">Fact grain: one transaction. The model uses synthetic PaySim data and is intended for analysis and demonstration.</div></div>;
}
