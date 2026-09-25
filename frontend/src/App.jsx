import React, { useState } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import { ROUTES } from './lib/constants';
import { useRole } from './context/RoleContext';

// Pages
import CommandCenter from './pages/CommandCenter';
import OlapStudio from './pages/OlapStudio';
import StreamMonitor from './pages/StreamMonitor';
import RuleExplainer from './pages/RuleExplainer';
import WarehouseAdmin from './pages/WarehouseAdmin';
import IngestLab from './pages/IngestLab';
import LoginPage from './pages/LoginPage';
import ReportBuilder from './pages/ReportBuilder';
import Glossary from './pages/Glossary';

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const { isLoggedIn } = useRole();
  
  // If not logged in, show the login page
  if (!isLoggedIn && location.pathname !== '/login') {
    return <LoginPage />;
  }

  // Mapping paths to titles for TopBar breadcrumb
  const pageTitles = {
    [ROUTES.COMMAND_CENTER]: 'Command Center',
    [ROUTES.OLAP_STUDIO]: 'OLAP Studio',
    [ROUTES.STREAM_MONITOR]: 'Stream Monitor',
    [ROUTES.RULE_EXPLAINER]: 'Rule Explainer',
    [ROUTES.WAREHOUSE_ADMIN]: 'Warehouse Admin',
    [ROUTES.INGEST_LAB]: 'Ingest Lab',
    [ROUTES.REPORT_BUILDER]: 'Report Builder',
    [ROUTES.GLOSSARY]: 'Glossary & Help',
  };
  
  const currentTitle = pageTitles[location.pathname] || 'SENTINEL';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-paper font-sans">
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <TopBar 
          toggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} 
          title={currentTitle} 
        />
        <main className="flex-1 overflow-y-auto relative p-6 pb-24">
          <Routes>
            <Route path={ROUTES.COMMAND_CENTER} element={<CommandCenter />} />
            <Route path={ROUTES.OLAP_STUDIO} element={<OlapStudio />} />
            <Route path={ROUTES.STREAM_MONITOR} element={<StreamMonitor />} />
            <Route path={ROUTES.RULE_EXPLAINER} element={<RuleExplainer />} />
            <Route path={ROUTES.WAREHOUSE_ADMIN} element={<WarehouseAdmin />} />
            <Route path={ROUTES.INGEST_LAB} element={<IngestLab />} />
            <Route path={ROUTES.REPORT_BUILDER} element={<ReportBuilder />} />
            <Route path={ROUTES.GLOSSARY} element={<Glossary />} />
            <Route path={ROUTES.LOGIN} element={<Navigate to={ROUTES.COMMAND_CENTER} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
