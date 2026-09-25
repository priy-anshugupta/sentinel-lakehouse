import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-ink text-paper rounded-lg p-3 shadow-lg border border-graphite z-50">
        <p className="font-semibold text-sm mb-2 pb-1 border-b border-graphite">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm my-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }}></div>
            <span className="text-slate">{entry.name}:</span>
            <span className="font-mono text-paper font-medium">
              {typeof entry.value === 'number' && entry.value % 1 !== 0 
                ? entry.value.toFixed(2) 
                : entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function OlapBarChart({ 
  data, 
  xKey, 
  bars = [], 
  stacked = false, 
  onBarClick = undefined,
  height = 300
}) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center bg-bone rounded-lg text-slate border border-fog">
        No data available
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
          onClick={onBarClick}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis 
            dataKey={xKey} 
            tick={{ fill: '#64748B', fontSize: 12 }} 
            axisLine={{ stroke: '#94A3B8' }}
            tickLine={false}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            tick={{ fill: '#64748B', fontSize: 12 }} 
            axisLine={{ stroke: '#94A3B8' }}
            tickLine={false}
            tickFormatter={(val) => {
              if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
              if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
              return val;
            }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC', opacity: 0.5 }} />
          <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '14px', color: '#64748B' }} />
          
          {bars.map((bar, index) => (
            <Bar 
              key={index}
              dataKey={bar.dataKey} 
              name={bar.name || bar.dataKey}
              fill={bar.color || '#C2703E'} 
              stackId={stacked ? "a" : undefined}
              radius={stacked ? (index === bars.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]) : [4, 4, 0, 0]}
              animationDuration={500}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
