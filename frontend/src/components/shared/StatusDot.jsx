import React from 'react';
import clsx from 'clsx';

const StatusDot = ({ status = 'offline', label }) => {
  const styles = {
    online: 'bg-safe',
    safe: 'bg-safe',
    offline: 'bg-fog',
    warning: 'bg-warn',
    warn: 'bg-warn',
    error: 'bg-threat',
    threat: 'bg-threat'
  };

  const isPulsing = status === 'online' || status === 'safe';

  return (
    <div className="flex items-center space-x-2">
      <div className="relative flex h-2.5 w-2.5">
        {isPulsing && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-safe opacity-75"></span>
        )}
        <span className={clsx('relative inline-flex rounded-full h-2.5 w-2.5', styles[status] || 'bg-fog')}></span>
      </div>
      {label && <span className="text-xs font-medium text-slate">{label}</span>}
    </div>
  );
};

export default StatusDot;
