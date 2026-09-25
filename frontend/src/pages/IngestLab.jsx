import React, { useState, useRef } from 'react';
import { Upload, ShieldAlert, Activity, CheckCircle2, AlertCircle, Play, ShieldCheck, Database, Zap, X } from 'lucide-react';
import { scoreTransaction, uploadCsv } from '../lib/api';
import { formatCurrency, formatPercent } from '../lib/formatters';

export default function IngestLab() {
  const [activeTab, setActiveTab] = useState('single');
  
  // Single Tx State
  const [txData, setTxData] = useState({
    type: 'PAYMENT',
    amount: '',
    oldbalanceOrg: '',
    newbalanceOrig: '',
    oldbalanceDest: '',
    newbalanceDest: '',
    isFraud: 'Unknown'
  });
  const [singleResult, setSingleResult] = useState(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState(null);

  // CSV Batch State
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const [csvError, setCsvError] = useState(null);

  const handleSingleScore = async (e) => {
    e.preventDefault();
    setSingleLoading(true);
    setSingleResult(null);
    setSingleError(null);

    try {
      const payload = {
        step: 100,
        type: txData.type,
        amount: parseFloat(txData.amount),
        oldbalanceOrg: parseFloat(txData.oldbalanceOrg),
        newbalanceOrig: parseFloat(txData.newbalanceOrig),
        oldbalanceDest: parseFloat(txData.oldbalanceDest),
        newbalanceDest: parseFloat(txData.newbalanceDest),
        isFraud: txData.isFraud === 'Fraud' ? 1 : txData.isFraud === 'Legit' ? 0 : null
      };
      
      const result = await scoreTransaction(payload);
      
      const prob = result.fraud_probability;
      setSingleResult({
        probability: prob,
        tx_id: result.tx_id,
        status: prob > 0.7 ? 'HIGH RISK' : prob > 0.3 ? 'MEDIUM RISK' : 'LOW RISK',
        color: prob > 0.7 ? 'bg-threat' : prob > 0.3 ? 'bg-warn' : 'bg-safe',
        model_info: 'Hoeffding Tree (Online)',
        drift_status: result.drift_detected ? 'DRIFT DETECTED' : 'No drift detected',
        latency: { 
          total: `${result.latency_ms}ms`, 
          inference: '~4ms', 
          features: '~2ms', 
          db: '~6ms' 
        }
      });
    } catch (err) {
      console.error(err);
      setSingleError(err.response?.data?.detail || 'Failed to score transaction');
    } finally {
      setSingleLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type === 'text/csv' || selected.name.endsWith('.csv')) {
        setFile(selected);
        setCsvError(null);
      } else {
        setCsvError('Please select a CSV file.');
        setFile(null);
      }
    }
  };

  const handleCsvUpload = async () => {
    if (!file) return;
    setCsvLoading(true);
    setCsvResult(null);
    setCsvError(null);
    
    try {
      const result = await uploadCsv(file);
      
      setCsvResult({
        parsed: result.total,
        validated: result.valid,
        rejected: result.rejected,
        scored: result.valid,
        loaded: result.valid,
        flagged: result.fraud_flagged,
        fraud_rate: result.valid > 0 ? ((result.fraud_flagged / result.valid) * 100).toFixed(2) : '0.00',
        drift_detected: result.drift_triggered > 0
      });
    } catch (err) {
      console.error(err);
      setCsvError(err.response?.data?.detail || 'Failed to process CSV');
    } finally {
      setCsvLoading(false);
    }
  };

  const PRESETS = [
    {
      label: '🚨 Transfer Account Drain (Fraud)',
      data: {
        type: 'TRANSFER',
        amount: '181924.00',
        oldbalanceOrg: '181924.00',
        newbalanceOrig: '0.00',
        oldbalanceDest: '0.00',
        newbalanceDest: '0.00',
        isFraud: 'Fraud'
      }
    },
    {
      label: '✅ Merchant Payment (Legit)',
      data: {
        type: 'PAYMENT',
        amount: '1864.28',
        oldbalanceOrg: '21249.00',
        newbalanceOrig: '19384.72',
        oldbalanceDest: '0.00',
        newbalanceDest: '0.00',
        isFraud: 'Legit'
      }
    },
    {
      label: '⚠️ Large Cash-Out',
      data: {
        type: 'CASH_OUT',
        amount: '229133.94',
        oldbalanceOrg: '15325.00',
        newbalanceOrig: '0.00',
        oldbalanceDest: '5083.00',
        newbalanceDest: '234216.94',
        isFraud: 'Fraud'
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-bone/60">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight flex items-center gap-2.5">
            <Zap className="h-6 w-6 text-copper" />
            Ingest Lab
          </h1>
          <p className="text-xs text-slate mt-0.5">Score single transactions or upload historical batches for online River inference</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-copper/10 text-copperDark border border-copper/20">
            Online Adaptive Learner
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-bone overflow-x-auto gap-2">
        <button 
          className={`px-4 py-2.5 font-semibold text-xs transition-all whitespace-nowrap flex items-center gap-2 border-b-2 ${
            activeTab === 'single' 
              ? 'text-copper border-copper font-bold' 
              : 'text-slate hover:text-ink border-transparent'
          }`}
          onClick={() => setActiveTab('single')}
        >
          Score Single Transaction
        </button>
        <button 
          className={`px-4 py-2.5 font-semibold text-xs transition-all whitespace-nowrap flex items-center gap-2 border-b-2 ${
            activeTab === 'csv' 
              ? 'text-copper border-copper font-bold' 
              : 'text-slate hover:text-ink border-transparent'
          }`}
          onClick={() => setActiveTab('csv')}
        >
          Upload CSV Batch
        </button>
      </div>

      {activeTab === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-canvas p-6 rounded-xl border border-bone shadow-sm">
            <div className="flex justify-between items-center mb-4 border-b border-bone pb-2">
              <h2 className="text-base font-bold text-ink">Transaction Details</h2>
              <span className="text-xs font-mono text-slate bg-paper px-2 py-0.5 rounded border border-bone">River Hoeffding Scorer</span>
            </div>

            {/* Quick Fill Presets */}
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-2">Demo Presets (1-Click Fill)</label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTxData(preset.data)}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-paper hover:bg-copper/10 hover:text-copper text-graphite border border-bone hover:border-copper/30 transition-colors font-medium shadow-sm"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {singleError && (
              <div className="mb-4 p-3 bg-threatLight border border-threat/20 rounded-lg text-threat text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                {singleError}
              </div>
            )}
            <form onSubmit={handleSingleScore} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-graphite mb-1">Transaction Type</label>
                <select 
                  className="w-full border border-bone rounded-lg px-3 py-2 bg-paper text-ink text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-copper"
                  value={txData.type}
                  onChange={(e) => setTxData({...txData, type: e.target.value})}
                  required
                >
                  <option value="PAYMENT">PAYMENT</option>
                  <option value="TRANSFER">TRANSFER</option>
                  <option value="CASH_OUT">CASH_OUT</option>
                  <option value="DEBIT">DEBIT</option>
                  <option value="CASH_IN">CASH_IN</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-graphite mb-1">Amount</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate font-mono text-xs">₹</span>
                  <input 
                    type="number" step="0.01" min="0" required
                    className="w-full border border-bone rounded-lg pl-7 pr-3 py-2 bg-paper text-ink text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-copper"
                    value={txData.amount}
                    onChange={(e) => setTxData({...txData, amount: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate mb-1">Sender Old Bal.</label>
                  <input 
                    type="number" step="0.01" required
                    className="w-full border border-bone rounded-lg px-3 py-2 bg-paper text-ink text-xs font-mono focus:outline-none focus:ring-1 focus:ring-copper"
                    value={txData.oldbalanceOrg}
                    onChange={(e) => setTxData({...txData, oldbalanceOrg: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate mb-1">Sender New Bal.</label>
                  <input 
                    type="number" step="0.01" required
                    className="w-full border border-bone rounded-lg px-3 py-2 bg-paper text-ink text-xs font-mono focus:outline-none focus:ring-1 focus:ring-copper"
                    value={txData.newbalanceOrig}
                    onChange={(e) => setTxData({...txData, newbalanceOrig: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate mb-1">Receiver Old Bal.</label>
                  <input 
                    type="number" step="0.01" required
                    className="w-full border border-bone rounded-lg px-3 py-2 bg-paper text-ink text-xs font-mono focus:outline-none focus:ring-1 focus:ring-copper"
                    value={txData.oldbalanceDest}
                    onChange={(e) => setTxData({...txData, oldbalanceDest: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate mb-1">Receiver New Bal.</label>
                  <input 
                    type="number" step="0.01" required
                    className="w-full border border-bone rounded-lg px-3 py-2 bg-paper text-ink text-xs font-mono focus:outline-none focus:ring-1 focus:ring-copper"
                    value={txData.newbalanceDest}
                    onChange={(e) => setTxData({...txData, newbalanceDest: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="block text-xs font-semibold text-graphite mb-1.5">Ground Truth (Optional)</label>
                <div className="flex gap-4 text-xs font-medium">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="gt" value="Fraud" checked={txData.isFraud === 'Fraud'} onChange={(e) => setTxData({...txData, isFraud: e.target.value})} className="accent-threat" />
                    <span className="text-threat font-semibold">Fraud</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="gt" value="Legit" checked={txData.isFraud === 'Legit'} onChange={(e) => setTxData({...txData, isFraud: e.target.value})} className="accent-safe" />
                    <span className="text-safe font-semibold">Legit</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="gt" value="Unknown" checked={txData.isFraud === 'Unknown'} onChange={(e) => setTxData({...txData, isFraud: e.target.value})} className="accent-slate" />
                    <span className="text-slate">Unknown</span>
                  </label>
                </div>
              </div>

              <button 
                type="submit"
                disabled={singleLoading}
                className="w-full mt-3 bg-copper hover:bg-copperDark text-canvas py-2.5 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {singleLoading ? <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> : <ShieldAlert size={16} />}
                Score Transaction
              </button>
            </form>
          </div>

          <div className="flex flex-col h-full">
            {singleResult ? (
              <div className="bg-canvas p-6 rounded-xl border border-bone shadow-sm flex-1 flex flex-col">
                <h2 className="text-base font-bold text-ink mb-4 border-b border-bone pb-2">Prediction Result</h2>
                
                <div className="flex flex-col items-center justify-center py-6 bg-paper rounded-xl border border-bone relative overflow-hidden mb-5">
                  <div className={`absolute top-0 left-0 w-full h-1.5 ${singleResult.color}`}></div>
                  <div className="text-slate text-xs uppercase tracking-wider font-semibold font-mono mb-2">Fraud Probability</div>
                  <div className="text-5xl font-mono font-bold text-ink tracking-tight mb-2 tabular-nums">
                    {(singleResult.probability * 100).toFixed(1)}<span className="text-2xl text-slate">%</span>
                  </div>
                  <div className={`px-3 py-0.5 rounded-full text-white text-xs font-bold font-mono tracking-wider ${singleResult.color}`}>
                    {singleResult.status}
                  </div>
                </div>

                <div className="space-y-2.5 text-xs flex-1">
                  <div className="flex justify-between py-2 border-b border-bone">
                    <span className="text-slate flex items-center gap-2"><Activity size={14} className="text-signalBlue"/> Model Used</span>
                    <span className="font-semibold text-ink font-mono">{singleResult.model_info}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-bone">
                    <span className="text-slate flex items-center gap-2"><Database size={14} className="text-copper"/> Warehouse ID</span>
                    <span className="font-mono font-semibold text-ink">tx_{singleResult.tx_id}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-bone">
                    <span className="text-slate flex items-center gap-2">
                      {singleResult.drift_status.includes('DRIFT') ? <AlertTriangle size={14} className="text-threat" /> : <CheckCircle2 size={14} className="text-safe"/>} ADWIN Status
                    </span>
                    <span className={`font-semibold font-mono ${singleResult.drift_status.includes('DRIFT') ? 'text-threat' : 'text-safe'}`}>{singleResult.drift_status}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-bone">
                    <span className="text-slate flex items-center gap-2"><Zap size={14} className="text-warn"/> Latency</span>
                    <span className="font-mono font-semibold text-ink tabular-nums">{singleResult.latency.total} total</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-canvas rounded-xl border-2 border-dashed border-bone flex-1 flex flex-col items-center justify-center p-8 text-center text-slate">
                <ShieldCheck size={40} className="mb-3 opacity-30 text-graphite" />
                <h3 className="text-base font-semibold text-ink mb-1">Awaiting Transaction</h3>
                <p className="max-w-xs text-xs text-slate">Fill out the transaction details and click Score to see online inference results.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'csv' && (
        <div className="space-y-6">
          <div 
            className="bg-canvas p-8 rounded-xl border-2 border-dashed border-bone hover:border-copper/50 text-center transition-colors cursor-pointer shadow-sm group" 
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
            />
            <div className="w-14 h-14 rounded-2xl bg-paper border border-bone flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
              <Upload size={24} className="text-copper" />
            </div>
            <h3 className="text-base font-bold text-ink mb-1">
              {file ? file.name : "Select or drag & drop a .csv file"}
            </h3>
            <p className="text-xs text-slate mb-4 font-mono">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : "Supports standard PaySim or transaction log exports"}
            </p>
            <div className="text-[11px] text-slate bg-paper inline-block px-3 py-1.5 rounded-lg border border-bone font-mono">
              <span className="font-bold text-graphite">Columns required:</span> step, type, amount, nameOrig, oldbalanceOrg, newbalanceOrig, nameDest, oldbalanceDest, newbalanceDest
            </div>
            
            {csvError && (
              <div className="mt-4 p-3 bg-threatLight border border-threat/20 rounded-lg text-threat text-xs flex items-center gap-2 justify-center">
                <AlertCircle size={15} />
                {csvError}
              </div>
            )}

            {file && (
              <div className="mt-5">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleCsvUpload(); }}
                  disabled={csvLoading}
                  className="bg-copper hover:bg-copperDark text-canvas px-6 py-2.5 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 mx-auto"
                >
                  {csvLoading ? (
                    <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  ) : (
                    <Play size={16} />
                  )}
                  Process Batch Stream
                </button>
              </div>
            )}
          </div>

          {csvResult && (
            <div className="bg-canvas p-6 rounded-xl border border-bone shadow-sm">
              <h3 className="text-base font-bold text-ink mb-4 flex items-center gap-2 border-b border-bone pb-2">
                <CheckCircle2 className="text-safe" size={18} />
                Batch Processing Ingestion Summary
              </h3>
              
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-safe flex-shrink-0" />
                  <span className="text-graphite"><span className="font-mono font-bold text-ink">{csvResult.parsed.toLocaleString()}</span> rows parsed from CSV payload</span>
                </div>
                <div className="flex items-center gap-2.5">
                  {csvResult.rejected > 0 ? <AlertCircle size={16} className="text-warn flex-shrink-0" /> : <CheckCircle2 size={16} className="text-safe flex-shrink-0" />}
                  <span className="text-graphite">
                    <span className="font-mono font-bold text-ink">{csvResult.validated.toLocaleString()}</span> rows validated 
                    {csvResult.rejected > 0 && <span className="text-warn font-semibold ml-1">({csvResult.rejected} rejected)</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-safe flex-shrink-0" />
                  <span className="text-graphite"><span className="font-mono font-bold text-ink">{csvResult.scored.toLocaleString()}</span> rows scored via River Hoeffding Tree</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-safe flex-shrink-0" />
                  <span className="text-graphite"><span className="font-mono font-bold text-ink">{csvResult.loaded.toLocaleString()}</span> rows appended to <code className="bg-paper border border-bone px-1.5 py-0.5 rounded font-mono text-signalBlue">fact_transactions</code></span>
                </div>
                <div className={`flex items-center gap-2.5 p-3 rounded-lg border ${
                  csvResult.drift_detected 
                    ? 'bg-warn/10 border-warn/25' 
                    : 'bg-threatLight border-threat/20'
                }`}>
                  {csvResult.drift_detected ? <AlertTriangle size={16} className="text-warn flex-shrink-0" /> : <ShieldAlert size={16} className="text-threat flex-shrink-0" />}
                  <span className="text-ink font-medium">
                    <span className={`font-mono font-bold ${csvResult.drift_detected ? 'text-warn' : 'text-threat'}`}>{csvResult.flagged.toLocaleString()}</span> flagged as FRAUD ({csvResult.fraud_rate}% fraud rate)
                    {csvResult.drift_detected && <span className="ml-2 text-xs font-mono text-warn font-bold">⚠ ADWIN Drift Triggered</span>}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}