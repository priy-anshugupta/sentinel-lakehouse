import React from 'react';

const PageShell = ({ title, children }) => {
  return (
    <div className="flex-1 overflow-auto h-full flex flex-col bg-paper relative">
      <div className="p-8 w-full max-w-7xl mx-auto flex-1 flex flex-col">
        {title && (
          <h1 className="text-2xl font-bold text-graphite mb-6 tracking-tight">
            {title}
          </h1>
        )}
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PageShell;
