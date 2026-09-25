export const CHART_THEME = {
  colors: {
    primary: '#C2703E', // copper
    secondary: '#2563EB', // signalBlue
    fraud: '#DC2626', // threat
    safe: '#16A34A', // safe
    grid: '#F1F5F9', // bone
    axis: '#94A3B8', // fog
    driftLine: '#DC2626', // threat
  },
  axis: {
    stroke: '#94A3B8',
    fontSize: 12,
    fontFamily: 'JetBrains Mono',
    tickLine: false,
    axisLine: false,
  },
  tooltip: {
    contentStyle: {
      backgroundColor: '#1A1D23', // ink
      color: '#F8FAFC', // paper
      borderRadius: '8px',
      border: 'none',
      fontFamily: 'Inter',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    },
    itemStyle: {
      color: '#F8FAFC',
    },
    cursor: {
      stroke: '#94A3B8',
      strokeWidth: 1,
      strokeDasharray: '4 4',
    }
  },
  animation: {
    duration: 500,
    easing: 'ease-out',
  }
};
