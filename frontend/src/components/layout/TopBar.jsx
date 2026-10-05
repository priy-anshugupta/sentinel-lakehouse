import React from 'react';
import { Menu, ShieldCheck } from 'lucide-react';
import { useRole } from '../../context/RoleContext';
import AlertCenter from '../AlertCenter';
export default function TopBar({ toggleSidebar, title, alerts, unread, toast, onRead, onClear, onDismissToast, onPreview }) {
  const { currentRole, user } = useRole();
  return <header className="app-topbar"><div className="topbar-left"><button onClick={toggleSidebar} aria-label="Open navigation" className="menu-button"><Menu size={21}/></button><div className="breadcrumb"><span>{currentRole?.workspace}</span><span className="breadcrumb-separator">/</span><strong>{title}</strong></div></div><div className="topbar-right"><AlertCenter alerts={alerts} unread={unread} toast={toast} onRead={onRead} onClear={onClear} onDismissToast={onDismissToast} onPreview={onPreview}/><span className="environment-badge"><ShieldCheck size={15}/> Demo environment</span><div className="topbar-profile" title={currentRole?.description}><span>{user?.name?.[0]||'S'}</span><div><strong>{user?.name}</strong><small>{currentRole?.title}</small></div></div></div></header>;
}
