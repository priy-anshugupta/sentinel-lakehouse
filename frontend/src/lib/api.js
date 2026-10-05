import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 20000 });
let accessToken = null;
export const setAccessToken = token => { accessToken = token; };
api.interceptors.request.use(config => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});
api.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && error.config?.url !== '/auth/login' && error.config?.url !== '/auth/me') {
    window.dispatchEvent(new Event('sentinel:session-expired'));
  }
  return Promise.reject(error);
});
export const fetchOverview = async () => (await api.get('/metrics/overview')).data;
export const fetchLearning = async () => (await api.get('/learning/status')).data;
export const fetchDataset = async () => (await api.get('/learning/dataset')).data;
export const loadBundled = async () => (await api.post('/ingest/bundled',{}, {timeout:60000})).data;
export const trainModel = async params => (await api.post('/learning/train', params, {timeout:60000})).data;
export const clusterData = async params => (await api.post('/learning/cluster', params, {timeout:60000})).data;
export const mineAssociations = async params => (await api.post('/learning/rules', params, {timeout:60000})).data;
export const fetchKPIs = async () => {
  const { data } = await api.get('/metrics/kpis');
  return { totalTx: data.total_tx, fraudRate: data.fraud_rate / 100, modelAccuracy: data.accuracy || null,
    driftEvents: data.drift_count, warehouseSize: `${data.warehouse_mb} MB`, accuracyTimeline: [] };
};
export const fetchFraudByType = async () => (await fetchOverview()).by_type.map(x => ({ type: x.type, count: x.confirmed }));
export const fetchEmergedRules = async () => [];
export const fetchOlapQuery = async params => (await api.post('/olap/query', params)).data;
export const fetchPivotQuery = async params => (await api.get('/olap/pivot', { params })).data;
export const scoreTransaction = async transactionData => (await api.post('/ingest/single', transactionData)).data;
export const uploadCsv = async file => { const body = new FormData(); body.append('file', file); return (await api.post('/ingest/csv', body)).data; };
export const fetchDriftEvents = async () => (await api.get('/mining/drift-events')).data;
export const fetchAlertChanges = async cursor => (await api.get('/alerts/changes', { params: cursor ? { after_tx_id: cursor.txId, after_drift_id: cursor.driftId } : {} })).data;
export const triggerMining = async params => (await api.post('/mining/rules', params)).data;
export const controlStream = async (action, speed) => (await api.post('/stream/control', { action: typeof action === 'string' ? action.toUpperCase() : action.action, ...(speed !== undefined ? { speed } : {}) })).data;
export const setStreamSpeed = async speed => controlStream('SET_SPEED', speed);
export const fetchStreamStatus = async () => (await api.get('/stream/status')).data;
export const fetchRecentTransactions = async (limit = 20, flaggedOnly = false) => (await api.get('/stream/recent', { params: { limit, flagged_only: flaggedOnly } })).data.transactions;
export const fetchWarehouseStats = async () => (await api.get('/warehouse/stats')).data;
export const fetchWarehouseSchema = async () => (await api.get('/warehouse/schema')).data;
export const fetchDataQuality = async () => (await api.get('/warehouse/quality')).data;
export default api;
