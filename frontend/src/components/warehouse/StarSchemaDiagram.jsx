import React, { useState } from 'react';
import { 
  Database, Clock, CreditCard, Users, GitCommit, Key, 
  Copy, Check, Layers, Sparkles, ArrowRight, ArrowDown, 
  ArrowLeft, ArrowUp, ShieldCheck, Activity, Info
} from 'lucide-react';

const RELATIONSHIPS = [
  {
    id: 'time_rel',
    from: 'dim_time',
    to: 'fact_transactions',
    fk: 'time_key',
    pk: 'time_key',
    name: 'Temporal Dimension Join',
    cardinality: '1 : N',
    color: '#0284C7', // signalBlue / sky
    description: 'Enables OLAP temporal slicing across diurnal cycles (hour 0-23), day of week, and 31-day timeline.',
    sql: `SELECT dt.period_of_day, dt.is_night, COUNT(*), SUM(ft.amount)\nFROM fact_transactions ft\nJOIN dim_time dt ON ft.time_key = dt.time_key\nGROUP BY dt.period_of_day, dt.is_night;`
  },
  {
    id: 'type_rel',
    from: 'dim_transaction_type',
    to: 'fact_transactions',
    fk: 'type_key',
    pk: 'type_key',
    name: 'Transaction Type Join',
    cardinality: '1 : N',
    color: '#D97706', // warn / amber
    description: 'Categorizes transactions into TRANSFER, CASH_OUT, PAYMENT, DEBIT, CASH_IN with baseline risk weights.',
    sql: `SELECT dtt.type_name, COUNT(*), AVG(ft.fraud_probability)\nFROM fact_transactions ft\nJOIN dim_transaction_type dtt ON ft.type_key = dtt.type_key\nGROUP BY dtt.type_name;`
  },
  {
    id: 'account_rel',
    from: 'dim_account',
    to: 'fact_transactions',
    fk: 'orig_acc_key / dest_acc_key',
    pk: 'acc_key',
    name: 'Role-Playing Account Join',
    cardinality: '1 : N (Dual)',
    color: '#7C3AED', // purple
    description: 'Dual role-playing join: maps originator account (sender) and destination account (recipient / merchant).',
    sql: `SELECT da_orig.account_type AS orig_type, da_dest.account_type AS dest_type, COUNT(*)\nFROM fact_transactions ft\nJOIN dim_account da_orig ON ft.orig_acc_key = da_orig.acc_key\nJOIN dim_account da_dest ON ft.dest_acc_key = da_dest.acc_key\nGROUP BY orig_type, dest_type;`
  },
  {
    id: 'drift_rel',
    from: 'fact_drift_events',
    to: 'fact_transactions',
    fk: 'step_number (Horizon)',
    pk: 'detected_at_step',
    name: 'Concept Drift Horizon Link',
    cardinality: '1 : N',
    color: '#DC2626', // threat / red
    description: 'Correlates ADWIN concept drift detections and mined association rules to the exact step horizon in transactions.',
    sql: `SELECT fde.drift_id, fde.detected_at_step, COUNT(ft.tx_id) AS impacted_txs\nFROM fact_drift_events fde\nJOIN fact_transactions ft ON ft.step_number BETWEEN fde.pre_window_start AND fde.post_window_end\nGROUP BY fde.drift_id, fde.detected_at_step;`
  }
];

