import React, { lazy, Suspense, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import { useRole } from './context/RoleContext';
const CommandCenter = lazy(() => import('./pages/CommandCenter'));
const OlapStudio = lazy(() => import('./pages/OlapStudio'));
const StreamMonitor = lazy(() => import('./pages/StreamMonitor'));
const RuleExplainer = lazy(() => import('./pages/RuleExplainer'));
const WarehouseAdmin = lazy(() => import('./pages/WarehouseAdmin'));
const IngestLab = lazy(() => import('./pages/IngestLab'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ReportBuilder = lazy(() => import('./pages/ReportBuilder'));
const Glossary = lazy(() => import('./pages/Glossary'));

const pages = [
  ['/', 'Overview', CommandCenter], ['/reports', 'Reports', ReportBuilder], ['/olap', 'Explore data', OlapStudio],
  ['/stream', 'Transaction monitor', StreamMonitor], ['/rules', 'Pattern analysis', RuleExplainer],
  ['/warehouse', 'Warehouse health', WarehouseAdmin], ['/ingest', 'Import data', IngestLab], ['/glossary', 'Terms & help', Glossary],
];
export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { checking, isLoggedIn, canAccess } = useRole();
  const location = useLocation();
  if (checking) return <div className="boot-screen">Opening Sentinel…</div>;
  if (!isLoggedIn) return <Suspense fallback={<div className="boot-screen">Opening sign in…</div>}><LoginPage/></Suspense>;
  const title = pages.find(([path])=>path===location.pathname)?.[1] || 'Overview';
  return <div className="app-layout"><Sidebar open={menuOpen} onClose={()=>setMenuOpen(false)}/><div className="app-main"><TopBar title={title} toggleSidebar={()=>setMenuOpen(true)}/><main className="app-content"><Suspense fallback={<div className="chart-placeholder">Loading workspace…</div>}><Routes>{pages.map(([path,,Component])=><Route key={path} path={path} element={canAccess(path)?<Component/>:<Navigate to="/" replace/>}/>) }<Route path="*" element={<Navigate to="/" replace/>}/></Routes></Suspense></main></div></div>;
}
