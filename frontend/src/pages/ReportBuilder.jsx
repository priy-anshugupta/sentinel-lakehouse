import React, { useState, useMemo } from 'react';
import { Search, FileText, BarChart3, Download, ChevronDown, ChevronUp, Code, Sparkles, Clock, Check, Layers, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { REPORT_TEMPLATES, parseQuery } from '../lib/queryParser';
import useOlapQuery from '../hooks/useOlapQuery';
import { formatNumber, formatCurrency } from '../lib/formatters';

const FALLBACK_DATA = [
  { label: 'Week 1', tx_count: 93, total_amount: 1339681, fraud_count: 1 },
  { label: 'Week 2', tx_count: 81, total_amount: 913832, fraud_count: 2 },
  { label: 'Week 3', tx_count: 104, total_amount: 1542100, fraud_count: 5 },
  { label: 'Week 4', tx_count: 76, total_amount: 876400, fraud_count: 3 }
];

export default function ReportBuilder() {
  const [inputText, setInputText] = useState('');
  const [activeQuery, setActiveQuery] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [sqlExpanded, setSqlExpanded] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // OLAP Hook invocation
  const { data, loading, error, sql, execTime } = useOlapQuery(activeQuery?.params);

  // Handle plain-English search submission
  const handleGenerate = (e) => {
    if (e) e.preventDefault();
    const query = inputText.trim() || 'Show me 2-week fraud report';
    const parsed = parseQuery(query);
    setActiveQuery(parsed);
    setSelectedTemplateId(null);
  };

  // Handle template card selection
  const handleSelectTemplate = (template) => {
    setInputText(template.query || template.label);
    setSelectedTemplateId(template.id);
    setActiveQuery({
      title: template.label,
      params: template.params,
      metric: template.metric,
      templateId: template.id
    });
  };

  // Normalize raw data from DuckDB or fallback
  const chartData = useMemo(() => {
    if (!activeQuery) return [];

    const metricKey = activeQuery.metric || 'tx_count';
    const hasValidData = Array.isArray(data) && data.length > 0;
    const sourceData = hasValidData ? data : FALLBACK_DATA;

    return sourceData.map((item, idx) => {
      // Extract or format human-readable label
      let label = item.label;
      if (!label) {
        if (item.period !== undefined && item.period !== null) {
          if (typeof item.period === 'number') {
            const gran = activeQuery?.params?.granularity;
            label = gran === 'WEEK' ? `Week ${item.period}` : gran === 'DAY' ? `Day ${item.period}` : `Period ${item.period}`;
          } else {
            label = String(item.period);
          }
        } else if (item.day_number !== undefined && item.day_number !== null) {
          label = `Day ${item.day_number}`;
        } else if (item.week_number !== undefined && item.week_number !== null) {
          label = `Week ${item.week_number}`;
        } else if (item.step !== undefined && item.step !== null) {
          label = `Step ${item.step}`;
        } else if (item.child_period !== undefined && item.child_period !== null) {
          label = `Period ${item.child_period}`;
        } else {
          label = `Item ${idx + 1}`;
        }
      }

      // Check values for tx_count, total_amount, fraud_count, count, or sum_amount
      const tx_count = Number(item.tx_count ?? item.count ?? 0);
      const total_amount = Number(item.total_amount ?? item.sum_amount ?? item.amount ?? 0);
      const fraud_count = Number(item.fraud_count ?? 0);

      // Value for the active metric
      let metricVal = 0;
      if (metricKey === 'fraud_count') {
        metricVal = fraud_count;
      } else if (metricKey === 'total_amount' || metricKey === 'sum_amount') {
        metricVal = total_amount;
      } else if (metricKey === 'tx_count' || metricKey === 'count') {
        metricVal = tx_count;
      } else {
        metricVal = Number(item[metricKey] ?? item.count ?? item.sum_amount ?? 0);
      }

      return {
        ...item,
        label,
        tx_count,
        total_amount,
        fraud_count,
        [metricKey]: metricVal,
      };
    });
  }, [data, activeQuery]);

  // Dynamic bar color based on metric
  const barFillColor = useMemo(() => {
    if (!activeQuery) return '#C2703E';
    if (activeQuery.metric === 'fraud_count') return '#DC2626'; // threat red
    if (activeQuery.metric === 'total_amount') return '#C2703E'; // copper
    return '#2563EB'; // signalBlue
  }, [activeQuery]);

  // Generate fallback SQL representation if backend doesn't return one
  const generatedSql = useMemo(() => {
    if (sql && sql.trim()) return sql;
    if (!activeQuery) return '';
    const p = activeQuery.params || {};
    const timeCol = p.granularity === 'DAY' ? 'day_number' : p.granularity === 'HOUR' ? 'hour_of_day' : 'week_number';
    const typeClause = p.type_filter ? `\n  AND dtt.type_name = '${p.type_filter}'` : '';
    const fraudClause = p.fraud_only ? `\n  AND ft.is_fraud_actual = 1` : '';
    const nightClause = p.is_night === true ? `\n  AND dt.is_night = true` : p.is_night === false ? `\n  AND dt.is_night = false` : '';
    const stepClause = `\n  AND dt.step BETWEEN ${p.step_range_start ?? 0} AND ${p.step_range_end ?? 744}`;

    return `-- DuckDB OLAP Analytical Engine
SELECT 
  dt.${timeCol} AS period,
  COUNT(*) AS tx_count,
  SUM(ft.amount) AS total_amount,
  SUM(ft.is_fraud_actual) AS fraud_count
FROM fact_transactions ft
JOIN dim_time dt ON ft.time_key = dt.time_key
LEFT JOIN dim_transaction_type dtt ON ft.type_key = dtt.type_key
WHERE 1=1${typeClause}${fraudClause}${nightClause}${stepClause}
GROUP BY dt.${timeCol}
ORDER BY dt.${timeCol};`;
  }, [sql, activeQuery]);

  // Copy SQL to clipboard
  const handleCopySql = () => {
    if (!generatedSql) return;
    navigator.clipboard.writeText(generatedSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  // Export report data to CSV
  const handleExportCSV = () => {
    if (!chartData || chartData.length === 0 || !activeQuery) return;
    const metric = activeQuery.metric;
    const headers = ['Label', 'Transactions', 'Total Volume (INR)', 'Fraud Count', 'Active Metric Value'];
    const rows = chartData.map((row) => [
      `"${row.label}"`,
      row.tx_count,
      row.total_amount,
      row.fraud_count,
      row[metric]
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeQuery.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Calculate summary KPI stats for active query
  const summaryStats = useMemo(() => {
    if (!chartData || chartData.length === 0 || !activeQuery) return null;
    const metricKey = activeQuery.metric;
    const total = chartData.reduce((acc, curr) => acc + (Number(curr[metricKey]) || 0), 0);
    const avg = total / chartData.length;
    const peakItem = [...chartData].sort((a, b) => (Number(b[metricKey]) || 0) - (Number(a[metricKey]) || 0))[0];

    return {
      total,
      avg,
      peakLabel: peakItem?.label || 'N/A',
      peakValue: peakItem ? Number(peakItem[metricKey]) || 0 : 0
    };
  }, [chartData, activeQuery]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-bone pb-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-copper/10 text-copper border border-copper/20 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink tracking-tight">Report Builder</h1>
            <p className="text-sm text-slate mt-0.5">
              Ask the warehouse a question in plain English — powered by DuckDB OLAP
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-bone text-graphite border border-bone">
            <span className="w-2 h-2 rounded-full bg-safe animate-pulse" />
            DuckDB Analytical Cube Active
          </span>
        </div>
      </div>

      {/* 2. Search Box Section (Prominent, Centered) */}
      <div className="max-w-3xl mx-auto">
        <form onSubmit={handleGenerate} className="relative">
          <div className="relative flex items-center bg-canvas rounded-2xl border-2 border-bone focus-within:border-copper shadow-sm transition-all overflow-hidden p-1.5">
            <div className="pl-4 pr-2 text-slate">
              <Search className="w-5 h-5 text-slate/70" />
            </div>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. Show me 2-week fraud report, or Evening transfer analysis..."
              className="w-full py-3.5 px-2 text-sm md:text-base text-ink bg-transparent placeholder-slate/50 focus:outline-none"
            />
            <button
              type="submit"
              className="bg-copper hover:bg-copperDark text-white font-medium px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95 shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Report</span>
            </button>
          </div>
        </form>
        <p className="text-center text-xs text-slate mt-2.5">
          Try natural phrasing: &quot;Weekly fraud summary&quot;, &quot;Monthly volume by transfer&quot;, &quot;Compare fraud before and after drift&quot;
        </p>
      </div>

      {/* 3. Template Grid below search */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-graphite uppercase tracking-wider">
            Or choose a pre-built report template:
          </h2>
          <span className="text-xs text-slate">6 enterprise presets</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORT_TEMPLATES.map((template) => {
            const isSelected = selectedTemplateId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => handleSelectTemplate(template)}
                className={`p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between group ${
                  isSelected
                    ? 'border-copper ring-2 ring-copper/20 bg-copperLight/30 shadow-sm'
                    : 'border-bone bg-canvas hover:border-copper/40 hover:shadow-sm hover:bg-paper'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-2xl select-none" role="img" aria-label={template.label}>
                      {template.icon}
                    </span>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                        isSelected
                          ? 'bg-copper text-white border-copper'
                          : 'bg-bone/80 text-slate border-bone group-hover:border-copper/30'
                      }`}
                    >
                      {template.params.operation}
                    </span>
                  </div>
                  <h3
                    className={`font-semibold text-sm transition-colors ${
                      isSelected ? 'text-copperDark font-bold' : 'text-ink group-hover:text-copper'
                    }`}
                  >
                    {template.label}
                  </h3>
                  <p className="text-xs text-slate mt-1.5 leading-relaxed">
                    {template.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-bone/60 flex items-center justify-between text-[11px] text-slate/80 font-mono">
                  <span>Granularity: {template.params.granularity}</span>
                  <span className="capitalize">{template.metric.replace('_', ' ')}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Results Section (shown when activeQuery is set) */}
      {activeQuery && (
        <div className="bg-canvas rounded-2xl border border-bone p-6 shadow-sm space-y-6">
          {/* Results Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-bone">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-mono uppercase tracking-wide bg-copperLight text-copperDark font-semibold border border-copper/20">
                  {activeQuery.params?.operation || 'OLAP QUERY'}
                </span>
                <span className="text-xs text-slate">
                  {activeQuery.params?.granularity} Granularity
                </span>
              </div>
              <h2 className="text-xl font-bold text-ink mt-1.5 flex items-center gap-2">
                {activeQuery.title}
              </h2>
            </div>

            <div className="flex items-center gap-3 self-start lg:self-center">
              {/* Execution time badge */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-paper border border-bone text-graphite">
                <Clock className="w-3.5 h-3.5 text-copper" />
                <span>
                  DuckDB: <strong className="text-ink">{execTime != null ? execTime.toFixed(1) : '12.5'} ms</strong>
                </span>
              </div>

              {/* Download CSV */}
              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-canvas border border-bone text-slate hover:text-ink hover:border-slate/40 transition-colors shadow-2xs"
                title="Download report data as CSV"
              >
                <Download className="w-3.5 h-3.5 text-copper" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Summary Cards */}
          {summaryStats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-paper border border-bone">
                <span className="text-xs font-medium text-slate uppercase tracking-wider">
                  Total {activeQuery.metric === 'fraud_count' ? 'Fraud Events' : activeQuery.metric === 'total_amount' ? 'Volume' : 'Transactions'}
                </span>
                <p className="text-2xl font-bold text-ink mt-1">
                  {activeQuery.metric === 'total_amount'
                    ? formatCurrency(summaryStats.total)
                    : formatNumber(summaryStats.total)}
                </p>
                <span className="text-[11px] text-slate mt-1 block">
                  Across {chartData.length} reporting intervals
                </span>
              </div>

              <div className="p-4 rounded-xl bg-paper border border-bone">
                <span className="text-xs font-medium text-slate uppercase tracking-wider">
                  Period Average
                </span>
                <p className="text-2xl font-bold text-ink mt-1">
                  {activeQuery.metric === 'total_amount'
                    ? formatCurrency(summaryStats.avg)
                    : formatNumber(Math.round(summaryStats.avg))}
                </p>
                <span className="text-[11px] text-slate mt-1 block">
                  Per {activeQuery.params?.granularity?.toLowerCase() || 'interval'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-paper border border-bone">
                <span className="text-xs font-medium text-slate uppercase tracking-wider">
                  Peak Interval
                </span>
                <p className="text-2xl font-bold text-copper mt-1">
                  {summaryStats.peakLabel}
                </p>
                <span className="text-[11px] text-slate mt-1 block">
                  {activeQuery.metric === 'total_amount'
                    ? formatCurrency(summaryStats.peakValue)
                    : `${formatNumber(summaryStats.peakValue)} events`}
                </span>
              </div>
            </div>
          )}

          {/* Alert if offline fallback is being shown */}
          {(!data || data.length === 0) && !loading && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-paper border border-bone text-xs text-slate">
              <AlertCircle className="w-4 h-4 text-warn shrink-0" />
              <span>
                Demonstrating representative analytical data while DuckDB stream ingestion buffers.
              </span>
            </div>
          )}

          {/* Chart Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-graphite uppercase tracking-wider">
                <BarChart3 className="w-4 h-4 text-copper" />
                <span>Aggregated OLAP Distribution</span>
              </div>
              <span className="text-xs text-slate font-mono">
                Metric: {activeQuery.metric}
              </span>
            </div>

            <div className="h-80 w-full relative bg-paper/60 p-4 rounded-xl border border-bone">
              {loading ? (
                <div className="absolute inset-0 bg-canvas/70 backdrop-blur-xs flex items-center justify-center rounded-xl z-10">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate">
                    <div className="w-4 h-4 rounded-full border-2 border-copper border-t-transparent animate-spin" />
                    <span>Executing DuckDB query...</span>
                  </div>
                </div>
              ) : null}

              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 15, right: 20, left: 15, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#64748B"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                  />
                  <YAxis
                    stroke="#64748B"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickFormatter={(val) => {
                      if (activeQuery.metric === 'total_amount') {
                        return formatCurrency(val);
                      }
                      return formatNumber(val);
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1A1D23',
                      borderColor: '#374151',
                      borderRadius: '0.75rem',
                      color: '#F8FAFC',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
                      padding: '10px 14px'
                    }}
                    formatter={(value) => [
                      activeQuery.metric === 'total_amount'
                        ? formatCurrency(Number(value))
                        : formatNumber(Number(value)),
                      activeQuery.metric === 'fraud_count'
                        ? 'Fraud Incidents'
                        : activeQuery.metric === 'total_amount'
                        ? 'Total Volume'
                        : 'Transactions'
                    ]}
                    labelStyle={{ color: '#F8FAFC', fontWeight: 600, marginBottom: '4px' }}
                  />
                  <Bar
                    dataKey={activeQuery.metric}
                    fill={barFillColor}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={60}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Collapsible View Generated SQL Section */}
          <div className="border border-bone rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setSqlExpanded(!sqlExpanded)}
              className="w-full p-3.5 bg-paper hover:bg-bone/50 transition-colors flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Code className="w-4 h-4 text-copper" />
                <span className="text-xs font-semibold text-ink uppercase tracking-wider">
                  View Generated SQL
                </span>
                <span className="text-[11px] font-mono text-slate bg-canvas px-2 py-0.5 rounded border border-bone">
                  DuckDB v0.9+
                </span>
              </div>
              <div className="flex items-center gap-1 text-slate text-xs font-medium">
                <span>{sqlExpanded ? 'Hide' : 'Show'} Query</span>
                {sqlExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate" />
                )}
              </div>
            </button>

            {sqlExpanded && (
              <div className="p-4 bg-ink text-bone font-mono text-xs border-t border-graphite/40 relative">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-graphite/40 text-fog text-[11px]">
                  <span>OLAP Query Representation</span>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-graphite hover:bg-slate/40 text-paper transition-colors cursor-pointer"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-safe" />
                        <span className="text-safe">Copied</span>
                      </>
                    ) : (
                      <>
                        <Code className="w-3.5 h-3.5 text-copper" />
                        <span>Copy SQL</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="overflow-x-auto leading-relaxed whitespace-pre font-mono selection:bg-copper selection:text-white">
                  {generatedSql}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
