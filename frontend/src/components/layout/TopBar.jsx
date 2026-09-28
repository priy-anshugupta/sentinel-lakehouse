import React from 'react';
import { Menu, ShieldCheck } from 'lucide-react';
import { useRole } from '../../context/RoleContext';
export default function TopBar({ toggleSidebar, title }) {
  const { currentRole } = useRole();
  return <header className="app-topbar"><div className="topbar-left"><button onClick={toggleSidebar} aria-label="Open navigation" className="menu-button"><Menu size={21}/></button><div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-separator">/</span><strong>{title}</strong></div></div><div className="topbar-right"><span className="environment-badge"><ShieldCheck size={15}/> Demo environment</span><span className="topbar-role">{currentRole?.title}</span></div></header>;
}
