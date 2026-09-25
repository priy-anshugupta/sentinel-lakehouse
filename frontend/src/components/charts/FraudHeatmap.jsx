import React, { useState } from 'react';

export default function FraudHeatmap({ matrix, rowLabels, colLabels, measure }) {
  const [hoveredCell, setHoveredCell] = useState(null);

  if (!matrix || !matrix.length || !rowLabels || !colLabels) {
    return (
      <div className="h-64 flex items-center justify-center bg-bone rounded-lg text-slate border border-fog">
        No heatmap data available
      </div>
    );
  }

  // Find min and max for color scaling
  let min = Infinity;
  let max = -Infinity;
  
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      const val = matrix[r][c];
      if (val !== null && val !== undefined) {
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }
  }

  // Handle edge case where all values are the same
  if (min === max) {
    min = 0;
  }

  const getColor = (value) => {
    if (value === null || value === undefined) return '#F8FAFC'; // paper
    
    // Scale from 0 to 1
    const normalized = max > min ? (value - min) / (max - min) : 0;
    
    // RGB for paper (#F8FAFC): 248, 250, 252
    // RGB for copperDark (#8B4D2B): 139, 77, 43
    
    const r = Math.round(248 - (normalized * (248 - 139)));
    const g = Math.round(250 - (normalized * (250 - 77)));
    const b = Math.round(252 - (normalized * (252 - 43)));
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      if (value % 1 !== 0) return value.toFixed(2);
      return value.toLocaleString();
    }
    return value;
  };

  const getTextColor = (value) => {
    if (value === null || value === undefined) return '#94A3B8';
    const normalized = max > min ? (value - min) / (max - min) : 0;
    return normalized > 0.6 ? '#FFFFFF' : '#1A1D23';
  };

  return (
    <div className="w-full overflow-x-auto relative rounded-lg border border-graphite">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="bg-ink text-paper p-3 text-left font-semibold border-b border-r border-graphite whitespace-nowrap sticky left-0 z-10">
              {rowLabels.title || ''} \ {colLabels.title || ''}
            </th>
            {colLabels.values.map((col, cIdx) => (
              <th key={cIdx} className="bg-ink text-paper p-3 text-center font-semibold border-b border-graphite whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.values.map((row, rIdx) => (
            <tr key={rIdx}>
              <th className="bg-ink text-paper p-3 text-left font-medium border-b border-r border-graphite whitespace-nowrap sticky left-0 z-10">
                {row}
              </th>
              {matrix[rIdx].map((val, cIdx) => (
                <td 
                  key={cIdx} 
                  className="p-3 text-center border-b border-r border-fog transition-colors relative cursor-default"
                  style={{ 
                    backgroundColor: getColor(val),
                    color: getTextColor(val)
                  }}
                  onMouseEnter={() => setHoveredCell({ r: rIdx, c: cIdx })}
                  onMouseLeave={() => setHoveredCell(null)}
                >
                  <span className="font-mono">{formatValue(val)}</span>
                  
                  {hoveredCell && hoveredCell.r === rIdx && hoveredCell.c === cIdx && (
                    <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-ink text-paper text-xs p-2 rounded shadow-lg whitespace-nowrap pointer-events-none">
                      <div className="font-semibold text-copperLight mb-1">{row} &times; {colLabels.values[cIdx]}</div>
                      <div>{measure || 'Value'}: <span className="font-mono">{formatValue(val)}</span></div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink"></div>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
