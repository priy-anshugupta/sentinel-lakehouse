import React, { useState } from 'react';
import { Info } from 'lucide-react';

/**
 * HelpTooltip - Inline ⓘ icon that shows a plain-English explanation on hover.
 * Usage: <HelpTooltip term="Concept Drift" explanation="When fraudsters change tactics and the AI's accuracy drops." />
 */
export default function HelpTooltip({ term, explanation, className = '' }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="ml-1 p-0.5 rounded-full text-slate/60 hover:text-copper hover:bg-copper/10 transition-colors cursor-help"
        aria-label={`Help: ${term}`}
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      
      {isVisible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-ink text-canvas text-[11px] leading-relaxed rounded-lg px-3 py-2 shadow-xl border border-graphite/60 max-w-[260px] min-w-[180px] text-center">
            {term && (
              <div className="font-bold text-copper text-[10px] uppercase tracking-wider mb-0.5">{term}</div>
            )}
            <div className="text-paper/90 font-medium">{explanation}</div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-ink" />
          </div>
        </div>
      )}
    </span>
  );
}
