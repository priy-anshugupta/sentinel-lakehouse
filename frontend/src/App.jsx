import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import { useRole } from './context/RoleContext';
import { fetchAlertChanges } from './lib/api';
import { alertForDrift, alertsForTransaction, previewAlert } from './lib/streamAlerts';
const CommandCenter = lazy(() => import('./pages/CommandCenter'));
const OlapStudio = lazy(() => import('./pages/OlapStudio'));
const StreamMonitor = lazy(() => import('./pages/StreamMonitor'));
const RuleExplainer = lazy(() => import('./pages/RuleExplainer'));
const WarehouseAdmin = lazy(() => import('./pages/WarehouseAdmin'));
const IngestLab = lazy(() => import('./pages/IngestLab'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ReportBuilder = lazy(() => import('./pages/ReportBuilder'));
const UserGuide = lazy(() => import('./pages/UserGuide'));
const Glossary = lazy(() => import('./pages/Glossary'));
const ModelLab = lazy(() => import('./pages/ModelLab'));
const DatasetExplorer = lazy(() => import('./pages/DatasetExplorer'));

const pages = [
  ['/', 'Overview', CommandCenter], ['/reports', 'Reports', ReportBuilder], ['/olap', 'Explore data', OlapStudio],
  ['/stream', 'Transaction monitor', StreamMonitor], ['/rules', 'Pattern analysis', RuleExplainer],
  ['/warehouse', 'Warehouse health', WarehouseAdmin], ['/ingest', 'Import data', IngestLab], ['/glossary', 'Terms & help', Glossary],
  ['/models', 'Model lab', ModelLab], ['/dataset', 'Dataset & warehouse', DatasetExplorer],
];
export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState(null);
  const seenAlerts = useRef(new Set());
  const lastToastAt = useRef(0);
  const { checking, isLoggedIn, canAccess, role } = useRole();
  const location = useLocation();
  const pushAlert = useCallback(alert => {
    if (seenAlerts.current.has(alert.id)) return;
    seenAlerts.current.add(alert.id);
    setAlerts(previous => [alert, ...previous].slice(0, 25));
    setUnread(previous => Math.min(previous + 1, 99));
    const now = Date.now();
    if (alert.demo || alert.kind === 'drift' || alert.kind === 'confirmed' || now - lastToastAt.current > 10000) {
      setToast(alert);
      lastToastAt.current = now;
    }
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (isLoggedIn) return;
    setAlerts([]); setUnread(0); setToast(null);
    seenAlerts.current.clear();
  }, [isLoggedIn]);
  useEffect(() => {
    if (!isLoggedIn) return;
    let active = true;
    let busy = false;
    let cursor = null;
    const poll = async () => {
      if (busy) return;
      busy = true;
      try {
        const result = await fetchAlertChanges(cursor);
        if (!active) return;
        cursor = { txId: result.next_tx_id, driftId: result.next_drift_id };
        result.transactions.forEach(tx => alertsForTransaction(tx).forEach(pushAlert));
        result.drift_events.forEach(event => { const alert = alertForDrift(event); if (alert) pushAlert(alert); });
      } catch (error) {
        // The next poll will retry; the other dashboards retain their own error states.
      } finally { busy = false; }
    };
    poll();
    const timer = setInterval(poll, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [isLoggedIn, pushAlert]);
  if (checking) return <div className="boot-screen">Opening Sentinel…</div>;
  if (!isLoggedIn) return <Suspense fallback={<div className="boot-screen">Opening sign in…</div>}><LoginPage/></Suspense>;
  const title = (role!=='DATA_ENGINEER'&&location.pathname==='/olap'?'Transaction trends':role!=='DATA_ENGINEER'&&location.pathname==='/glossary'?'Help & guidance':null) || pages.find(([path])=>path===location.pathname)?.[1] || 'Overview';
  return <div className="app-layout"><Sidebar open={menuOpen} onClose={()=>setMenuOpen(false)}/><div className="app-main"><TopBar title={title} toggleSidebar={()=>setMenuOpen(true)} alerts={alerts} unread={unread} toast={toast} onRead={()=>setUnread(0)} onClear={()=>{setAlerts([]);setUnread(0);}} onDismissToast={()=>setToast(null)} onPreview={kind=>pushAlert(previewAlert(kind))}/><main className="app-content"><Suspense fallback={<div className="chart-placeholder">Loading workspace…</div>}><Routes>{pages.map(([path,,Component])=><Route key={path} path={path} element={canAccess(path)?(path==='/glossary'&&role!=='DATA_ENGINEER'?<UserGuide/>:<Component {...(path==='/stream'?{onAlert:pushAlert}:{})}/>):<Navigate to="/" replace/>}/>) }<Route path="*" element={<Navigate to="/" replace/>}/></Routes></Suspense></main></div></div>;
}
