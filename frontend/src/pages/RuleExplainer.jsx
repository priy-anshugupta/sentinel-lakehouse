import { useRole } from '../context/RoleContext';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Info, SearchCheck } from 'lucide-react';
import api, { fetchDriftEvents, triggerMining } from '../lib/api';
import { formatNumber } from '../lib/formatters';
import { describeDrift } from '../lib/driftNarrative';

const title = t => t.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
export default function RuleExplainer() {
  const {role}=useRole();
  const technical=role==='DATA_ENGINEER';
  const [searchParams,setSearchParams] = useSearchParams();
  const requestedId = searchParams.get('drift_id');
  const [events,setEvents] = useState([]);
  const [selected,setSelected] = useState(requestedId || '');
  const [followNewest,setFollowNewest] = useState(!requestedId);
  const [eventsLoading,setEventsLoading] = useState(true);
  const [eventsError,setEventsError] = useState('');
  const [windowSize,setWindowSize] = useState(100);
  const [comparison,setComparison] = useState(null);
  const [rules,setRules] = useState(null);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  useEffect(()=>{if(requestedId){setSelected(requestedId);setFollowNewest(false);}},[requestedId]);
  useEffect(()=>{
    let active=true;
    const refreshEvents=()=>fetchDriftEvents().then(data=>{
      if(!active)return;
      setEvents(data);
      setEventsError('');
      if(followNewest)setSelected(String(data[0]?.drift_id||''));
      else setSelected(current=>current||String(data[0]?.drift_id||''));
    }).catch(e=>{if(active)setEventsError(e.response?.data?.detail||e.message);}).finally(()=>{if(active)setEventsLoading(false);});
    refreshEvents();
    const timer=setInterval(()=>{if(document.visibilityState==='visible')refreshEvents();},10000);
    return()=>{active=false;clearInterval(timer);};
  },[followNewest]);
  useEffect(()=>{
    if(!selected){setComparison(null);setRules(null);return;}
    let active=true;
    let inFlight=false;
    const params={window:windowSize};
    const refreshAnalysis=(showLoading=false)=>{
      if(inFlight)return;
      inFlight=true;
      if(showLoading)setLoading(true);
      Promise.all([api.get(`/mining/drift-comparison/${selected}`,{params}),technical?triggerMining({drift_id:Number(selected),min_support:0.01,min_confidence:0.5,min_lift:1.5,window_size:windowSize}):Promise.resolve(null)]).then(([c,r])=>{if(active){setComparison(c.data);setRules(r);setError('');}}).catch(e=>{if(active)setError(e.response?.data?.detail||e.message);}).finally(()=>{inFlight=false;if(active&&showLoading)setLoading(false);});
    };
    refreshAnalysis(true);
    const timer=setInterval(()=>{if(document.visibilityState==='visible')refreshAnalysis();},10000);
    return()=>{active=false;clearInterval(timer);};
  },[selected,windowSize,technical]);
  const selectedEvent=events.find(event=>String(event.drift_id)===selected);
  const byType = [...new Set((comparison?.rows||[]).map(r=>r.type))].map(type=>{const before=comparison.rows.find(r=>r.period==='before'&&r.type===type)||{};const after=comparison.rows.find(r=>r.period==='after'&&r.type===type)||{};return {type,before,after};});
  const total = period => (comparison?.rows||[]).filter(r=>r.period===period).reduce((a,r)=>({transactions:a.transactions+r.transactions,confirmed:a.confirmed+r.confirmed,flagged:a.flagged+r.flagged}),{transactions:0,confirmed:0,flagged:0});
  const before=total('before'),after=total('after');
  return <div className="patterns-page"><div className="page-intro"><span className="eyebrow">INVESTIGATION</span><h1>Understand a change in risk</h1><p>Compare recorded pattern changes in historical PaySim transactions. Reports use existing records; they do not create new detections.</p></div>
    <div className="surface-card"><div className="pattern-controls"><div><label>Drift event</label><select value={selected} onChange={e=>{setSelected(e.target.value);setFollowNewest(false);setSearchParams({drift_id:e.target.value});}}>{!events.length&&<option value="">No events recorded</option>}{events.map(e=><option key={e.drift_id} value={e.drift_id}>Event #{e.drift_id} · step {e.detected_at_step}</option>)}</select></div><div><label>Window on each side</label><select value={windowSize} onChange={e=>setWindowSize(Number(e.target.value))}><option value={50}>50 steps</option><option value={100}>100 steps</option><option value={200}>200 steps</option></select></div><div className="pattern-follow"><span>{followNewest?'Following newest detected event':'Viewing a selected event'}</span>{!followNewest&&<button className="subtle-button" onClick={()=>{setSearchParams({});setFollowNewest(true);}}>Follow newest</button>}</div></div>
      <div className="pattern-sync-note">{eventsLoading?'Loading recorded events…':`${events.length} recorded event${events.length===1?'':'s'}. Checking for new detections every 10 seconds while this page is open.`}{selectedEvent&&` Selected event recorded ${String(selectedEvent.detected_at_ts).replace('T',' ').slice(0,16)} ${technical?`with model ${selectedEvent.model_version||'legacy-online'}`:''}.${selectedEvent.is_injected?' The source replay included a simulated pattern shift.':''}`}</div>
      {!eventsLoading&&!events.length&&!eventsError&&<div className="empty-copy">No drift events have been recorded yet. Replay enough labelled transactions in Transaction monitor or import data to let the detector check for a change.</div>}
      {eventsError&&<div className="data-error" role="alert">{eventsError}</div>}
      {error&&<div className="data-error" role="alert">{error}</div>}
      {loading&&<div className="chart-placeholder">Comparing the selected periods…</div>}
      {!loading&&comparison&&<><div className="comparison-heading"><span className="eyebrow">OBSERVED AT STEP {comparison.step}</span><h2>Before and after</h2><p>Simulation steps {Math.max(0,comparison.step-windowSize)}–{comparison.step-1} versus {comparison.step}–{comparison.step+windowSize-1}. Counts depend on ingested rows in each window.</p></div><div className="drift-story"><strong>What changed, in plain language</strong><p>{describeDrift(comparison)}</p></div>{before.transactions&&after.transactions<before.transactions*.5&&<div className="context-strip"><Info size={17}/><span>The after window contains far fewer ingested transactions. Compare rates and collect more rows before interpreting the count change.</span></div>}<div className="comparison-grid"><div><span>Before</span><strong>{formatNumber(before.confirmed)}</strong><small>confirmed fraud / {formatNumber(before.transactions)} transactions</small><small>Rate {before.transactions?(100*before.confirmed/before.transactions).toFixed(2):'—'}% · {formatNumber(before.flagged)} model flags</small></div><div className="change-arrow"><ArrowRight size={23}/></div><div><span>After</span><strong>{formatNumber(after.confirmed)}</strong><small>confirmed fraud / {formatNumber(after.transactions)} transactions</small><small>Rate {after.transactions?(100*after.confirmed/after.transactions).toFixed(2):'—'}% · {formatNumber(after.flagged)} model flags</small></div></div>
        <h3 className="pattern-subtitle">Transaction-type breakdown</h3><div className="table-scroll"><table className="data-table"><thead><tr><th>Type</th><th>Before transactions</th><th>Before confirmed</th><th>After transactions</th><th>After confirmed</th><th>Change in confirmed</th></tr></thead><tbody>{byType.map(r=><tr key={r.type}><td>{title(r.type)}</td><td>{formatNumber(r.before.transactions||0)}</td><td>{formatNumber(r.before.confirmed||0)}</td><td>{formatNumber(r.after.transactions||0)}</td><td>{formatNumber(r.after.confirmed||0)}</td><td>{(r.after.confirmed||0)-(r.before.confirmed||0)>0?'+':''}{(r.after.confirmed||0)-(r.before.confirmed||0)}</td></tr>)}</tbody></table></div>
        {technical&&<div className="rule-section"><div className="rule-section-title"><SearchCheck size={20}/><div><h3>Association patterns</h3><p>{technical?'Apriori mines rules from transactions around this event. Window counts may include historical scoring versions.':'These patterns compare transactions around the selected change. An association is a lead to review, not proof of fraud.'}</p></div></div>{['emerged','extinct','shifted'].map(group=>(rules?.[group]||[]).map((r,i)=>{const data=r.rule||r;return <div className="rule-row" key={`${group}-${i}`}><span className="state-pill neutral">{group}</span><strong>{(data.antecedents||[]).join(' + ')} → {(data.consequents||[]).join(', ')}</strong><small>Confidence {((data.confidence||0)*100).toFixed(1)}% · Lift {(data.lift||0).toFixed(2)}×</small></div>}))}{!rules?.emerged?.length&&!rules?.extinct?.length&&!rules?.shifted?.length&&<div className="rule-empty"><Info size={18}/>No patterns met the support, confidence, and lift thresholds for this window. The observed counts above remain available for review.</div>}</div>}
      </>}
    </div><div className="source-note">Source: PaySim synthetic sample in DuckDB. Changes in counts can reflect different transaction volumes in the two windows.</div></div>;
}
