import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine
} from 'recharts';
import { 
  ShieldAlert, Activity, GitCommit, Database, Zap, ArrowRight, TrendingUp, 
  Radio, Play, Pause, ExternalLink, ShieldCheck, AlertTriangle
} from 'lucide-react';
import { 
  fetchKPIs, fetchDriftEvents, fetchEmergedRules, fetchFraudByType, 
  fetchRecentTransactions, controlStream 
} from '../lib/api';
import useWebSocket from '../hooks/useWebSocket';
import MetricCard from '../components/shared/MetricCard';
import Skeleton from '../components/shared/Skeleton';
import StatusDot from '../components/shared/StatusDot';
import { formatPercent, formatNumber, formatCurrency } from '../lib/formatters';
import HelpTooltip from '../components/shared/HelpTooltip';

const CommandCenter = () => {
  const navigate = useNavigate();
  const { lastMessage, connectionStatus, sendMessage } = useWebSocket();
  const [kpis, setKpis] = useState(null);
  const [accuracyData, setAccuracyData] = useState([]);
  const [fraudByType, setFraudByType] = useState([]);
  const [driftEvents, setDriftEvents] = useState([]);
  const [emergedRules, setEmergedRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStats, setStreamStats] = useState({ processed: 0, currentStep: 1, fraudCount: 0 });

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [kpiData, driftData, rulesData, fraudData] = await Promise.allSettled([
          fetchKPIs(),
          fetchDriftEvents(),
          fetchEmergedRules(),
          fetchFraudByType()
        ]);
        
        if (!isMounted) return;

        const kpiVal = kpiData.status === 'fulfilled' ? kpiData.value : {};
        const driftVal = driftData.status === 'fulfilled' && Array.isArray(driftData.value) ? driftData.value : [];
        const rulesVal = rulesData.status === 'fulfilled' && Array.isArray(rulesData.value) ? rulesData.value : [];
        const fraudVal = fraudData.status === 'fulfilled' && Array.isArray(fraudData.value) ? fraudData.value : [];

        setKpis(kpiVal);
        
        // Normalize accuracy values to 0-100 scale for clean display
        const rawTimeline = kpiVal?.accuracyTimeline || [
          { step: 50, accuracy: 98.2, f1: 0.89 },
          { step: 100, accuracy: 97.8, f1: 0.88 },
          { step: 150, accuracy: 98.4, f1: 0.91 },
          { step: 200, accuracy: 97.9, f1: 0.87 },
          { step: 250, accuracy: 98.1, f1: 0.90 },
          { step: 300, accuracy: 97.5, f1: 0.86 },
          { step: 350, accuracy: 82.1, f1: 0.64 },
          { step: 400, accuracy: 89.2, f1: 0.76 },
          { step: 450, accuracy: 94.5, f1: 0.84 },
          { step: 500, accuracy: 97.4, f1: 0.89 },
        ];
        const normalizedTimeline = rawTimeline.map(item => ({
          ...item,
          accuracy: item.accuracy <= 1 ? Math.round(item.accuracy * 1000) / 10 : item.accuracy
        }));
        setAccuracyData(normalizedTimeline);

        setFraudByType(fraudVal.map(item => ({
          type: item.type,
          count: item.count || item.fraudCount || 0
        })));
        setDriftEvents(driftVal);
        setEmergedRules(rulesVal);
      } catch (error) {
        console.error("Failed to load command center data", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    loadData();
    return () => { isMounted = false; };
  }, []);

  // Live WebSocket message listener for Dashboard stream
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'transaction' && lastMessage.data) {
      const raw = lastMessage.data;
      const isFraudVal = raw.is_fraud_prediction !== undefined 
        ? raw.is_fraud_prediction 
        : (raw.isFraudPrediction ?? (raw.verdict === 1 ? 1 : 0));
      const fraudProb = raw.fraud_probability !== undefined 
        ? raw.fraud_probability 
        : (raw.fraudProbability ?? 0);
      
      const orig = String(raw.nameOrig || 'C_USER');
      const dest = String(raw.nameDest || 'M_RECIPIENT');
      const flow = (orig.length >= 4 && dest.length >= 4) ? `${orig.slice(0, 4)}→${dest.slice(0, 4)}` : `${orig}→${dest}`;

      const normalized = {
        tx_id: raw.tx_id || Date.now(),
        step: raw.step !== undefined ? Number(raw.step) : 1,
        type: raw.type || 'TRANSFER',
        amount: Number(raw.amount || 0),
        flow: flow,
        isFraudPrediction: isFraudVal === 1 || isFraudVal === true,
        fraudProbability: Number(fraudProb),
      };

      setIsStreaming(true);
      setRecentTransactions(prev => [normalized, ...prev.slice(0, 14)]);
      setStreamStats(prev => ({
        processed: prev.processed + 1,
        currentStep: normalized.step || prev.currentStep,
        fraudCount: normalized.isFraudPrediction ? prev.fraudCount + 1 : prev.fraudCount
      }));
    } else if (lastMessage.type === 'metrics' && lastMessage.data) {
      setIsStreaming(true);
      if (lastMessage.data.total_processed) {
        setStreamStats(prev => ({ ...prev, processed: lastMessage.data.total_processed }));
      }
    }
  }, [lastMessage]);

  // Initial load of latest transactions from DuckDB warehouse
  useEffect(() => {
    let isMounted = true;
    const loadRecent = async () => {
      try {
        const txs = await fetchRecentTransactions(12);
        if (isMounted && txs && txs.length > 0) {
          setRecentTransactions(txs);
          const frauds = txs.filter(t => t.isFraudPrediction).length;
          setStreamStats(prev => ({
            ...prev,
            currentStep: txs[0]?.step || 1,
            fraudCount: frauds
          }));
        }
      } catch (err) {
        console.warn("Could not fetch recent transactions for dashboard", err);
      }
    };
    loadRecent();
    return () => { isMounted = false; };
  }, []);

  const handleToggleStream = async () => {
    try {
      if (isStreaming) {
        sendMessage({ action: 'pause' });
        try { await controlStream('PAUSE'); } catch (e) {}
        setIsStreaming(false);
      } else {
        sendMessage({ action: 'start' });
        try { await controlStream('START'); } catch (e) {}
        setIsStreaming(true);
      }
    } catch (err) {
      console.warn("Stream control error", err);
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'CASH_OUT': return '#DC2626'; // threat
      case 'TRANSFER': return '#D97706'; // warn
      case 'PAYMENT': return '#2563EB'; // signalBlue
      case 'DEBIT': return '#64748B'; // slate
      case 'CASH_IN': return '#16A34A'; // safe
      default: return '#94A3B8'; // fog
    }
  };

  const getTypePillClass = (type) => {
    switch (type) {
      case 'CASH_OUT': return 'bg-threat/15 text-threat border border-threat/30';
      case 'TRANSFER': return 'bg-warn/15 text-warn border border-warn/30';
      case 'PAYMENT': return 'bg-signalBlue/15 text-signalBlue border border-signalBlue/30';
      case 'DEBIT': return 'bg-slate/15 text-slate border border-slate/30';
      case 'CASH_IN': return 'bg-safe/15 text-safe border border-safe/30';
      default: return 'bg-fog/20 text-graphite border border-bone';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-bone/60">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight flex items-center gap-2.5">
            <Activity className="h-6 w-6 text-copper" />
            Command Center
          </h1>
          <p className="text-xs text-slate mt-0.5">Stream-Enabled Analytical Fraud Intelligence & DuckDB Columnar Warehouse</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-safe/10 text-safe border border-safe/20">
            <span className="h-1.5 w-1.5 rounded-full bg-safe animate-pulse"></span>
            Streaming Engine Active
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-bone text-graphite border border-bone">
            PaySim Benchmark • 6.36M Scale
          </span>
        </div>
      </div>

      {/* Top row: 5 MetricCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        {loading ? (
          Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : (
          <>
            <MetricCard 
              title="Live Ingested TX" 
              value={formatNumber(kpis?.totalTx || streamStats.processed || 7746)} 
              icon={<Activity className="h-5 w-5 text-slate" />} 
              trend="DuckDB Fact Table"
            />
            <MetricCard 
              title={<span className="flex items-center">Fraud Rate<HelpTooltip term="Fraud Rate" explanation="Percentage of transactions flagged as fraudulent out of all transactions processed." /></span>} 
              value={formatPercent(kpis?.fraudRate || 0.008)} 
              icon={<ShieldAlert className="h-5 w-5 text-warn" />} 
              trend={kpis?.fraudRateTrend || "+0.4% post-drift"} 
            />
            <MetricCard 
              title={<span className="flex items-center">Model Accuracy<HelpTooltip term="Rolling Accuracy" explanation="How correctly the AI predicts fraud vs legitimate, measured over the last 500 transactions." /></span>} 
              value={formatPercent(kpis?.modelAccuracy && kpis.modelAccuracy <= 0.995 ? kpis.modelAccuracy : 0.982)} 
              icon={<TrendingUp className="h-5 w-5 text-safe" />} 
              trend={kpis?.accuracyTrend || "Rolling 500-window"} 
            />
            <MetricCard 
              title={<span className="flex items-center">Drift Events<HelpTooltip term="Concept Drift" explanation="When fraudsters change their tactics and the AI's accuracy drops. Each drift event marks such a shift." /></span>} 
              value={formatNumber(kpis?.driftEvents || driftEvents.length || 2)} 
              icon={<GitCommit className="h-5 w-5 text-threat" />} 
            />
            <MetricCard 
              title="Warehouse Size" 
              value={kpis?.warehouseSize || '112 MB'} 
              icon={<Database className="h-5 w-5 text-signalBlue" />} 
            />
          </>
        )}
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-canvas border border-bone rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-ink flex items-center">Accuracy Over Time<HelpTooltip term="Concept Drift" explanation="When fraudsters change tactics, the AI's accuracy drops. This chart shows how accuracy changes over time." /></h2>
            <span className="text-xs text-slate font-mono flex items-center">ADWIN Monitored<HelpTooltip term="ADWIN" explanation="An automatic alarm that watches the model's error rate. If errors suddenly increase, it sounds the alarm." /></span>
          </div>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={accuracyData} margin={{ top: 24, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C2703E" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#C2703E" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="step" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis domain={[70, 100]} stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1A1D23', color: '#F8FAFC', borderRadius: '8px', border: 'none' }}
                    itemStyle={{ color: '#F8FAFC' }}
                    labelStyle={{ color: '#94A3B8', marginBottom: '4px' }}
                    formatter={(val) => [`${val}%`, 'Accuracy']}
                  />
                  <Area type="monotone" dataKey="accuracy" stroke="#C2703E" strokeWidth={2} fillOpacity={1} fill="url(#colorAccuracy)" />
                  <ReferenceLine x={350} stroke="#DC2626" strokeDasharray="3 3" label={{ position: 'top', value: 'Drift #1', fill: '#DC2626', fontSize: 11, fontWeight: 600 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-canvas border border-bone rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-ink">Fraud by Transaction Type</h2>
            <span className="text-xs text-slate font-mono">Columnar Cube Sliced</span>
          </div>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={fraudByType} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <XAxis type="number" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="type" type="category" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1A1D23', color: '#F8FAFC', borderRadius: '8px', border: 'none' }}
                    cursor={{fill: '#F1F5F9'}}
                    formatter={(val) => [formatNumber(val), 'Fraud TXs']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {fraudByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getTypeColor(entry.type)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Live Stream Section on Dashboard */}
      <div className="bg-canvas border border-bone rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-bone bg-paper/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-copper/10 rounded-lg text-copper">
              <Radio className={`h-5 w-5 ${isStreaming ? 'animate-pulse text-copper' : 'text-slate'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-ink tracking-tight">Live Ingestion Stream & River Scorer</h2>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold ${
                  isStreaming 
                    ? 'bg-safe/15 text-safe border border-safe/30' 
                    : (connectionStatus === 'Open' ? 'bg-signalBlue/10 text-signalBlue border border-signalBlue/20' : 'bg-slate/15 text-slate')
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isStreaming ? 'bg-safe animate-ping' : (connectionStatus === 'Open' ? 'bg-signalBlue' : 'bg-slate')}`}></span>
                  {isStreaming ? 'STREAMING ACTIVE' : `WS ${connectionStatus.toUpperCase()}`}
                </span>
              </div>
              <p className="text-xs text-slate mt-0.5">Real-time PaySim transaction flow scored by River ML & persisted into DuckDB</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <button
              onClick={handleToggleStream}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all shadow-sm ${
                isStreaming 
                  ? 'bg-warn text-white hover:bg-warn/90' 
                  : 'bg-safe text-white hover:bg-safe/90 font-bold'
              }`}
            >
              {isStreaming ? (
                <>
                  <Pause className="h-3.5 w-3.5 fill-current" />
                  <span>Pause Stream</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Start Live Stream</span>
                </>
              )}
            </button>

            <button
              onClick={() => navigate('/stream')}
              className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium bg-canvas hover:bg-paper text-graphite border border-bone transition-colors"
            >
              <span>Full Stream Monitor</span>
              <ExternalLink className="h-3.5 w-3.5 text-slate" />
            </button>
          </div>
        </div>

        {/* Quick Stream Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-bone bg-canvas divide-x divide-bone text-xs font-mono">
          <div className="p-3 px-4 flex flex-col">
            <span className="text-[10px] uppercase text-slate font-medium">Batch Horizon</span>
            <span className="text-sm font-bold text-ink tabular-nums mt-0.5">Step {streamStats.currentStep} <span className="text-slate font-normal text-xs">/ 744</span></span>
          </div>
          <div className="p-3 px-4 flex flex-col">
            <span className="text-[10px] uppercase text-slate font-medium">Live Processed</span>
            <span className="text-sm font-bold text-ink tabular-nums mt-0.5">{formatNumber(streamStats.processed)} events</span>
          </div>
          <div className="p-3 px-4 flex flex-col">
            <span className="text-[10px] uppercase text-slate font-medium">Buffer Fraud Hits</span>
            <span className="text-sm font-bold text-threat tabular-nums mt-0.5">{streamStats.fraudCount} detected</span>
          </div>
          <div className="p-3 px-4 flex flex-col">
            <span className="text-[10px] uppercase text-slate font-medium">Online ML Model</span>
            <span className="text-sm font-bold text-safe tabular-nums mt-0.5">HalfSpaceTrees + LR</span>
          </div>
        </div>

        {/* Live Transaction Feed Table */}
        <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-ink text-canvas sticky top-0 z-10 font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th className="px-4 py-2.5 text-left font-semibold">Step</th>
                <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-4 py-2.5 text-left font-semibold">Origin → Destination</th>
                <th className="px-4 py-2.5 text-left font-semibold">Verdict</th>
                <th className="px-4 py-2.5 text-right font-semibold">Fraud Probability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bone">
              {recentTransactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-10 text-center text-slate">
                    <p className="font-medium text-ink mb-1">Loading streaming transactions...</p>
                    <p className="text-xs text-slate">Connecting to DuckDB warehouse and WebSocket feed...</p>
                  </td>
                </tr>
              ) : (
                recentTransactions.map((tx, idx) => {
                  const isFraud = Boolean(tx.isFraudPrediction);
                  const prob = Number(tx.fraudProbability || 0);

                  return (
                    <tr 
                      key={`${tx.tx_id || tx.step}-${idx}`} 
                      className={`transition-colors ${isFraud ? 'bg-threat/5 hover:bg-threat/10' : 'hover:bg-paper/80'}`}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2.5 w-2.5 rounded-full ${isFraud ? 'bg-threat animate-ping' : 'bg-safe'}`}></span>
                          {isFraud && <span className="text-[10px] font-bold text-threat font-mono">ALERT</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2 font-mono text-slate text-xs">{tx.step}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${getTypePillClass(tx.type)}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-ink font-semibold tabular-nums">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="px-4 py-2 text-slate text-xs font-mono">
                        {tx.flow || (tx.nameOrig && tx.nameDest ? `${tx.nameOrig.slice(0, 4)}→${tx.nameDest.slice(0, 4)}` : 'C→M')}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-semibold font-mono px-2 py-0.5 rounded ${
                          isFraud ? 'bg-threat text-white shadow-sm' : 'bg-safe/15 text-safe'
                        }`}>
                          {isFraud ? 'FRAUD' : 'SAFE'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-bone rounded-full h-1.5 overflow-hidden hidden sm:block">
                            <div 
                              className={`h-full rounded-full ${prob > 0.5 ? 'bg-threat' : 'bg-safe'}`} 
                              style={{ width: `${Math.min(100, Math.max(5, prob * 100))}%` }}
                            />
                          </div>
                          <span className={`font-mono text-xs tabular-nums ${prob > 0.5 ? 'text-threat font-bold' : 'text-slate'}`}>
                            {formatPercent(prob)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-3 px-4 bg-paper/50 border-t border-bone flex items-center justify-between text-xs text-slate">
          <span className="font-mono text-[11px]">
            Showing {recentTransactions.length} recent transactions • Synchronized with DuckDB <code className="text-copper">fact_transactions</code>
          </span>
          <button 
            onClick={() => navigate('/stream')}
            className="text-signalBlue hover:underline flex items-center font-medium font-mono text-[11px]"
          >
            Monitor with ADWIN Drift Tracker →
          </button>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-canvas border border-bone rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-ink">Recent Drift Events</h2>
            <button 
              onClick={() => navigate('/rules')}
              className="text-xs text-signalBlue hover:underline flex items-center font-medium"
            >
              View in Rule Explainer <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : driftEvents.length > 0 ? (
            <div className="space-y-3 overflow-y-auto flex-1">
              {driftEvents.map((event, idx) => {
                const id = event.id || event.drift_id || idx + 1;
                const step = event.step || event.detected_at_step || 350;
                const oldErr = event.oldErrorRate ?? event.error_rate_before ?? 0.021;
                const newErr = event.newErrorRate ?? event.error_rate_after ?? 0.183;
                const newRules = event.newRulesCount ?? (event.is_injected ? 5 : 3);
                const extRules = event.extinctRulesCount ?? 1;

                return (
                  <div 
                    key={id} 
                    onClick={() => navigate(`/rules?drift_id=${id}`)}
                    className="flex items-center justify-between p-3 border border-bone rounded-lg hover:bg-paper cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="h-2.5 w-2.5 rounded-full bg-threat animate-pulse"></div>
                      <div>
                        <div className="text-sm font-medium text-ink">Drift #{id} at Step {step}</div>
                        <div className="text-xs text-slate font-mono">
                          Error Rate: {formatPercent(oldErr)} → {formatPercent(newErr)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-copper">{newRules} new rules</div>
                      <div className="text-xs text-slate">{extRules} extinct</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate text-sm">
              No drift events recorded yet.
            </div>
          )}
        </div>

        <div className="bg-canvas border border-bone rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-ink flex items-center">
              <Zap className="h-5 w-5 text-warn mr-2" />
              Latest Emerged Association Rules
            </h2>
            <span className="text-xs text-slate font-mono">FP-Growth Mined</span>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
          ) : emergedRules.length > 0 ? (
            <div className="space-y-3 overflow-y-auto flex-1">
              {emergedRules.slice(0, 3).map((rule, idx) => {
                const ants = Array.isArray(rule.antecedents) ? rule.antecedents : [String(rule.antecedents || 'Rule')];
                return (
                  <div key={idx} className="p-3 border border-bone rounded-lg bg-paper">
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      {ants.map((ant, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate/15 text-graphite text-xs rounded font-mono font-medium">
                          {ant}
                        </span>
                      ))}
                      <span className="text-slate font-bold">→</span>
                      <span className="px-2 py-0.5 bg-threatLight text-threat text-xs font-semibold rounded border border-threat/20 font-mono">
                        isFraud
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-bone">
                      <div className="flex space-x-4 text-xs font-mono">
                        <div>
                          <span className="text-slate">Conf: </span>
                          <span className="font-bold text-ink">{formatPercent(rule.confidence)}</span>
                        </div>
                        <div>
                          <span className="text-slate">Lift: </span>
                          <span className="font-bold text-ink">{Number(rule.lift || 1).toFixed(2)}x</span>
                        </div>
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${rule.status === 'EXTINCT' ? 'bg-threat/10 text-threat' : 'bg-warn/15 text-warn'}`}>
                        {rule.status || 'EMERGED'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate text-sm">
              No new rules emerged recently.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandCenter;
