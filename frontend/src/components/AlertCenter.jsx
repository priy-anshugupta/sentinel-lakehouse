import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CircleAlert, SearchCheck, ShieldAlert, X } from 'lucide-react';
import { useRole } from '../context/RoleContext';

const iconFor = kind => kind === 'drift' ? <SearchCheck size={17}/> : kind === 'confirmed' ? <ShieldAlert size={17}/> : <CircleAlert size={17}/>;

export default function AlertCenter({ alerts, unread, toast, onRead, onClear, onDismissToast, onPreview }) {
  const [open, setOpen] = useState(false);
  const centerRef = useRef(null);
  const { canAccess, role } = useRole();
  const detailLink = path => canAccess(path.split('?')[0]) ? path : '/';

  useEffect(() => {
    const outside = event => { if (centerRef.current && !centerRef.current.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);

  const toggle = () => {
    if (!open) onRead();
    setOpen(value => !value);
  };

  return <>
    <div className="alert-center" ref={centerRef}>
      <button className="alert-bell" onClick={toggle} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} title="Notifications">
        <Bell size={18}/>{unread > 0 && <span className="alert-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && <div className="alert-popover">
        <div className="alert-popover-head"><strong>Notifications</strong><button onClick={onClear} disabled={!alerts.length}>Clear</button></div>
        {alerts.length ? <div className="alert-list">{alerts.map(alert => <div className={`alert-entry ${alert.kind}`} key={alert.id}>
          <span className="alert-entry-icon">{iconFor(alert.kind)}</span>
          <div><div className="alert-entry-title"><strong>{alert.title}</strong>{alert.demo && <span>Preview</span>}</div><p>{alert.body}</p>{alert.link && <Link to={detailLink(alert.link)} onClick={() => setOpen(false)}>{detailLink(alert.link)===alert.link?'View details':'View overview'}</Link>}</div>
        </div>)}</div> : <p className="alert-empty">No new alerts in this session.</p>}
        {role==='DATA_ENGINEER'&&<div className="alert-popover-demo"><span>Preview without changing data</span><button onClick={() => { setOpen(false); onPreview('review'); }}>Review lead</button><button onClick={() => { setOpen(false); onPreview('drift'); }}>Model change</button></div>}
      </div>}
    </div>
    {toast && <div className={`alert-toast ${toast.kind}`} role="status" aria-live="polite">
      <span className="alert-entry-icon">{iconFor(toast.kind)}</span><div><div className="alert-entry-title"><strong>{toast.title}</strong>{toast.demo && <span>Preview</span>}</div><p>{toast.body}</p>{toast.link && <Link to={detailLink(toast.link)} onClick={onDismissToast}>{detailLink(toast.link)===toast.link?'View details':'View overview'}</Link>}</div>
      <button className="alert-toast-close" onClick={onDismissToast} aria-label="Dismiss notification"><X size={16}/></button>
    </div>}
  </>;
}
