const getWsUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || '127.0.0.1';
    const port = '8000';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${host}:${port}/ws/stream`;
  }
  return 'ws://127.0.0.1:8000/ws/stream';
};

export const WS_URL = getWsUrl();

export const ROUTES = {
  LOGIN: '/login',
  COMMAND_CENTER: '/',
  OLAP_STUDIO: '/olap',
  STREAM_MONITOR: '/stream',
  RULE_EXPLAINER: '/rules',
  WAREHOUSE_ADMIN: '/warehouse',
  INGEST_LAB: '/ingest',
  REPORT_BUILDER: '/reports',
  GLOSSARY: '/glossary',
};

export const TRANSACTION_TYPES = [
  'PAYMENT',
  'TRANSFER',
  'CASH_OUT',
  'DEBIT',
  'CASH_IN',
];

export const GRANULARITY_OPTIONS = [
  { value: 'minute', label: 'Minute' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
];
