import React from 'react';
import { Menu, Database, Shield, Radio, User } from 'lucide-react';
import StatusDot from '../shared/StatusDot';
import { useRole } from '../../context/RoleContext';

const TopBar = ({ toggleSidebar, title = 'Command Center' }) => {
  const { currentRole, user } = useRole();
  return (
    <header className="h-14 bg-canvas border-b border-bone flex items-center justify-between px-6 sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-3">
        <button 
          onClick={toggleSidebar}
          className="p-1.5 text-slate hover:bg-paper hover:text-ink rounded-lg md:hidden transition-colors"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate font-medium">
            <Shield className="w-3.5 h-3.5 text-copper" />
            <span className="font-mono uppercase tracking-wider text-[11px]">SENTINEL</span>
          </div>
          <span className="text-fog">/</span>
          <span className="font-semibold text-ink text-sm tracking-tight">{title}</span>
        </nav>
      </div>
      
      {/* Right Metadata & System Health */}
      <div className="flex items-center gap-4">
        {currentRole && (
          <div className="hidden md:flex items-center gap-2 bg-paper border border-bone px-3 py-1 rounded-full text-xs shadow-sm">
            <User className="w-3.5 h-3.5 text-copper" />
            <span className="font-medium text-[11px] text-ink">
              {user?.name || currentRole.title}
            </span>
            <span className="text-fog">•</span>
            <span className="text-[10px] text-copper font-semibold font-mono">
              {currentRole.icon} {currentRole.title}
            </span>
          </div>
        )}

        <div className="hidden md:flex items-center gap-2 bg-paper border border-bone px-2.5 py-1 rounded-full text-xs text-slate">
          <Database className="w-3.5 h-3.5 text-copper" />
          <span className="font-mono text-[11px] text-graphite font-medium">DuckDB Columnar</span>
          <span className="text-fog">•</span>
          <span className="font-mono text-[11px] text-graphite font-medium">River Hoeffding</span>
        </div>

        <div className="h-4 w-px bg-bone hidden sm:block"></div>

        <StatusDot status="online" label="System Live" />
      </div>
    </header>
  );
};

export default TopBar;
