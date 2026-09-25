import React from 'react';

const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-full w-full bg-canvas rounded-xl border border-bone border-dashed">
      {Icon && <Icon className="w-16 h-16 text-fog mb-4" strokeWidth={1.5} />}
      <h3 className="text-lg font-semibold text-graphite mb-2">{title}</h3>
      {description && <p className="text-sm text-slate max-w-sm mb-6">{description}</p>}
      {actionLabel && onAction && (
        <button 
          onClick={onAction}
          className="px-4 py-2 bg-copper text-canvas rounded-lg font-medium hover:bg-copperDark transition-colors shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
