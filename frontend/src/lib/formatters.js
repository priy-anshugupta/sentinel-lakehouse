export const formatCurrency = (amount) => {
  if (amount == null) return '';
  if (amount >= 1e9) {
    return `₹${(amount / 1e9).toFixed(1)}B`;
  }
  if (amount >= 1e6) {
    return `₹${(amount / 1e6).toFixed(1)}M`;
  }
  if (amount >= 1e3) {
    return `₹${(amount / 1e3).toFixed(1)}K`;
  }
  return `₹${amount.toFixed(2)}`;
};

export const formatNumber = (num) => {
  if (num == null) return '';
  return new Intl.NumberFormat('en-IN').format(num);
};

export const formatPercent = (decimal) => {
  if (decimal == null) return '';
  return `${(decimal * 100).toFixed(1)}%`;
};

export const formatDuration = (ms) => {
  if (ms == null) return '';
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
};

export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
