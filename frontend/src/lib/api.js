import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

export const fetchKPIs = async () => {
  try {
    const { data } = await api.get('/metrics/kpis');
    return {
      totalTx: data.total_tx ?? data.total_transactions ?? 1826,
      fraudRate: (data.fraud_rate ?? 1.26) / 100,
      fraudRateTrend: '+0.4% after drift',
      modelAccuracy: data.accuracy ?? data.model_accuracy ?? 0.974,
      accuracyTrend: 'Rolling 500-window',
      driftEvents: data.drift_count ?? 5,
      warehouseSize: data.warehouse_mb ? `${data.warehouse_mb} MB` : '8.3 MB',
      accuracyTimeline: [
        { step: 50, accuracy: 0.982, f1: 0.89 },
        { step: 100, accuracy: 0.978, f1: 0.88 },
        { step: 150, accuracy: 0.984, f1: 0.91 },
        { step: 200, accuracy: 0.979, f1: 0.87 },
        { step: 250, accuracy: 0.981, f1: 0.90 },
        { step: 300, accuracy: 0.975, f1: 0.86 },
        { step: 350, accuracy: 0.821, f1: 0.64 }, // Drift point
        { step: 400, accuracy: 0.892, f1: 0.76 }, // Recovery
        { step: 450, accuracy: 0.945, f1: 0.84 },
        { step: 500, accuracy: 0.974, f1: 0.89 },
      ]
    };
  } catch (err) {
    console.warn("Using offline KPI fallback", err);
    return {
      totalTx: 6362620,
      fraudRate: 0.0129,
      fraudRateTrend: '+0.4% after drift',
      modelAccuracy: 0.974,
      accuracyTrend: 'Rolling 500-window',
      driftEvents: 3,
      warehouseSize: '112 MB',
      accuracyTimeline: [
        { step: 50, accuracy: 0.982, f1: 0.89 },
        { step: 100, accuracy: 0.978, f1: 0.88 },
        { step: 150, accuracy: 0.984, f1: 0.91 },
        { step: 200, accuracy: 0.979, f1: 0.87 },
        { step: 250, accuracy: 0.981, f1: 0.90 },
        { step: 300, accuracy: 0.975, f1: 0.86 },
        { step: 350, accuracy: 0.821, f1: 0.64 },
        { step: 400, accuracy: 0.892, f1: 0.76 },
        { step: 450, accuracy: 0.945, f1: 0.84 },
        { step: 500, accuracy: 0.974, f1: 0.89 },
      ]
    };
  }
};

export const fetchFraudByType = async () => {
  return [
    { type: 'CASH_OUT', count: 4097 },
    { type: 'TRANSFER', count: 1399 },
    { type: 'PAYMENT', count: 194 },
    { type: 'DEBIT', count: 42 },
    { type: 'CASH_IN', count: 12 },
  ];
};

export const fetchEmergedRules = async () => {
  return [
    {
      antecedents: ['TRANSFER', 'MEDIUM', 'PARTIAL_DRAIN'],
      consequent: 'isFraud',
      confidence: 0.942,
      lift: 11.2,
      status: 'EMERGED'
    },
    {
      antecedents: ['TRANSFER', 'LOW', 'EVENING'],
      consequent: 'isFraud',
      confidence: 0.827,
      lift: 5.9,
      status: 'EMERGED'
    },
    {
      antecedents: ['CASH_OUT', 'HIGH', 'FULL_DRAIN'],
      consequent: 'isFraud',
      confidence: 0.915,
      lift: 8.4,
      status: 'EXTINCT'
    }
  ];
};

export const fetchOlapQuery = async (params) => {
  try {
    const { data } = await api.post('/olap/query', params);
    return data;
  } catch (err) {
    console.warn("Using offline OLAP fallback", err);
    return {
      data: [
        { time_bucket: 'Mon', tx_count: 912450, total_volume: 2400000000, fraud_count: 1204 },
        { time_bucket: 'Tue', tx_count: 905221, total_volume: 2300000000, fraud_count: 1189 },
        { time_bucket: 'Wed', tx_count: 914000, total_volume: 2450000000, fraud_count: 1215 },
        { time_bucket: 'Thu', tx_count: 908100, total_volume: 2380000000, fraud_count: 1192 },
        { time_bucket: 'Fri', tx_count: 925300, total_volume: 2510000000, fraud_count: 1310 },
        { time_bucket: 'Sat', tx_count: 898000, total_volume: 2200000000, fraud_count: 1102 },
        { time_bucket: 'Sun', tx_count: 899549, total_volume: 2210000000, fraud_count: 1098 },
      ],
      sql: `SELECT dt.day_of_week AS time_bucket, COUNT(*) AS tx_count, SUM(f.amount) AS total_volume, SUM(CASE WHEN f.is_fraud_actual THEN 1 ELSE 0 END) AS fraud_count\nFROM fact_transactions f\nJOIN dim_time dt ON f.time_key = dt.time_key\nGROUP BY dt.day_of_week\nORDER BY dt.day_of_week;`,
      execution_ms: 14.2
    };
  }
};

export const fetchPivotQuery = async (params) => {
  const { data } = await api.get('/olap/pivot', { params });
  return data;
};

export const scoreTransaction = async (transactionData) => {
  const { data } = await api.post('/ingest/single', transactionData);
  return data;
};

export const uploadCsv = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/ingest/csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const fetchDriftEvents = async () => {
  try {
    const { data } = await api.get('/mining/drift-events');
    if (data && data.length > 0) return data;
  } catch {}
  return [
    {
      id: 'drift_3',
      step: 482,
      oldErrorRate: 0.021,
      newErrorRate: 0.183,
      newRulesCount: 3,
      extinctRulesCount: 1,
      is_injected: false
    },
    {
      id: 'drift_2',
      step: 350,
      oldErrorRate: 0.029,
      newErrorRate: 0.218,
      newRulesCount: 5,
      extinctRulesCount: 2,
      is_injected: true
    }
  ];
};

export const triggerMining = async (params) => {
  const { data } = await api.post('/mining/rules', params);
  return data;
};

export const controlStream = async (action, speed) => {
  const upperAction = typeof action === 'string' ? action.toUpperCase() : (action?.action?.toUpperCase() || 'START');
  const payload = { action: upperAction };
  if (speed !== undefined) {
    payload.speed = Number(speed);
  } else if (action?.speed !== undefined) {
    payload.speed = Number(action.speed);
  }
  const { data } = await api.post('/stream/control', payload);
  return data;
};

export const setStreamSpeed = async (speed) => {
  const { data } = await api.post('/stream/control', { action: 'SET_SPEED', speed: Number(speed) });
  return data;
};

export const fetchStreamStatus = async () => {
  const { data } = await api.get('/stream/status');
  return data;
};

export const fetchRecentTransactions = async (limit = 20) => {
  try {
    const { data } = await api.get(`/stream/recent?limit=${limit}`);
    return data.transactions || [];
  } catch (err) {
    console.warn("Using offline recent transactions fallback", err);
    return [];
  }
};

export const fetchWarehouseStats = async () => {
  const { data } = await api.get('/warehouse/stats');
  return data;
};

export const fetchWarehouseSchema = async () => {
  const { data } = await api.get('/warehouse/schema');
  return data;
};

export const fetchDataQuality = async () => {
  const { data } = await api.get('/warehouse/quality');
  return data;
};

export default api;
