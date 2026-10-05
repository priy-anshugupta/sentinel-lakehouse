import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BarChart3, BookOpen, Database, FileText, LayoutDashboard, LogOut, Radio, SearchCheck, ShieldCheck, UploadCloud, X, GitBranch, Layers } from 'lucide-react';
import { useRole } from '../../context/RoleContext';

const groups = [
  { label: 'WORKSPACE', items: [['/', 'Overview', LayoutDashboard], ['/reports', 'Reports', FileText], ['/olap', 'Explore data', BarChart3]] },
  { label: 'INVESTIGATE', items: [['/stream', 'Transaction monitor', Radio], ['/rules', 'Pattern analysis', SearchCheck]] },
  { label: 'DATA & MINING', items: [['/dataset', 'Dataset & warehouse', Layers], ['/models', 'Model lab', GitBranch]] },
  { label: 'DATA OPERATIONS', items: [['/warehouse', 'Warehouse health', Database], ['/ingest', 'Import data', UploadCloud]] },
  { label: 'SUPPORT', items: [['/glossary', 'Terms & help', BookOpen]] },
];
export default function Sidebar({ open, onClose }) {
  const { currentRole, user, canAccess, logout, role } = useRole();
  const navigate = useNavigate();
  const orderedGroups = role === 'DATA_ENGINEER' ? [groups[3],groups[2],groups[0],groups[1],groups[4]] : groups;
  const labels = role === 'DATA_ENGINEER' ? {} : {'Explore data':'Transaction trends','Terms & help':'Help & guidance'};
  return <><div className={`sidebar-backdrop ${open?'visible':''}`} onClick={onClose}/><aside className={`app-sidebar ${open?'open':''}`}>
    <div className="sidebar-brand"><span className="brand-mark"><ShieldCheck size={23}/></span><span className="brand-name">SENTINEL<small>Risk intelligence</small></span><button className="sidebar-close" onClick={onClose} aria-label="Close navigation"><X size={19}/></button></div>
    <div className="workspace-identity"><span className="workspace-dot"/><div><strong>{currentRole?.workspace}</strong><small>{currentRole?.description}</small></div></div><div className="sidebar-scroll">{orderedGroups.map(group => { const available = group.items.filter(([path])=>canAccess(path)); return available.length ? <div className="nav-group" key={group.label}><div className="nav-label">{group.label==='WORKSPACE'?'INSIGHTS':group.label}</div>{available.map(([path,label,Icon])=><NavLink key={path} to={path} end={path==='/'} onClick={onClose} className={({isActive})=>`nav-item ${isActive?'active':''}`}><Icon size={18}/><span>{labels[label]||label}</span></NavLink>)}</div> : null; })}</div>
    <div className="sidebar-account"><div className="account-avatar">{user?.name?.[0] || 'S'}</div><div className="account-copy"><strong>{user?.name}</strong><span>{currentRole?.title}</span></div><button title="Sign out" aria-label="Sign out" onClick={()=>{logout();navigate('/login')}}><LogOut size={18}/></button></div>
  </aside></>;
}
