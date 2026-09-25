import React from 'react';
import clsx from 'clsx';
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from 'lucide-react';

const MetricCard = ({ 
  title, 
  value, 
  delta, 
  deltaType = 'neutral', // 'up', 'down', 'neutral'
  trend,
  icon: Icon, 
  color = 'copper' // 'copper', 'safe', 'warn', 'threat', 'blue', 'slate'
}) => {
  const colorStyles = {
    copper: 'text-copper bg-copperLight',
    safe: 'text-safe bg-safe/10',
    warn: 'text-warn bg-warn/10',
    threat: 'text-threat bg-threatLight',
    blue: 'text-signalBlue bg-signalBlueLight',
    slate: 'text-slate bg-bone',
  };

  const deltaStyles = {
    up: 'text-safe',
    down: 'text-threat',
    neutral: 'text-fog',
  };

  const displayDelta = delta || trend;
  const DeltaIcon = deltaType === 'up' ? ArrowUpIcon : 
                    deltaType === 'down' ? ArrowDownIcon : MinusIcon;

  const renderIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) return Icon;
    if (typeof Icon === 'function' || typeof Icon === 'object') {
      const Comp = Icon;
      return <Comp className="w-5 h-5" />;
    }
    return null;
  };

  return (
    <div className="bg-canvas border border-bone rounded-xl shadow-sm p-4 sm:p-5 flex flex-col justify-between hover:border-slate/30 transition-all duration-200 group">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate group-hover:text-graphite transition-colors">
          {title}
        </h3>
        {Icon && (
          <div className={clsx('p-2 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105', colorStyles[color])}>
            {renderIcon()}
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl xl:text-3xl font-bold font-mono text-ink tracking-tight tabular-nums">
          {value}
        </div>
        {displayDelta && (
          <div className={clsx('flex items-center mt-2 text-xs font-medium font-mono tabular-nums', deltaStyles[deltaType])}>
            <DeltaIcon className="w-3.5 h-3.5 mr-1 shrink-0" />
            <span className="truncate">{displayDelta}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
