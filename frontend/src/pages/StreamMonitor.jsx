import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Pause, Play, Radio, RotateCcw } from 'lucide-react';
import useWebSocket from '../hooks/useWebSocket';
import { fetchRecentTransactions } from '../lib/api';
import { formatNumber } from '../lib/formatters';

const amount=n=>new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(n||0);
export default function StreamMonitor(){
  const {lastMessage,connectionStatus,sendMessage}=useWebSocket();
  const [running,setRunning]=useState(false);
  const [speed,setSpeed]=useState(200);
  const [rows,setRows]=useState([]);
  const [metrics,setMetrics]=useState(null);
  const [alert,setAlert]=useState(null);
  const [error,setError]=useState('');
  useEffect(()=>{fetchRecentTransactions(30).then(setRows).catch(e=>setError(e.response?.data?.detail||e.message));},[]);
  useEffect(()=>{if(!lastMessage)return;if(lastMessage.type==='transaction'){
    const t=lastMessage.data;setRows(prev=>[{...t,tx_id:t.tx_id||`live-${Date.now()}`,isFraudPrediction:Boolean(t.is_fraud_prediction),fraudProbability:t.fraud_probability,is_fraud_actual:Boolean(t.isFraud)},...prev].slice(0,50));
  }else if(lastMessage.type==='metrics'){setMetrics(lastMessage.data);}else if(lastMessage.type==='drift_alert'){setAlert(lastMessage.data);}},[lastMessage]);
  const action=(name)=>{sendMessage({action:name});if(name==='start')setRunning(true);if(name==='pause'||name==='reset')setRunning(false);if(name==='reset'){setMetrics(null);setAlert(null);}};
  return <div className="monitor-page"><div className="page-intro"><span className="eyebrow">SIMULATION MONITOR</span><h1>Transaction monitor</h1><p>Replay PaySim events through the online classifier. New rows enter the warehouse; model flags are review leads, not confirmed fraud.</p></div>
    <div className="monitor-controls surface-card"><div><span className={`connection-dot ${connectionStatus==='Open'?'connected':''}`}/><strong>{connectionStatus==='Open'?'Stream connected':'Stream disconnected'}</strong><small>WebSocket simulation</small></div><div className="monitor-actions"><button className="primary-button" disabled={connectionStatus!=='Open'||running} onClick={()=>action('start')}><Play size={16}/>Start replay</button><button className="subtle-button" disabled={!running} onClick={()=>action('pause')}><Pause size={16}/>Pause</button><button className="subtle-button" disabled={connectionStatus!=='Open'} onClick={()=>action('reset')}><RotateCcw size={16}/>Reset</button></div><label>Replay interval <strong>{speed} ms</strong><input type="range" min="50" max="1000" step="50" value={speed} onChange={e=>{const next=Number(e.target.value);setSpeed(next);sendMessage({action:'set_speed',speed:next});}}/></label></div>
    {error&&<div className="data-error">{error}</div>}{alert&&<div className="context-strip"><Radio size={18}/><span>{alert.message||`A change was detected at simulation step ${alert.step}.`} <Link to="/rules">Compare patterns <ArrowRight size={13}/></Link></span></div>}
    <div className="metric-grid monitor-metrics"><div className="metric-tile"><div className="metric-top"><span>Current step</span></div><strong>{metrics?.step??rows[0]?.step??'—'}</strong><small>One step = one simulated hour</small></div><div className="metric-tile"><div className="metric-top"><span>Processed this replay</span></div><strong>{formatNumber(metrics?.total_processed||0)}</strong><small>Events sent by simulator</small></div><div className="metric-tile"><div className="metric-top"><span>Rolling model accuracy</span></div><strong>{metrics?.accuracy==null?'—':`${(metrics.accuracy*100).toFixed(1)}%`}</strong><small>Available after enough labelled events</small></div><div className="metric-tile"><div className="metric-top"><span>Recent review leads</span></div><strong>{formatNumber(rows.filter(r=>r.isFraudPrediction).length)}</strong><small>Among the {rows.length} rows shown</small></div></div>
    <section className="surface-card recent-card"><div className="card-heading"><div><span className="eyebrow">RECENT EVENTS</span><h3>Transactions entering the warehouse</h3><p>Predictions are shown beside the known label in this synthetic dataset.</p></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>ID</th><th>Step</th><th>Type</th><th>Amount · local units</th><th>Model</th><th>Dataset label</th></tr></thead><tbody>{rows.map((r,i)=><tr key={`${r.tx_id}-${i}`}><td>{r.tx_id}</td><td>{r.step}</td><td>{r.type?.replaceAll('_',' ')}</td><td>{amount(r.amount)}</td><td><span className={`state-pill ${r.isFraudPrediction?'warning':'neutral'}`}>{r.isFraudPrediction?'Flagged':'Not flagged'}</span></td><td><span className={`state-pill ${r.is_fraud_actual?'danger':'neutral'}`}>{r.is_fraud_actual?'Confirmed fraud':'Not fraud'}</span></td></tr>)}</tbody></table>{!rows.length&&<div className="empty-copy">No rows yet. Start replay to ingest transactions.</div>}</div></section>
    <div className="source-note">This page controls a local simulation. Reset affects the simulator state and does not delete warehouse rows.</div></div>;
}
