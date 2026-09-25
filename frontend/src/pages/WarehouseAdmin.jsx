import React, { useState, useEffect } from 'react';
import { 
  Database, Network, ShieldCheck, BarChart2, CheckCircle2, 
  AlertTriangle, XCircle, Clock, Activity, Layers, LayoutGrid, Table, GitCommit 
} from 'lucide-react';
import { fetchWarehouseStats, fetchWarehouseSchema, fetchDataQuality } from '../lib/api';
import StarSchemaDiagram from '../components/warehouse/StarSchemaDiagram';

export default function WarehouseAdmin() {
  const [activeTab, setActiveTab] = useState('schema');
  const [schemaViewMode, setSchemaViewMode] = useState('diagram');
  const [stats, setStats] = useState([]);
  const [schema, setSchema] = useState({});
  const [quality, setQuality] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'stats') {
          const data = await fetchWarehouseStats();
          setStats(data);
        } else if (activeTab === 'schema') {
          const data = await fetchWarehouseSchema();
          setSchema(data);
        } else if (activeTab === 'quality') {
          const data = await fetchDataQuality();
          setQuality(data);
        }
      } catch (err) {
        console.error('Failed to load warehouse data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-bone/60">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight flex items-center gap-2.5">
            <Database className="h-6 w-6 text-copper" />
            Warehouse Admin
          </h1>
          <p className="text-xs text-slate mt-0.5">Manage DuckDB columnar OLAP storage, ETL pipelines, and data quality</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-safe/10 text-safe border border-safe/20">
            <span className="h-1.5 w-1.5 rounded-full bg-safe animate-pulse"></span>
            DuckDB Active
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-bone overflow-x-auto gap-2">
        <button 
          className={`px-4 py-2.5 font-semibold text-xs transition-all whitespace-nowrap flex items-center gap-2 border-b-2 ${
            activeTab === 'schema' 
              ? 'text-copper border-copper font-bold' 
              : 'text-slate hover:text-ink border-transparent'
          }`}
          onClick={() => setActiveTab('schema')}
        >
          <Network size={15} /> Schema Viewer
        </button>
        <button 
          className={`px-4 py-2.5 font-semibold text-xs transition-all whitespace-nowrap flex items-center gap-2 border-b-2 ${
            activeTab === 'etl' 
              ? 'text-copper border-copper font-bold' 
              : 'text-slate hover:text-ink border-transparent'
          }`}
          onClick={() => setActiveTab('etl')}
        >
          <Clock size={15} /> ETL Monitor
        </button>
        <button 
          className={`px-4 py-2.5 font-semibold text-xs transition-all whitespace-nowrap flex items-center gap-2 border-b-2 ${
            activeTab === 'quality' 
              ? 'text-copper border-copper font-bold' 
              : 'text-slate hover:text-ink border-transparent'
          }`}
          onClick={() => setActiveTab('quality')}
        >
          <ShieldCheck size={15} /> Data Quality
        </button>
        <button 
          className={`px-4 py-2.5 font-semibold text-xs transition-all whitespace-nowrap flex items-center gap-2 border-b-2 ${
            activeTab === 'stats' 
              ? 'text-copper border-copper font-bold' 
              : 'text-slate hover:text-ink border-transparent'
          }`}
          onClick={() => setActiveTab('stats')}
        >
          <BarChart2 size={15} /> Table Stats
        </button>
      </div>

      {activeTab === 'schema' && (
        <div className="space-y-6">
          {/* Sub-view representation switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-canvas p-3 sm:p-4 rounded-xl border border-bone shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Network size={15} className="text-copper" />
                Schema View:
              </span>
              <span className="text-xs text-slate hidden md:inline">Choose architectural diagram or columnar details</span>
            </div>
            
            <div className="flex items-center p-1 bg-paper rounded-lg border border-bone gap-1">
              <button
                onClick={() => setSchemaViewMode('diagram')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  schemaViewMode === 'diagram'
                    ? 'bg-canvas text-copper font-bold shadow-sm border border-bone'
                    : 'text-slate hover:text-ink'
                }`}
              >
                <Layers size={13} />
                <span>Star Schema Diagram</span>
              </button>

              <button
                onClick={() => setSchemaViewMode('cards')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  schemaViewMode === 'cards'
                    ? 'bg-canvas text-copper font-bold shadow-sm border border-bone'
                    : 'text-slate hover:text-ink'
                }`}
              >
                <LayoutGrid size={13} />
                <span>Table Cards</span>
              </button>

              <button
                onClick={() => setSchemaViewMode('ddl')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  schemaViewMode === 'ddl'
                    ? 'bg-canvas text-copper font-bold shadow-sm border border-bone'
                    : 'text-slate hover:text-ink'
                }`}
              >
                <Table size={13} />
                <span>Columnar DDL</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="bg-canvas p-8 rounded-xl border border-bone text-center text-slate font-mono text-xs">
              Loading schema...
            </div>
          ) : Object.keys(schema).length > 0 ? (
            <>
              {schemaViewMode === 'diagram' && (
                <StarSchemaDiagram schema={schema} />
              )}

              {schemaViewMode === 'cards' && (
                <div className="bg-canvas p-6 rounded-xl border border-bone shadow-sm">
                  <h3 className="text-base font-bold text-ink mb-4">Star Schema Table Overview</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(schema).map(([tableName, columns]) => {
                      const cols = Array.isArray(columns) ? columns : [];
                      return (
                        <div key={tableName} className="bg-paper border border-bone rounded-lg p-4">
                          <h4 className="font-bold text-ink mb-2 flex items-center gap-2 text-sm">
                            {tableName === 'fact_transactions' && <Database size={16} className="text-copper" />}
                            {tableName.startsWith('dim_') && <Network size={16} className="text-signalBlue" />}
                            {tableName === 'fact_drift_events' && <GitCommit size={16} className="text-threat" />}
                            {tableName}
                          </h4>
                          <ul className="text-sm text-slate space-y-1 font-mono">
                            {cols.slice(0, 8).map((col, i) => (
                              <li key={i} className="flex justify-between">
                                <span className={col?.name?.endsWith('_key') || col?.name?.endsWith('_id') ? 'text-signalBlue font-semibold' : col?.name === 'tx_id' ? 'text-copperDark font-bold' : ''}>
                                  {col?.name}
                                </span>
                                <span className="text-slate">{col?.type}</span>
                              </li>
                            ))}
                            {cols.length > 8 && <li className="text-xs text-fog">+{cols.length - 8} more columns</li>}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {schemaViewMode === 'ddl' && (
                <div className="bg-canvas p-6 rounded-xl border border-bone shadow-sm">
                  <h3 className="text-base font-bold text-ink mb-4">Full Columnar Schema Details (DuckDB DDL)</h3>
                  <div className="overflow-x-auto">
                    {Object.entries(schema).map(([tableName, columns]) => {
                      const cols = Array.isArray(columns) ? columns : [];
                      return (
                        <div key={tableName} className="mb-6 last:mb-0">
                          <h4 className="font-bold text-ink mb-2 text-copper font-mono text-sm flex items-center gap-2">
                            <Database size={15} />
                            {tableName}
                          </h4>
                          <table className="w-full text-xs text-left border border-bone rounded-lg overflow-hidden">
                            <thead className="bg-ink text-canvas font-mono uppercase tracking-wider text-[11px]">
                              <tr>
                                <th className="px-4 py-2.5 font-medium">Column</th>
                                <th className="px-4 py-2.5 font-medium">Type</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-bone">
                              {cols.map((col, i) => (
                                <tr key={i} className="hover:bg-paper transition-colors">
                                  <td className="px-4 py-2 font-mono font-semibold text-graphite">{col?.name}</td>
                                  <td className="px-4 py-2 text-slate font-mono">{col?.type}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-canvas p-8 rounded-xl border border-bone text-center text-slate font-mono text-xs">
              No schema data available
            </div>
          )}

          <div className="bg-canvas rounded-xl border border-bone shadow-sm overflow-hidden">
            <h3 className="bg-paper px-4 py-3 font-bold text-ink border-b border-bone text-xs uppercase tracking-wider">
              Discretization Legend (For FP-Growth Association Mining)
            </h3>
            <table className="w-full text-xs">
              <thead className="bg-paper text-slate border-b border-bone text-left font-mono uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3 font-medium">Feature</th>
                  <th className="p-3 font-medium">Bin Name</th>
                  <th className="p-3 font-medium">Range / Condition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bone text-ink font-mono text-xs">
                <tr className="hover:bg-paper"><td className="p-3 font-bold text-copper">amount</td><td className="p-3">MICRO</td><td className="p-3 text-slate">{"x < 1,000"}</td></tr>
                <tr className="hover:bg-paper"><td className="p-3 font-bold text-copper">amount</td><td className="p-3">LOW</td><td className="p-3 text-slate">{"1,000 \u2264 x < 50,000"}</td></tr>
                <tr className="hover:bg-paper"><td className="p-3 font-bold text-copper">amount</td><td className="p-3">MEDIUM</td><td className="p-3 text-slate">{"50,000 \u2264 x < 200,000"}</td></tr>
                <tr className="hover:bg-paper"><td className="p-3 font-bold text-copper">amount</td><td className="p-3">HIGH</td><td className="p-3 text-slate">{"200,000 \u2264 x < 1,000,000"}</td></tr>
                <tr className="hover:bg-paper"><td className="p-3 font-bold text-copper">amount</td><td className="p-3">VERY_HIGH</td><td className="p-3 text-slate">{"x \u2265 1,000,000"}</td></tr>
                <tr className="hover:bg-paper"><td className="p-3 font-bold text-copper">time</td><td className="p-3">LATE_NIGHT</td><td className="p-3 text-slate">{"hour 0\u20135"}</td></tr>
                <tr className="hover:bg-paper"><td className="p-3 font-bold text-copper">time</td><td className="p-3">MORNING</td><td className="p-3 text-slate">{"hour 6\u201311"}</td></tr>
                <tr className="hover:bg-paper"><td className="p-3 font-bold text-copper">time</td><td className="p-3">AFTERNOON</td><td className="p-3 text-slate">{"hour 12\u201317"}</td></tr>
                <tr className="hover:bg-paper"><td className="p-3 font-bold text-copper">time</td><td className="p-3">EVENING</td><td className="p-3 text-slate">{"hour 18\u201323"}</td></tr>
                <tr className="hover:bg-paper"><td className="p-3 font-bold text-copper">balance</td><td className="p-3">FULL_DRAIN</td><td className="p-3 text-slate">{"old > 0 AND new = 0"}</td></tr>
                <tr className="hover:bg-paper"><td className="p-3 font-bold text-copper">balance</td><td className="p-3">HEAVY_DRAIN</td><td className="p-3 text-slate">{"old > 0 AND 0 < new \u2264 old \u00d7 0.1"}</td></tr>
                <tr className="hover:bg-paper"><td className="p-3 font-bold text-copper">balance</td><td className="p-3">PARTIAL</td><td className="p-3 text-slate">{"old > 0 AND new > old \u00d7 0.1"}</td></tr>
                <tr className="hover:bg-paper"><td className="p-3 font-bold text-copper">balance</td><td className="p-3">ZERO_BALANCE</td><td className="p-3 text-slate">old = 0 AND new = 0</td></tr>
                <tr className="hover:bg-paper"><td className="p-3 font-bold text-copper">balance</td><td className="p-3">DEPOSIT</td><td className="p-3 text-slate">{"new > old"}</td></tr>
                <tr className="hover:bg-paper"><td className="p-3 font-bold text-copper">type</td><td className="p-3">TYPE_*</td><td className="p-3 text-slate">Direct map (e.g. TYPE_TRANSFER)</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'etl' && (
        <div className="space-y-6">
          <div className="bg-canvas p-6 rounded-xl border border-bone flex justify-between items-center shadow-sm">
            <div>
              <h2 className="text-base font-bold text-ink">Overall Pipeline Health</h2>
              <p className="text-xs text-slate mt-0.5 font-mono">Continuous streaming ingestion into columnar warehouse</p>
            </div>
            <div className="bg-safe/10 text-safe px-3.5 py-1.5 rounded-full font-bold font-mono text-xs flex items-center gap-2 border border-safe/20">
              <span className="w-2 h-2 rounded-full bg-safe animate-pulse"></span>
              HEALTHY • 0 ERRORS
            </div>
          </div>

          <div className="bg-canvas p-8 rounded-xl border border-bone shadow-sm relative overflow-hidden">
            <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-bone -translate-y-1/2 z-0"></div>
            
            <div className="relative z-10 flex justify-between">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-canvas border-2 border-safe flex items-center justify-center mb-3 shadow-sm">
                  <Database size={20} className="text-safe" />
                </div>
                <div className="font-bold text-ink text-sm">Extract</div>
                <div className="text-xs text-slate mt-0.5">Streaming API</div>
                <div className="text-xs font-mono font-semibold text-copper mt-1.5 bg-paper px-2 py-0.5 rounded border border-bone">~1,240 msg/sec</div>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-canvas border-2 border-signalBlue flex items-center justify-center mb-3 shadow-sm relative">
                  <Activity size={20} className="text-signalBlue" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-signalBlue rounded-full animate-ping"></span>
                </div>
                <div className="font-bold text-ink text-sm">Transform</div>
                <div className="text-xs text-slate mt-0.5">Hoeffding + Binning</div>
                <div className="text-xs font-mono font-semibold text-copper mt-1.5 bg-paper px-2 py-0.5 rounded border border-bone">~14ms latency</div>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-canvas border-2 border-copper flex items-center justify-center mb-3 shadow-sm">
                  <Database size={20} className="text-copper" />
                </div>
                <div className="font-bold text-ink text-sm">Load</div>
                <div className="text-xs text-slate mt-0.5">DuckDB Appender</div>
                <div className="text-xs font-mono font-semibold text-copper mt-1.5 bg-paper px-2 py-0.5 rounded border border-bone">Batching (450/500)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'quality' && (
        <div className="bg-canvas rounded-xl border border-bone shadow-sm overflow-hidden">
          <div className="bg-ink p-4 flex justify-between items-center text-white">
            <h2 className="text-sm font-bold tracking-wide uppercase">Automated Data Quality Checks</h2>
            <span className="text-xs font-mono bg-graphite px-2.5 py-1 rounded border border-slate/40 text-paper">Last run: Automated on commit</span>
          </div>
          <div className="divide-y divide-bone">
            {loading ? (
              <div className="p-8 text-center text-slate font-mono text-xs">Loading quality checks...</div>
            ) : quality.length > 0 ? (
              quality.map((q, i) => (
                <div key={i} className="p-4 flex items-start gap-4 hover:bg-paper transition-colors">
                  <div className="mt-0.5">
                    {q.status === 'PASS' ? <CheckCircle2 className="text-safe" size={18} /> : 
                     q.status === 'WARNING' ? <AlertTriangle className="text-warn" size={18} /> : 
                     q.status === 'FAIL' ? <XCircle className="text-threat" size={18} /> : null}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-ink text-sm">{q.name}</div>
                    <div className="text-xs text-slate mt-0.5 font-mono">{q.detail}</div>
                  </div>
                  <div>
                    <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded border ${
                      q.status === 'PASS' ? 'bg-safe/10 text-safe border-safe/20' : 
                      q.status === 'WARNING' ? 'bg-warn/10 text-warn border-warn/20' : 
                      'bg-threat/10 text-threat border-threat/20'
                    }`}>
                      {q.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate font-mono text-xs">No quality data available</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="bg-canvas rounded-xl border border-bone shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate font-mono text-xs">Loading table stats...</div>
          ) : stats.length > 0 ? (
            <table className="w-full text-xs text-left">
              <thead className="bg-ink text-canvas uppercase font-mono tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-3 font-medium">Table Name</th>
                  <th className="px-6 py-3 font-medium text-right">Row Count</th>
                  <th className="px-6 py-3 font-medium text-right">Size on Disk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bone text-ink font-mono tabular-nums">
                {stats.map((s, i) => (
                  <tr key={i} className="hover:bg-paper transition-colors">
                    <td className="px-6 py-3.5 font-bold text-copper">{s.table}</td>
                    <td className="px-6 py-3.5 text-right font-semibold">{Number(s.row_count || 0).toLocaleString()}</td>
                    <td className="px-6 py-3.5 text-right text-slate">{s.size_mb ? s.size_mb + ' MB' : 'N/A'}</td>
                  </tr>
                ))}
                <tr className="bg-paper border-t border-bone font-bold text-ink">
                  <td className="px-6 py-3.5">TOTAL</td>
                  <td className="px-6 py-3.5 text-right">{stats.reduce((acc, curr) => acc + Number(curr.row_count || 0), 0).toLocaleString()}</td>
                  <td className="px-6 py-3.5 text-right text-copper">
                    {stats.reduce((acc, curr) => acc + (Number(curr.size_mb) || 0), 0).toFixed(2)} MB
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate font-mono text-xs">No table stats available</div>
          )}
        </div>
      )}
    </div>
  );
}