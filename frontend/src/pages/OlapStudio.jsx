import React, { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Download, Info, RotateCcw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useOlapQuery from '../hooks/useOlapQuery';
import { formatNumber } from '../lib/formatters';

const metrics = [['fraud_count','Confirmed fraud'],['tx_count','Transactions'],['total_amount','Transaction amount']];
const types = ['All','TRANSFER','CASH_OUT','CASH_IN','PAYMENT','DEBIT'];
const amount = n => new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(n || 0);
function csvDownload(rows, name) {
  const header = ['period','tx_count','fraud_count','total_amount'];
  const csv = [header.join(','), ...rows.map(r=>header.map(k=>r[k] ?? '').join(','))].join('\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); link.download = name; link.click(); URL.revokeObjectURL(link.href);
}
export default function OlapStudio() {
  const [level,setLevel] = useState('WEEK');
  const [parent,setParent] = useState(null);
  const [type,setType] = useState('All');
  const [night,setNight] = useState('All');
  const [fraudOnly,setFraudOnly] = useState(false);
  const [metric,setMetric] = useState('fraud_count');
  const [showSql,setShowSql] = useState(false);
  const params = useMemo(()=>({operation:parent?'DRILLDOWN':'ROLLUP',granularity:parent?.level||level,type_filter:type==='All'?null:type,fraud_only:fraudOnly,is_night:night==='All'?null:night==='Night',step_range_start:parent?.value??null}),[level,parent,type,night,fraudOnly]);
  const {data,sql,loading,error,execTime,refetch} = useOlapQuery(params);
  const rows = (data||[]).map(r=>({...r,period:r.period??r.child_period,tx_count:Number(r.tx_count||0),fraud_count:Number(r.fraud_count||0),total_amount:Number(r.total_amount||0)}));
  const currentLevel = parent ? (parent.level==='MONTH'?'WEEK':parent.level==='WEEK'?'DAY':'HOUR') : level;
  const label = n => currentLevel==='MONTH'?`Simulation month ${n}`:currentLevel==='WEEK'?`Week ${n}`:currentLevel==='DAY'?`Day ${n}`:`Hour ${n}`;
  const drill = row => { if(currentLevel!=='HOUR') setParent({level:currentLevel,value:row.period}); };
  const reset = () => { setParent(null); setLevel('WEEK'); setType('All'); setNight('All'); setFraudOnly(false); };
  return <div className="explore-page"><div className="page-intro"><span className="eyebrow">WAREHOUSE EXPLORER</span><h1>Explore transaction patterns</h1><p>Group the ingested PaySim sample by simulated time, then narrow it to find where confirmed fraud is concentrated.</p></div>
    <div className="explore-layout"><aside className="surface-card filter-panel"><div className="filter-title"><h2>Choose your view</h2><button onClick={reset} title="Reset filters"><RotateCcw size={16}/></button></div>
      <label>Group by</label><select value={level} onChange={e=>{setLevel(e.target.value);setParent(null)}}><option value="MONTH">Simulation month (30 days)</option><option value="WEEK">Simulation week</option><option value="DAY">Simulation day</option><option value="HOUR">Hour of day</option></select>
      <label>Transaction type</label><select value={type} onChange={e=>setType(e.target.value)}>{types.map(t=><option key={t} value={t}>{t==='All'?'All types':t.replaceAll('_',' ')}</option>)}</select>
      <label>Time of day</label><select value={night} onChange={e=>setNight(e.target.value)}><option>All</option><option>Day</option><option>Night</option></select>
      <label className="check-label"><input type="checkbox" checked={fraudOnly} onChange={e=>setFraudOnly(e.target.checked)}/>Confirmed fraud only</label>
      <div className="filter-help"><Info size={16}/><span>These controls query the transaction fact table joined to time and type dimensions.</span></div>
    </aside><div className="explore-results"><section className="surface-card"><div className="card-heading"><div><span className="eyebrow">GROUPED WAREHOUSE VIEW</span><h3>{parent ? `${parent.level==='MONTH'?'Simulation month':parent.level==='WEEK'?'Week':parent.level==='DAY'?'Day':'Hour'} ${parent.value} breakdown` : `${level==='MONTH'?'Monthly':level==='WEEK'?'Weekly':level==='DAY'?'Daily':'Hourly'} overview`}</h3><p>{rows.length} groups · each step in PaySim represents one simulated hour</p></div><button className="subtle-button" onClick={()=>csvDownload(rows,'sentinel-analysis.csv')} disabled={!rows.length}><Download size={15}/>Export CSV</button></div>
      {parent && <button className="back-link" onClick={()=>setParent(null)}><ArrowLeft size={15}/>Back to {parent.level.toLowerCase()} view</button>}
      <div className="metric-tabs" role="group" aria-label="Chart measure">{metrics.map(([key,text])=><button key={key} className={metric===key?'selected':''} aria-pressed={metric===key} onClick={()=>setMetric(key)}>{text}</button>)}</div>
      {error ? <div className="data-error">Could not run the warehouse query: {error}<button onClick={refetch}>Retry</button></div> : loading ? <div className="chart-placeholder">Running query…</div> : rows.length ? <div className="explore-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} onClick={state=>{if(state?.activePayload?.[0])drill(state.activePayload[0].payload)}} margin={{top:12,right:10,left:0,bottom:8}}><CartesianGrid vertical={false} stroke="#e8eeec"/><XAxis dataKey="period" tickFormatter={label} tickLine={false} axisLine={false}/><YAxis tickLine={false} axisLine={false}/><Tooltip labelFormatter={label} formatter={v=>amount(v)}/><Bar dataKey={metric} fill="#0b716a" radius={[4,4,0,0]} cursor={currentLevel==='HOUR'?'default':'pointer'}/></BarChart></ResponsiveContainer></div> : <div className="chart-placeholder">No records match these filters. Try another type or time period.</div>}
      <div className="chart-tip">{currentLevel==='HOUR'?'Hour is the deepest time level.':'Select a bar or table row to see a finer time breakdown.'}</div></section>
      <section className="surface-card result-card"><div className="card-heading"><div><span className="eyebrow">DETAIL</span><h3>Grouped results</h3></div><span className="query-time">{execTime!=null?`${execTime.toFixed(1)} ms query`:'—'}</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Period</th><th>Transactions</th><th>Confirmed fraud</th><th>Fraud rate</th><th>Amount · local units</th><th></th></tr></thead><tbody>{rows.map(r=><tr key={r.period} onClick={()=>drill(r)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();drill(r);}}} tabIndex={currentLevel==='HOUR'?-1:0} aria-label={`Drill into ${label(r.period)}`} className={currentLevel==='HOUR'?'':'clickable-row'}><td>{label(r.period)}</td><td>{formatNumber(r.tx_count)}</td><td>{formatNumber(r.fraud_count)}</td><td>{r.tx_count?`${(r.fraud_count/r.tx_count*100).toFixed(2)}%`:'—'}</td><td>{amount(r.total_amount)}</td><td>{currentLevel!=='HOUR'&&<ChevronRight size={15}/>}</td></tr>)}</tbody></table>{!rows.length&&!loading&&<div className="empty-copy">No results for this selection.</div>}</div></section>
      <div className="query-disclosure"><button onClick={()=>setShowSql(!showSql)}>{showSql?'Hide':'Show'} query and definitions</button>{showSql&&<div><p>Fact grain: one ingested transaction. Confirmed fraud uses the dataset label. Amounts have no specified currency. Simulation weeks and days are derived from PaySim steps.</p><pre>{sql||'No query yet.'}</pre></div>}</div>
    </div></div></div>;
}
