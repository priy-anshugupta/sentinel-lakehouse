import React from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { 
  Activity, 
  Box, 
  Radio, 
  Network, 
  Database, 
  Upload,
  ChevronLeft,
  ChevronRight,
  Shield,
  FileText,
  BookOpen,
  Lock,
  LogOut
} from 'lucide-react';
import { ROUTES } from '../../lib/constants';
import { useRole } from '../../context/RoleContext';

const allNavItems = [
  { path: ROUTES.COMMAND_CENTER, label: 'Command Center', icon: Activity },
  { path: ROUTES.REPORT_BUILDER, label: 'Report Builder', icon: FileText },
  { path: ROUTES.STREAM_MONITOR, label: 'Stream Monitor', icon: Radio },
  { path: ROUTES.RULE_EXPLAINER, label: 'Rule Explainer', icon: Network },
  { path: ROUTES.OLAP_STUDIO, label: 'OLAP Studio', icon: Box },
  { path: ROUTES.WAREHOUSE_ADMIN, label: 'Warehouse Admin', icon: Database },
  { path: ROUTES.INGEST_LAB, label: 'Ingest Lab', icon: Upload },
  { path: ROUTES.GLOSSARY, label: 'Glossary & Help', icon: BookOpen },
];

const Sidebar = ({ collapsed, setCollapsed }) => {
  const { currentRole, user, canAccess, logout } = useRole();

  return (
    <div className={clsx(
      "bg-ink h-screen flex flex-col transition-all duration-300 relative z-20 flex-shrink-0",
      collapsed ? "w-16" : "w-60"
    )}>
      <div className="h-14 flex items-center justify-center border-b border-graphite/50 shrink-0">
        <div className="flex items-center gap-2 overflow-hidden px-4 w-full">
          <Shield className="w-6 h-6 text-copper shrink-0" />
          {!collapsed && (
            <div className="flex items-center gap-1.5">
              <span className="text-copper font-bold tracking-wider text-base">SENTINEL</span>
              <span className="text-[10px] font-mono text-fog font-medium px-1.5 py-0.2 rounded bg-graphite border border-graphite/80">v1.2</span>
            </div>
          )}
        </div>
      </div>

      {/* Role & Operator Badge */}
      {!collapsed && currentRole && (
        <div className="px-3 py-2.5 border-b border-graphite/50">
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-graphite/60 border border-graphite/80">
            <span className="text-lg shrink-0">{currentRole.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-paper truncate">{user?.name || currentRole.title}</div>
              <div className="text-[9px] font-mono text-copper font-semibold truncate">{currentRole.title}</div>
              <div className="text-[8px] text-fog/80 truncate">{user?.department || currentRole.subtitle}</div>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto overflow-x-hidden px-2">
        {allNavItems.map((item) => {
          const hasAccess = canAccess(item.path);
          
          if (!hasAccess) {
            // Show locked item
            return (
              <div
                key={item.path}
                className="flex items-center px-2 py-2.5 rounded-lg text-fog/30 cursor-not-allowed relative group"
                title={collapsed ? `${item.label} (Locked)` : undefined}
              >
                <div className="w-6 flex justify-center shrink-0">
                  <item.icon className="w-5 h-5" />
                </div>
                {!collapsed && (
                  <>
                    <span className="ml-3 font-medium text-xs whitespace-nowrap line-through decoration-fog/20">{item.label}</span>
                    <Lock className="w-3 h-3 ml-auto text-fog/30" />
                  </>
                )}
                {/* Tooltip on hover */}
                <div className="absolute left-full ml-2 px-2 py-1 bg-ink text-fog text-[10px] rounded shadow-lg hidden group-hover:block whitespace-nowrap z-50 border border-graphite">
                  Requires {item.path === ROUTES.OLAP_STUDIO || item.path === ROUTES.WAREHOUSE_ADMIN || item.path === ROUTES.INGEST_LAB ? 'Data Engineer' : 'Fraud Investigator'} role
                </div>
              </div>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => clsx(
                "flex items-center px-2 py-2.5 rounded-lg transition-colors group relative",
                isActive 
                  ? "bg-graphite text-copper" 
                  : "text-fog hover:bg-graphite hover:text-paper"
              )}
              title={collapsed ? item.label : undefined}
            >
              {({ isActive }) => (
                <>
                  <div className="w-6 flex justify-center shrink-0">
                    <item.icon className={clsx("w-5 h-5", isActive ? "text-copper" : "")} />
                  </div>
                  {!collapsed && (
                    <span className="ml-3 font-medium text-xs whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                  {isActive && !collapsed && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-copper rounded-r" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>

      <div className="p-3 border-t border-graphite/50">
        {!collapsed && (
          <>
            <div className="text-[10px] font-mono text-fog/70 px-1 mb-2.5 flex items-center justify-between">
              <span>DuckDB + River</span>
              <span className="text-safe flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-safe"></span>Engine Live</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full px-2 py-1.5 mb-2 text-fog/70 hover:text-threat hover:bg-threat/10 rounded-lg transition-colors text-xs"
            >
              <LogOut className="w-4 h-4" />
              <span className="font-medium">Sign Out</span>
            </button>
          </>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full p-2 text-fog hover:text-paper hover:bg-graphite rounded-lg transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
