import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, Zap, Activity, Radio } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import useStreamState from '../hooks/useStreamState';
import useWebSocket from '../hooks/useWebSocket';
import MetricCard from '../components/shared/MetricCard';
import StatusDot from '../components/shared/StatusDot';
import { formatPercent, formatNumber, formatCurrency } from '../lib/formatters';
import { fetchRecentTransactions } from '../lib/api';
import HelpTooltip from '../components/shared/HelpTooltip';

const StreamMonitor = () => {
  const { lastMessage, connectionStatus, sendMessage } = useWebSocket();
  const { 
    isRunning, speed, step, metrics, startStream, pauseStream, resetStream, updateSpeed, injectFraudShift, shiftInjected,
    updateFromWs, setCurrentStep, setMetrics
  } = useStreamState(sendMessage);
  
  const [timelineData, setTimelineData] = useState([
    { step: 50, accuracy: 98.2 },
    { step: 100, accuracy: 97.8 },
    { step: 150, accuracy: 98.4 },
    { step: 200, accuracy: 97.9 },
    { step: 250, accuracy: 98.1 },
    { step: 300, accuracy: 97.5 }
  ]);
  const [transactions, setTransactions] = useState([]);
  const [driftAlert, setDriftAlert] = useState(null);
  const [isHoveringTicker, setIsHoveringTicker] = useState(false);
  const tickerRef = useRef(null);

  // Auto-hydrate initial transactions from DuckDB warehouse
  useEffect(() => {
    let isMounted = true;
    const loadRecent = async () => {
      try {
        const recent = await fetchRecentTransactions(30);
        if (isMounted && recent && recent.length > 0) {
          setTransactions(prev => prev.length === 0 ? recent : prev);
          if (recent[0]?.step) {
            setCurrentStep(recent[0].step);
          }
        }
      } catch (err) {
        console.warn("Could not load initial stream transactions", err);
      }
    };
    loadRecent();
    return () => { isMounted = false; };
  }, [setCurrentStep]);

  // Process incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'metrics_update' || lastMessage.type === 'metrics') {
      const d = lastMessage.data || {};
      const acc = d.accuracy ? (d.accuracy <= 1 ? Math.round(d.accuracy * 1000) / 10 : d.accuracy) : 97.4;
      setTimelineData(prev => {
        const nextStep = d.total_processed || (prev.length ? prev[prev.length - 1].step + 20 : 320);
        const newData = [...prev, { ...d, accuracy: acc, step: nextStep }];
        return newData.length > 50 ? newData.slice(newData.length - 50) : newData;
      });
      updateFromWs({
        total_processed: d.total_processed,
        accuracy: (acc / 100),
        step: d.step
      });
    } else if (lastMessage.type === 'transaction') {
      if (lastMessage.data) {
        const raw = lastMessage.data;
        const isFraudVal = raw.is_fraud_prediction !== undefined ? raw.is_fraud_prediction : (raw.isFraudPrediction ?? (raw.verdict === 1 ? 1 : 0));
        const fraudProb = raw.fraud_probability !== undefined ? raw.fraud_probability : (raw.fraudProbability ?? 0);
        
        const normalizedTx = {
          ...raw,
          step: raw.step !== undefined ? Number(raw.step) : 0,
          amount: Number(raw.amount || 0),
          type: raw.type || 'TRANSFER',
          isFraudPrediction: isFraudVal === 1 || isFraudVal === true,
          fraudProbability: fraudProb,
          flow: (raw.nameOrig && raw.nameDest) ? `${raw.nameOrig.slice(0, 4)}→${raw.nameDest.slice(0, 4)}` : 'C→M'
        };

        if (normalizedTx.step) {
          setCurrentStep(normalizedTx.step);
        }

        if (!isHoveringTicker) {
          setTransactions(prev => [normalizedTx, ...prev.slice(0, 49)]);
        }

        setMetrics(prev => ({
          ...prev,
          processedCount: prev.processedCount + 1,
          errorCount: normalizedTx.isFraudPrediction && !raw.is_fraud_actual && raw.is_fraud_actual !== undefined
            ? prev.errorCount + 1 
            : prev.errorCount
        }));
      }
    } else if (lastMessage.type === 'drift_detected' || lastMessage.type === 'drift_alert') {
      setDriftAlert(lastMessage.data || { step: 350, oldError: 0.021, newError: 0.183 });
    }
  }, [lastMessage, isHoveringTicker, updateFromWs, setCurrentStep, setMetrics]);

  const handleInjectShift = () => {
    if (window.confirm("Are you sure you want to inject a sudden concept drift (fraud shift)? This will simulate an attacker changing tactics.")) {
      injectFraudShift();
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'CASH_OUT': return 'bg-threat text-white';
      case 'TRANSFER': return 'bg-warn text-white';
      case 'PAYMENT': return 'bg-signalBlue text-white';
      case 'DEBIT': return 'bg-slate text-white';
      case 'CASH_IN': return 'bg-safe text-white';
      default: return 'bg-fog text-white';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-bone/60">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight flex items-center gap-2.5">
            <Radio className="h-6 w-6 text-copper" />
            Live Stream Monitor
          </h1>
          <p className="text-xs text-slate mt-0.5">Real-time WebSocket event ingestion, online River scoring & ADWIN drift detector</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-canvas border border-bone px-3 py-1 rounded-full shadow-sm text-xs">
            <span className={`h-2 w-2 rounded-full ${connectionStatus === 'Open' ? 'bg-safe animate-pulse' : 'bg-threat'}`}></span>
            <span className="font-mono text-[11px] font-semibold text-graphite">WS {connectionStatus.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-canvas border border-bone rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4 flex-wrap gap-y-2">
          <div className="flex items-center space-x-1.5 bg-paper p-1 rounded-xl border border-bone">
            <button 
              onClick={startStream}
              disabled={isRunning}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all ${
                isRunning 
                  ? 'bg-safe text-white shadow-sm font-bold' 
                  : 'text-slate hover:text-ink hover:bg-canvas'
              }`}
              title="Start Streaming"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Stream</span>
            </button>
            <button 
              onClick={pauseStream}
              disabled={!isRunning}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all ${
                !isRunning && isRunning !== undefined
                  ? 'bg-warn text-white shadow-sm font-bold' 
                  : 'text-slate hover:text-ink hover:bg-canvas'
              }`}
              title="Pause Streaming"
            >
              <Pause className="h-4 w-4 fill-current" />
              <span>Pause</span>
            </button>
            <button 
              onClick={resetStream}
              className="p-1.5 text-slate hover:text-ink hover:bg-canvas rounded-lg transition-colors"
              title="Reset Stream Horizon"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
          
          <div className="h-8 w-px bg-bone hidden sm:block"></div>
          
          <div className="flex flex-col min-w-[200px]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate">Stream Pace</label>
              <span className="text-xs font-mono font-bold text-copper tabular-nums">{speed} ms/tick</span>
            </div>
            <input 
              type="range" 
              min="10" 
              max="1000" 
              step="10"
              value={speed} 
              onChange={(e) => updateSpeed(Number(e.target.value))}
              className="w-full accent-copper h-1.5"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleInjectShift}
            disabled={shiftInjected}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center transition-all ${
              shiftInjected 
                ? 'bg-safe/10 text-safe border border-safe/30 cursor-default' 
                : 'bg-warn hover:bg-warn/90 text-white shadow-sm hover:shadow active:scale-95'
            }`}
          >
            <Activity className="h-4 w-4 mr-1.5" />
            {shiftInjected ? 'Shift Injected ✓' : 'Inject Fraud Shift'}
          </button>
          <div className="bg-ink text-canvas px-3.5 py-2 rounded-lg font-mono text-xs font-semibold shadow-inner border border-graphite tabular-nums flex items-center">
            Step {step} <span className="text-fog ml-1">/ 744</span>
            <HelpTooltip term="Step" explanation="1 Step = 1 Hour of bank time. 744 steps = 31 days total." />
          </div>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard 
          title={<span className="flex items-center">Current Accuracy<HelpTooltip term="Prequential Accuracy" explanation="Model predicts first, evaluates, then learns. Measures real-time correctness." /></span>} 
          value={formatPercent(metrics?.accuracy || 0)} 
        />
        <MetricCard 
          title={<span className="flex items-center">F1-Score<HelpTooltip term="F1-Score" explanation="Combined measure of precision and recall. Balances catching fraud without false alarms." /></span>} 
          value={formatPercent(metrics?.f1Score || 0)} 
        />
        <MetricCard 
          title={<span className="flex items-center">Processed (Live)<HelpTooltip term="Streaming Data" explanation="Number of transaction events ingested through WebSocket in real-time." /></span>} 
          value={formatNumber(metrics?.processedCount || 0)} 
        />
        <MetricCard 
          title={<span className="flex items-center">Model Errors<HelpTooltip term="Error Rate" explanation="Number of times model misclassified a transaction. Watched closely by ADWIN." /></span>} 
          value={formatNumber(metrics?.errorCount || 0)} 
        />
      </div>

      {/* Drift Alert Banner */}
      {driftAlert && (
        <div className="bg-threatLight border-l-4 border-threat rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm animate-in slide-in-from-bottom-2">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-6 w-6 text-threat flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-threat font-semibold">Concept Drift Detected</h3>
              <p className="text-sm text-threat/80 mt-1">
                ADWIN triggered at Step <span className="font-mono">{driftAlert.step}</span>. 
                Error rate changed: <span className="font-mono">{formatPercent(driftAlert.oldError)} → {formatPercent(driftAlert.newError)}</span>
              </p>
              <div className="mt-2 w-full bg-threat/20 rounded-full h-1.5 overflow-hidden">
                <div className="bg-threat h-1.5 rounded-full animate-pulse" style={{width: '100%'}}></div>
              </div>
              <p className="text-xs text-threat/70 mt-1 flex items-center">
                <Zap className="h-3 w-3 mr-1" /> Mining new FP-Growth rules...
              </p>
            </div>
          </div>
          <div className="mt-4 sm:mt-0 flex sm:flex-col space-x-3 sm:space-x-0 sm:space-y-2">
            <a href={`/rules?drift_id=${driftAlert.id}`} className="text-sm font-medium text-threat hover:underline bg-white/50 px-3 py-1.5 rounded-md text-center">
              View Rule Diff →
            </a>
            <button onClick={() => setDriftAlert(null)} className="text-sm text-slate hover:text-ink">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Chart Area */}
      <div className="bg-canvas border border-bone rounded-xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-ink">Live Accuracy Timeline</h2>
          {isRunning && <StatusDot status="safe" label="LIVE" />}
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData} margin={{ top: 24, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C2703E" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#C2703E" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="step" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={val => `${val}%`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1A1D23', color: '#F8FAFC', borderRadius: '8px', border: 'none' }}
              />
              <Area type="monotone" dataKey="accuracy" stroke="#C2703E" fillOpacity={1} fill="url(#colorAcc)" isAnimationActive={false} />
              {driftAlert && (
                <ReferenceLine x={driftAlert.step} stroke="#DC2626" strokeDasharray="3 3" label={{ position: 'top', value: 'Drift Detected', fill: '#DC2626', fontSize: 11, fontWeight: 600 }} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live Transaction Ticker */}
      <div className="bg-canvas border border-bone rounded-xl shadow-sm overflow-hidden flex flex-col h-[400px]">
        <div className="p-4 border-b border-bone flex justify-between items-center bg-paper">
          <h2 className="text-sm font-bold text-ink uppercase tracking-wider flex items-center gap-2">
            Live Transaction Feed
            {isHoveringTicker && <span className="text-[10px] bg-warn/20 text-warn px-2 py-0.5 rounded-full font-mono">Paused on hover</span>}
          </h2>
          <span className="text-xs font-mono text-slate">Showing latest {transactions.length} events</span>
        </div>
        
        <div 
          className="flex-1 overflow-y-auto"
          onMouseEnter={() => setIsHoveringTicker(true)}
          onMouseLeave={() => setIsHoveringTicker(false)}
          ref={tickerRef}
        >
          <table className="min-w-full text-xs">
            <thead className="bg-ink text-canvas sticky top-0 z-10 font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th className="px-4 py-2.5 text-left font-semibold">Step</th>
                <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                <th className="px-4 py-2.5 text-left font-semibold">Flow</th>
                <th className="px-4 py-2.5 text-left font-semibold">Verdict</th>
                <th className="px-4 py-2.5 text-right font-semibold">Prob</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bone">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-slate">
                    <p className="font-medium text-ink mb-1">No live stream activity yet</p>
                    <p className="text-xs text-slate">Click the <span className="font-semibold text-safe">Play (▶)</span> button in the control bar to stream live transactions from the simulator.</p>
                  </td>
                </tr>
              ) : (
                transactions.map((tx, i) => {
                  const isFraud = Boolean(tx.isFraudPrediction);
                  const prob = Number(tx.fraudProbability || 0);

                  return (
                    <tr key={`${tx.step}-${i}`} className={`transition-colors ${isFraud ? 'bg-threat/5 hover:bg-threat/10' : 'hover:bg-bone/40'}`}>
                      <td className="px-4 py-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${isFraud ? 'bg-threat animate-ping' : 'bg-safe'}`}></div>
                      </td>
                      <td className="px-4 py-2 font-mono text-slate text-xs">{tx.step}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${getTypeColor(tx.type)}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-ink font-medium">{formatCurrency(tx.amount)}</td>
                      <td className="px-4 py-2 text-slate text-xs font-mono">{tx.flow || 'C→M'}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isFraud ? 'bg-threat text-white' : 'bg-safe/15 text-safe'}`}>
                          {isFraud ? 'FRAUD' : 'SAFE'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs">
                        <span className={prob > 0.5 ? 'text-threat font-bold' : 'text-slate'}>
                          {formatPercent(prob)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StreamMonitor;
