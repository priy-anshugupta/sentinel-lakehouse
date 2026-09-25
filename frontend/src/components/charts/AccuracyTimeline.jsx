import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-ink text-paper rounded-lg p-3 shadow-lg border border-graphite">
        <p className="font-mono text-sm mb-1">Step {label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value.toFixed(2)}%
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AccuracyTimeline({ data, driftPoints = [], height = 300 }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center bg-bone rounded-lg text-slate border border-fog">
        No accuracy data available
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#C2703E" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#C2703E" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorF1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563EB" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
          <XAxis 
            dataKey="step" 
            tick={{ fill: '#64748B', fontSize: 12 }} 
            axisLine={{ stroke: '#94A3B8' }}
            tickLine={false}
          />
          <YAxis 
            domain={[0, 100]} 
            tick={{ fill: '#64748B', fontSize: 12 }} 
            axisLine={{ stroke: '#94A3B8' }}
            tickLine={false}
            tickFormatter={(val) => `${val}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area 
            type="monotone" 
            dataKey="accuracy" 
            name="Accuracy"
            stroke="#C2703E" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorAccuracy)" 
            isAnimationActive={false}
          />
          <Area 
            type="monotone" 
            dataKey="f1" 
            name="F1 Score"
            stroke="#2563EB" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorF1)" 
            isAnimationActive={false}
          />
          
          {driftPoints.map((point, index) => (
            <ReferenceLine 
              key={index} 
              x={point.step} 
              stroke="#DC2626" 
              strokeDasharray="3 3"
              label={{ 
                position: 'insideTopLeft', 
                value: point.label || 'Drift', 
                fill: '#DC2626',
                fontSize: 12,
                fontWeight: 'bold'
              }} 
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