export default function StarSchemaDiagram({ schema = {} }) {
  const [selectedRel, setSelectedRel] = useState(RELATIONSHIPS[0]);
  const [hoveredTable, setHoveredTable] = useState(null);
  const [copied, setCopied] = useState(false);

  const copySql = (sql) => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHighlighted = (tableId) => {
    if (!selectedRel && !hoveredTable) return false;
    if (hoveredTable) {
      if (hoveredTable === tableId) return true;
      if (hoveredTable === 'fact_transactions') return true;
      const rel = RELATIONSHIPS.find(r => r.from === hoveredTable && r.to === tableId);
      return Boolean(rel);
    }
    return selectedRel.from === tableId || selectedRel.to === tableId;
  };

  return (
    <div className="space-y-6">
      {/* Diagram Canvas Container */}
      <div className="bg-canvas border border-bone rounded-xl shadow-sm p-5 sm:p-6 relative overflow-hidden">
        {/* Subtle dot grid blueprint pattern */}
        <div 
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#1A1D23 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        />

        {/* Header Bar */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-bone mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-copper/10 rounded-lg text-copper">
                <Layers className="h-4 w-4" />
              </span>
              <h2 className="text-base font-bold text-ink tracking-tight">Star Schema Entity-Relationship Architecture</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-copper/10 text-copper border border-copper/20">
                1 FACT • 3 CONFORMED DIMS
              </span>
            </div>
            <p className="text-xs text-slate mt-1">
              Columnar dimensional warehouse model in DuckDB with single-grain fact records and surrogate integer keys.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-3 px-3 py-1.5 bg-paper rounded-lg border border-bone text-xs font-mono">
              <span className="flex items-center gap-1.5 text-graphite">
                <span className="w-2.5 h-2.5 rounded bg-copper"></span>
                <span className="font-semibold text-ink">Fact (6.36M)</span>
              </span>
              <span className="flex items-center gap-1.5 text-graphite">
                <span className="w-2.5 h-2.5 rounded bg-signalBlue"></span>
                <span className="font-semibold text-ink">Dimension</span>
              </span>
              <span className="flex items-center gap-1.5 text-graphite">
                <Key className="w-3 h-3 text-copper" />
                <span className="text-slate">PK/FK</span>
              </span>
            </div>
          </div>
        </div>

        {/* ─── STAR DIAGRAM TOPOLOGY ─── */}
        <div className="relative z-10 overflow-x-auto pb-4">
          <div className="min-w-[860px] flex flex-col items-center">
            
            {/* 1. NORTH SATELLITE: dim_time */}
            <div className="w-full flex justify-center mb-1">
              <div 
                onMouseEnter={() => setHoveredTable('dim_time')}
                onMouseLeave={() => setHoveredTable(null)}
                onClick={() => setSelectedRel(RELATIONSHIPS[0])}
                className={`w-[360px] rounded-xl border transition-all duration-200 cursor-pointer shadow-sm ${
                  isHighlighted('dim_time')
                    ? 'border-signalBlue ring-2 ring-signalBlue/20 bg-canvas shadow-md scale-[1.01]'
                    : 'border-bone bg-paper/90 hover:border-signalBlue/50'
                }`}
              >
                <div className="p-3 bg-signalBlue/10 border-b border-signalBlue/20 rounded-t-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-signalBlue" />
                    <span className="font-mono font-bold text-xs text-signalBlue">dim_time</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-signalBlue/15 text-signalBlue font-semibold">
                    DIMENSION (744 STEPS)
                  </span>
                </div>
                <div className="p-3 text-xs font-mono space-y-1">
                  <div className="flex justify-between items-center py-0.5 text-copper font-bold bg-copper/5 px-1.5 rounded">
                    <span className="flex items-center gap-1"><Key size={11} /> time_key</span>
                    <span className="text-[11px] text-slate">INTEGER (PK)</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                    <span>step (PaySim hour 1..744)</span>
                    <span className="text-[11px] text-slate">INTEGER</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                    <span>hour_of_day, period_of_day</span>
                    <span className="text-[11px] text-slate">TINYINT, VARCHAR</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                    <span>day_number, day_of_week, week_number</span>
                    <span className="text-[11px] text-slate">SMALLINT</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                    <span>is_night, is_weekend</span>
                    <span className="text-[11px] text-slate">BOOLEAN</span>
                  </div>
                </div>
              </div>
            </div>

            {/* VERTICAL CONNECTOR: dim_time ──► fact_transactions */}
            <div 
              onClick={() => setSelectedRel(RELATIONSHIPS[0])}
              className="flex flex-col items-center cursor-pointer group py-1"
            >
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-signalBlue/10 border border-signalBlue/30 text-[11px] font-mono text-signalBlue font-semibold transition-all group-hover:scale-105 shadow-sm">
                <span>1</span>
                <span>── FK: time_key ──►</span>
                <span>N (Many)</span>
              </div>
              <div className="w-0.5 h-6 bg-signalBlue/40"></div>
              <ArrowDown className="h-4 w-4 text-signalBlue -mt-1" />
            </div>

            {/* 2. MIDDLE ROW: WEST (dim_transaction_type) ── CENTER (fact_transactions) ── EAST (dim_account) */}
            <div className="w-full grid grid-cols-12 gap-3 items-center my-2">
              
              {/* WEST SATELLITE: dim_transaction_type */}
              <div className="col-span-3">
                <div 
                  onMouseEnter={() => setHoveredTable('dim_transaction_type')}
                  onMouseLeave={() => setHoveredTable(null)}
                  onClick={() => setSelectedRel(RELATIONSHIPS[1])}
                  className={`rounded-xl border transition-all duration-200 cursor-pointer shadow-sm ${
                    isHighlighted('dim_transaction_type')
                      ? 'border-warn ring-2 ring-warn/20 bg-canvas shadow-md scale-[1.01]'
                      : 'border-bone bg-paper/90 hover:border-warn/50'
                  }`}
                >
                  <div className="p-3 bg-warn/10 border-b border-warn/20 rounded-t-xl flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-warn" />
                      <span className="font-mono font-bold text-xs text-warn">dim_transaction_type</span>
                    </div>
                  </div>
                  <div className="p-3 text-xs font-mono space-y-1">
                    <div className="flex justify-between items-center py-0.5 text-copper font-bold bg-copper/5 px-1.5 rounded">
                      <span className="flex items-center gap-1"><Key size={11} /> type_key</span>
                      <span className="text-[10px] text-slate">INT (PK)</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                      <span>type_name</span>
                      <span className="text-[10px] text-slate">VARCHAR</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                      <span>type_code</span>
                      <span className="text-[10px] text-slate">CHAR(2)</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                      <span>risk_weight</span>
                      <span className="text-[10px] text-slate">DECIMAL</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                      <span>is_cashout</span>
                      <span className="text-[10px] text-slate">BOOLEAN</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                      <span>description</span>
                      <span className="text-[10px] text-slate">VARCHAR</span>
                    </div>
                  </div>
                </div>

                {/* Horizontal link label to Fact */}
                <div 
                  onClick={() => setSelectedRel(RELATIONSHIPS[1])}
                  className="mt-2 flex items-center justify-end gap-1 text-[11px] font-mono text-warn font-semibold cursor-pointer hover:underline"
                >
                  <span>FK: type_key (1:N)</span>
                  <ArrowRight size={14} />
                </div>
              </div>

              {/* CENTER HUB: fact_transactions */}
              <div className="col-span-6">
                <div 
                  onMouseEnter={() => setHoveredTable('fact_transactions')}
                  onMouseLeave={() => setHoveredTable(null)}
                  className="rounded-xl border-2 border-copper bg-canvas shadow-lg p-0.5"
                >
                  <div className="p-3.5 bg-copper text-white rounded-t-[10px] flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-white" />
                      <div>
                        <span className="font-mono font-bold text-sm">fact_transactions</span>
                        <span className="block text-[10px] font-mono text-copperLight opacity-90">CENTRAL FACT TABLE • GRAIN: 1 TX</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-black/20 text-white font-mono text-[11px] font-bold border border-white/20">
                      6,362,620 ROWS
                    </span>
                  </div>

                  <div className="p-4 bg-paper/60 rounded-b-[10px] divide-y divide-bone">
                    {/* Primary Key */}
                    <div className="pb-2.5">
                      <span className="text-[10px] uppercase tracking-wider text-slate font-bold font-mono">Primary Key</span>
                      <div className="flex justify-between items-center mt-1 py-1 px-2 rounded bg-copper/10 text-copper font-mono text-xs font-bold border border-copper/20">
                        <span className="flex items-center gap-1.5"><Key size={13} className="text-copper" /> tx_id</span>
                        <span className="text-[11px]">BIGINT (Auto-Inc PK)</span>
                      </div>
                    </div>

                    {/* Foreign Keys */}
                    <div className="py-2.5">
                      <span className="text-[10px] uppercase tracking-wider text-slate font-bold font-mono">Foreign Keys (Conformed Dimensions)</span>
                      <div className="grid grid-cols-2 gap-1.5 mt-1 font-mono text-xs">
                        <div 
                          onClick={() => setSelectedRel(RELATIONSHIPS[0])}
                          className={`p-1.5 px-2 rounded border flex justify-between items-center cursor-pointer transition-colors ${
                            selectedRel.id === 'time_rel' ? 'bg-signalBlue/15 border-signalBlue text-signalBlue font-bold' : 'bg-canvas border-bone text-graphite hover:border-signalBlue/50'
                          }`}
                        >
                          <span className="flex items-center gap-1"><ArrowUp size={11} /> time_key</span>
                          <span className="text-[10px] text-slate">FK → dim_time</span>
                        </div>
                        <div 
                          onClick={() => setSelectedRel(RELATIONSHIPS[1])}
                          className={`p-1.5 px-2 rounded border flex justify-between items-center cursor-pointer transition-colors ${
                            selectedRel.id === 'type_rel' ? 'bg-warn/15 border-warn text-warn font-bold' : 'bg-canvas border-bone text-graphite hover:border-warn/50'
                          }`}
                        >
                          <span className="flex items-center gap-1"><ArrowLeft size={11} /> type_key</span>
                          <span className="text-[10px] text-slate">FK → dim_type</span>
                        </div>
                        <div 
                          onClick={() => setSelectedRel(RELATIONSHIPS[2])}
                          className={`p-1.5 px-2 rounded border flex justify-between items-center cursor-pointer transition-colors ${
                            selectedRel.id === 'account_rel' ? 'bg-purple-600/15 border-purple-600 text-purple-600 font-bold' : 'bg-canvas border-bone text-graphite hover:border-purple-500/50'
                          }`}
                        >
                          <span className="flex items-center gap-1"><ArrowRight size={11} /> orig_acc_key</span>
                          <span className="text-[10px] text-slate">FK → dim_account</span>
                        </div>
                        <div 
                          onClick={() => setSelectedRel(RELATIONSHIPS[2])}
                          className={`p-1.5 px-2 rounded border flex justify-between items-center cursor-pointer transition-colors ${
                            selectedRel.id === 'account_rel' ? 'bg-purple-600/15 border-purple-600 text-purple-600 font-bold' : 'bg-canvas border-bone text-graphite hover:border-purple-500/50'
                          }`}
                        >
                          <span className="flex items-center gap-1"><ArrowRight size={11} /> dest_acc_key</span>
                          <span className="text-[10px] text-slate">FK → dim_account</span>
                        </div>
                      </div>
                    </div>

                    {/* Numeric Measures & ML Signals */}
                    <div className="pt-2.5">
                      <span className="text-[10px] uppercase tracking-wider text-slate font-bold font-mono">Measures & Online ML Labels</span>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 font-mono text-xs text-graphite">
                        <div className="flex justify-between py-0.5">
                          <span className="font-semibold text-ink">amount</span>
                          <span className="text-slate">DOUBLE (Value)</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-semibold text-threat">is_fraud_actual</span>
                          <span className="text-slate">BOOLEAN</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-slate">orig_balance_delta</span>
                          <span className="text-slate">DOUBLE</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-semibold text-safe">is_fraud_pred</span>
                          <span className="text-slate">BOOLEAN</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-slate">dest_balance_delta</span>
                          <span className="text-slate">DOUBLE</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="font-semibold text-copper">fraud_probability</span>
                          <span className="text-slate">DOUBLE</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-slate">step_number</span>
                          <span className="text-slate">INTEGER</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span className="text-slate">prediction_error</span>
                          <span className="text-slate">INTEGER (0/1)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* EAST SATELLITE: dim_account */}
              <div className="col-span-3">
                <div 
                  onMouseEnter={() => setHoveredTable('dim_account')}
                  onMouseLeave={() => setHoveredTable(null)}
                  onClick={() => setSelectedRel(RELATIONSHIPS[2])}
                  className={`rounded-xl border transition-all duration-200 cursor-pointer shadow-sm ${
                    isHighlighted('dim_account')
                      ? 'border-purple-600 ring-2 ring-purple-600/20 bg-canvas shadow-md scale-[1.01]'
                      : 'border-bone bg-paper/90 hover:border-purple-500/50'
                  }`}
                >
                  <div className="p-3 bg-purple-600/10 border-b border-purple-600/20 rounded-t-xl flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-purple-600" />
                      <span className="font-mono font-bold text-xs text-purple-600">dim_account</span>
                    </div>
                  </div>
                  <div className="p-3 text-xs font-mono space-y-1">
                    <div className="flex justify-between items-center py-0.5 text-copper font-bold bg-copper/5 px-1.5 rounded">
                      <span className="flex items-center gap-1"><Key size={11} /> acc_key</span>
                      <span className="text-[10px] text-slate">INT (PK)</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                      <span>account_id</span>
                      <span className="text-[10px] text-slate">VARCHAR</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                      <span>account_type</span>
                      <span className="text-[10px] text-slate">VARCHAR (C/M)</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                      <span>name_prefix</span>
                      <span className="text-[10px] text-slate">CHAR(1)</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                      <span>first_seen_step</span>
                      <span className="text-[10px] text-slate">INTEGER</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                      <span>risk_tier</span>
                      <span className="text-[10px] text-slate">VARCHAR</span>
                    </div>
                  </div>
                </div>

                {/* Horizontal link label to Fact */}
                <div 
                  onClick={() => setSelectedRel(RELATIONSHIPS[2])}
                  className="mt-2 flex items-center justify-start gap-1 text-[11px] font-mono text-purple-600 font-semibold cursor-pointer hover:underline"
                >
                  <ArrowLeft size={14} />
                  <span>FK: orig & dest_acc_key</span>
                </div>
              </div>
            </div>

            {/* VERTICAL CONNECTOR: fact_drift_events ──► fact_transactions */}
            <div 
              onClick={() => setSelectedRel(RELATIONSHIPS[3])}
              className="flex flex-col items-center cursor-pointer group py-1"
            >
              <ArrowUp className="h-4 w-4 text-threat -mb-1" />
              <div className="w-0.5 h-6 bg-threat/40"></div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-threat/10 border border-threat/30 text-[11px] font-mono text-threat font-semibold transition-all group-hover:scale-105 shadow-sm">
                <span>1</span>
                <span>── Horizon: detected_at_step ──►</span>
                <span>N (Fact Windows)</span>
              </div>
            </div>

            {/* 3. SOUTH SATELLITE: fact_drift_events */}
            <div className="w-full flex justify-center mt-1">
              <div 
                onMouseEnter={() => setHoveredTable('fact_drift_events')}
                onMouseLeave={() => setHoveredTable(null)}
                onClick={() => setSelectedRel(RELATIONSHIPS[3])}
                className={`w-[480px] rounded-xl border transition-all duration-200 cursor-pointer shadow-sm ${
                  isHighlighted('fact_drift_events')
                    ? 'border-threat ring-2 ring-threat/20 bg-canvas shadow-md scale-[1.01]'
                    : 'border-bone bg-paper/90 hover:border-threat/50'
                }`}
              >
                <div className="p-3 bg-threat/10 border-b border-threat/20 rounded-t-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitCommit className="h-4 w-4 text-threat" />
                    <span className="font-mono font-bold text-xs text-threat">fact_drift_events</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-threat/15 text-threat font-semibold">
                    AUDIT FACT TABLE (ADWIN & FP-GROWTH)
                  </span>
                </div>
                <div className="p-3 text-xs font-mono grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex justify-between items-center py-0.5 text-copper font-bold bg-copper/5 px-1.5 rounded col-span-2">
                    <span className="flex items-center gap-1"><Key size={11} /> drift_id</span>
                    <span className="text-[11px] text-slate">INTEGER (PK Auto-Inc)</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                    <span>detected_at_step</span>
                    <span className="text-[10px] text-slate">INTEGER</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                    <span>detected_at_ts</span>
                    <span className="text-[10px] text-slate">TIMESTAMP</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                    <span>pre/post_window</span>
                    <span className="text-[10px] text-slate">INTEGER</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite">
                    <span>error_rate_before/after</span>
                    <span className="text-[10px] text-slate">DOUBLE</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 px-1.5 text-graphite col-span-2 border-t border-bone/60 pt-1">
                    <span>rules_json</span>
                    <span className="text-[10px] text-threat font-bold">JSON (Mined Association Rules)</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ─── INTERACTIVE RELATIONSHIP INSPECTOR PANEL ─── */}
        {selectedRel && (
          <div className="mt-6 pt-5 border-t border-bone bg-paper/60 rounded-xl p-4 sm:p-5 border border-bone">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-bone">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${selectedRel.color}15`, color: selectedRel.color }}>
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-ink text-sm">{selectedRel.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold" style={{ backgroundColor: `${selectedRel.color}20`, color: selectedRel.color }}>
                      {selectedRel.cardinality}
                    </span>
                  </div>
                  <p className="text-xs text-slate font-mono mt-0.5">
                    JOIN: <code className="text-ink font-bold">{selectedRel.to}.{selectedRel.fk}</code> = <code className="text-ink font-bold">{selectedRel.from}.{selectedRel.pk}</code>
                  </p>
                </div>
              </div>

              <button
                onClick={() => copySql(selectedRel.sql)}
                className="self-end md:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-canvas hover:bg-paper border border-bone rounded-lg text-xs font-mono text-graphite transition-all shadow-sm active:scale-95"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-safe" /> : <Copy className="h-3.5 w-3.5 text-slate" />}
                <span>{copied ? 'Copied SQL!' : 'Copy OLAP SQL'}</span>
              </button>
            </div>

            <p className="text-xs text-graphite mt-3 leading-relaxed">
              {selectedRel.description}
            </p>

            {/* SQL Snippet Preview */}
            <div className="mt-3 bg-ink text-paper rounded-lg p-3 font-mono text-xs overflow-x-auto border border-graphite">
              <div className="flex justify-between text-[10px] text-fog uppercase tracking-wider mb-1 font-sans">
                <span>DuckDB OLAP Execution Syntax</span>
                <span>Sub-second Columnar Aggregation</span>
              </div>
              <pre className="text-paper/90 whitespace-pre-wrap">{selectedRel.sql}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
