/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: '#1A1D23',
        graphite: '#2D3748',
        slate: '#64748B',
        fog: '#94A3B8',
        paper: '#F8FAFC',
        canvas: '#FFFFFF',
        bone: '#F1F5F9',
        copper: '#C2703E',
        copperLight: '#F4E8DD',
        copperDark: '#8B4D2B',
        safe: '#16A34A',
        warn: '#D97706',
        threat: '#DC2626',
        threatLight: '#FEF2F2',
        signalBlue: '#2563EB',
        signalBlueLight: '#EFF6FF',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
