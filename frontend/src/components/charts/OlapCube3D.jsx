// OlapCube3D.jsx - Interactive 3D Multi-Dimensional OLAP Cube Engine
import React, { useState, useMemo, useRef } from 'react';
import { 
  RotateCw, Filter, Layers, Database, Eye, Compass, 
  ChevronRight, ArrowRightLeft, Sparkles, Check, Info, Maximize2,
  Code, ArrowUp, ArrowDown
} from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent } from '../../lib/formatters';

// OLAP Base Dimensions
const TIME_DIM_WEEKS = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
const TIME_DIM_FORTNIGHTS = ['Fortnight 1 (W1-W2: Pre-Drift)', 'Fortnight 2 (W3-W4: Post-Drift)'];
const TIME_DIM_MONTH = ['Month 1 (Full 4-Week Roll-Up)'];

const TYPE_DIM = ['TRANSFER', 'CASH_OUT', 'PAYMENT'];
const AMOUNT_DIM = ['Low (<50k)', 'Mid (50k-200k)', 'High (>200k)'];

// Generate base weekly cells (4 x 3 x 3 = 36 atomic cells)
const generateWeeklyBaseCells = () => {
  const cells = [];
  TIME_DIM_WEEKS.forEach((time, x) => {
    TYPE_DIM.forEach((type, y) => {
      AMOUNT_DIM.forEach((amount, z) => {
        // High amount Transfer & Cash-Out have highest fraud; post-drift is weeks 3 & 4 (x >= 2)
        const isHighRiskType = type === 'TRANSFER' || type === 'CASH_OUT';
        const isHighRiskAmount = z === 2; // High
        const isDriftPeriod = x >= 2;

        let fraud = 0;
        if (isHighRiskType && isHighRiskAmount) {
          fraud = isDriftPeriod && type === 'TRANSFER' ? Math.floor(24 + (x * 8)) : Math.floor(12 + (y * 4));
        } else if (isHighRiskType && z === 1) {
          fraud = isDriftPeriod ? Math.floor(8 + x * 3) : 2;
        }

        const baseCount = (z + 1) * 120 + (y + 1) * 80 + (x + 1) * 45;
        const volume = baseCount * (z === 0 ? 18000 : z === 1 ? 110000 : 450000);

        cells.push({
          id: `w-${x}-${y}-${z}`,
          x,
          y,
          z,
          time,
          type,
          amount,
          tx_count: baseCount,
          total_volume: volume,
          fraud_count: fraud,
          fraud_rate: fraud > 0 ? (fraud / baseCount) : 0
        });
      });
    });
  });
  return cells;
};

export default function OlapCube3D() {
  const [activeCubeOp, setActiveCubeOp] = useState('ALL'); // 'ALL' | 'SLICE' | 'DICE' | 'ROLLUP' | 'PIVOT'
  const [activeMeasure, setActiveMeasure] = useState('fraud_count'); // 'fraud_count' | 'total_volume' | 'tx_count'
  
  // 3D Orbit Angles
  const [rotX, setRotX] = useState(-25);
  const [rotY, setRotY] = useState(45);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, rotX: -25, rotY: 45 });

  // Slice Controls
  const [sliceDim, setSliceDim] = useState('TYPE'); // 'TIME' | 'TYPE' | 'AMOUNT'
  const [sliceIndex, setSliceIndex] = useState(0);

  // Dice Controls (Sub-cube bounding box)
  const [diceTimeRange, setDiceTimeRange] = useState([1, 3]); // Weeks 2 to 4
  const [diceTypes, setDiceTypes] = useState(['TRANSFER', 'CASH_OUT']);
  const [diceAmounts, setDiceAmounts] = useState(['Mid (50k-200k)', 'High (>200k)']);

  // Roll-Up / Drill-Down Granularity Level
  // 'WEEKS' (Granular Drill-Down 4x3x3) | 'FORTNIGHT' (Bi-Weekly 2x3x3) | 'MONTH' (Full Roll-Up 1x3x3)
  const [cubeGranularity, setCubeGranularity] = useState('WEEKS');
  
  // Pivot (Axis transposition)
  const [isPivoted, setIsPivoted] = useState(false);

  // Selected cell for detailed HUD inspection
  const [selectedCell, setSelectedCell] = useState(null);

  // Base raw weekly cells
  const baseWeeklyCells = useMemo(() => generateWeeklyBaseCells(), []);

  // Compute active cells dynamically based on Roll-Up granularity
  const aggregatedCells = useMemo(() => {
    // If Granular Drill-Down (WEEKS)
    if (activeCubeOp !== 'ROLLUP' || cubeGranularity === 'WEEKS') {
      return baseWeeklyCells.map(cell => ({
        ...cell,
        granularity: 'WEEKS',
        width: 42,
        posX: (cell.x - 1.5) * 56, // 42 size + 14 gap
        posY: (cell.y - 1.0) * 56,
        posZ: (cell.z - 1.0) * 56,
        timeLabel: cell.time
      }));
    }

    // If Bi-Weekly Fortnights (FORTNIGHT: 2 x 3 x 3 = 18 Macro-Blocks)
    if (cubeGranularity === 'FORTNIGHT') {
      const cells = [];
      [0, 1].forEach(fnIdx => {
        TYPE_DIM.forEach((type, y) => {
          AMOUNT_DIM.forEach((amount, z) => {
            const constituentWeeks = fnIdx === 0 ? [0, 1] : [2, 3];
            const matching = baseWeeklyCells.filter(c => constituentWeeks.includes(c.x) && c.y === y && c.z === z);
            
            const totalTx = matching.reduce((sum, c) => sum + c.tx_count, 0);
            const totalVol = matching.reduce((sum, c) => sum + c.total_volume, 0);
            const totalFraud = matching.reduce((sum, c) => sum + c.fraud_count, 0);

            cells.push({
              id: `fn-${fnIdx}-${y}-${z}`,
              x: fnIdx,
              y,
              z,
              granularity: 'FORTNIGHT',
              width: 98, // spans 2 voxels (42*2 + 14)
              posX: fnIdx === 0 ? -56 : 56,
              posY: (y - 1.0) * 56,
              posZ: (z - 1.0) * 56,
              timeLabel: TIME_DIM_FORTNIGHTS[fnIdx],
              time: TIME_DIM_FORTNIGHTS[fnIdx],
              type,
              amount,
              tx_count: totalTx,
              total_volume: totalVol,
              fraud_count: totalFraud,
              fraud_rate: totalTx > 0 ? (totalFraud / totalTx) : 0
            });
          });
        });
      });
      return cells;
    }

    // If Full Monthly Roll-Up (MONTH: 1 x 3 x 3 = 9 Consolidated Blocks)
    const cells = [];
    TYPE_DIM.forEach((type, y) => {
      AMOUNT_DIM.forEach((amount, z) => {
        const matching = baseWeeklyCells.filter(c => c.y === y && c.z === z);
        const totalTx = matching.reduce((sum, c) => sum + c.tx_count, 0);
        const totalVol = matching.reduce((sum, c) => sum + c.total_volume, 0);
        const totalFraud = matching.reduce((sum, c) => sum + c.fraud_count, 0);

        cells.push({
          id: `mo-0-${y}-${z}`,
          x: 0,
          y,
          z,
          granularity: 'MONTH',
          width: 210, // spans all 4 voxels (42*4 + 14*3)
          posX: 0,
          posY: (y - 1.0) * 56,
          posZ: (z - 1.0) * 56,
          timeLabel: TIME_DIM_MONTH[0],
          time: TIME_DIM_MONTH[0],
          type,
          amount,
          tx_count: totalTx,
          total_volume: totalVol,
          fraud_count: totalFraud,
          fraud_rate: totalTx > 0 ? (totalFraud / totalTx) : 0
        });
      });
    });
    return cells;
  }, [baseWeeklyCells, activeCubeOp, cubeGranularity]);

  // Filter and style cells based on active OLAP operation
  const processedCells = useMemo(() => {
    return aggregatedCells.map(cell => {
      let isVisible = true;
      let isHighlighted = false;
      let isPulledOut = false;

      if (activeCubeOp === 'SLICE') {
        const matchesSlice = 
          (sliceDim === 'TIME' && cell.x === sliceIndex) ||
          (sliceDim === 'TYPE' && cell.y === sliceIndex) ||
          (sliceDim === 'AMOUNT' && cell.z === sliceIndex);
        
        if (matchesSlice) {
          isHighlighted = true;
          isPulledOut = true;
        } else {
          isVisible = false; // dimmed in slice view
        }
      } else if (activeCubeOp === 'DICE') {
        const inTime = cell.x >= diceTimeRange[0] && cell.x <= diceTimeRange[1];
        const inType = diceTypes.includes(cell.type);
        const inAmount = diceAmounts.includes(cell.amount);

        if (inTime && inType && inAmount) {
          isHighlighted = true;
        } else {
          isVisible = false;
        }
      } else if (activeCubeOp === 'ROLLUP') {
        isHighlighted = true;
      }

      return {
        ...cell,
        isVisible,
        isHighlighted,
        isPulledOut
      };
    });
  }, [aggregatedCells, activeCubeOp, sliceDim, sliceIndex, diceTimeRange, diceTypes, diceAmounts]);

  // Handle 3D Mouse Drag Orbiting
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      rotX,
      rotY
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    
    // Clamp pitch between -70 and 20 degrees, wrap yaw
    const newRotX = Math.max(-70, Math.min(20, dragStartRef.current.rotX - deltaY * 0.4));
    const newRotY = (dragStartRef.current.rotY + deltaX * 0.5) % 360;
    
    setRotX(newRotX);
    setRotY(newRotY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Color shading based on active measure
  const getCellColor = (cell) => {
    if (activeMeasure === 'fraud_count') {
      if (cell.fraud_rate >= 0.08 || cell.fraud_count >= 25) {
        return { top: '#EF4444', front: '#DC2626', right: '#B91C1C', glow: 'rgba(220, 38, 38, 0.6)' };
      }
      if (cell.fraud_rate >= 0.02 || cell.fraud_count >= 6) {
        return { top: '#F97316', front: '#EA580C', right: '#C2410C', glow: 'rgba(249, 115, 22, 0.4)' };
      }
      return { top: '#38BDF8', front: '#0284C7', right: '#0369A1', glow: 'rgba(2, 132, 199, 0.2)' };
    }

    if (activeMeasure === 'total_volume') {
      if (cell.total_volume > 300000000) {
        return { top: '#F59E0B', front: '#D97706', right: '#B45309', glow: 'rgba(217, 119, 6, 0.4)' };
      }
      return { top: '#60A5FA', front: '#3B82F6', right: '#1D4ED8', glow: 'rgba(59, 130, 246, 0.2)' };
    }

    // Transaction Count
    return { top: '#A78BFA', front: '#8B5CF6', right: '#7C3AED', glow: 'rgba(139, 92, 246, 0.2)' };
  };

  // Quick Camera Presets
  const resetOrientation = (preset = 'isometric') => {
    if (preset === 'isometric') { setRotX(-25); setRotY(45); }
    else if (preset === 'front') { setRotX(0); setRotY(0); }
    else if (preset === 'top') { setRotX(-90); setRotY(0); }
    else if (preset === 'side') { setRotX(0); setRotY(90); }
  };

  // Dimensions
  const VOXEL_HEIGHT = 42;
  const VOXEL_DEPTH = 42;

  return (
    <div className="bg-canvas border border-bone rounded-xl shadow-sm overflow-hidden flex flex-col">
      {/* 3D OLAP Cube Header Controls */}
      <div className="p-4 border-b border-bone bg-paper flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-copper/10 text-copper rounded-lg border border-copper/20 shadow-sm">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              Multi-Dimensional 3D OLAP Cube Engine
              <span className="text-[10px] bg-copper text-canvas px-2 py-0.5 rounded font-mono font-bold">DuckDB Vectorized</span>
            </h3>
            <p className="text-xs text-slate">Star Schema Projection: Time × Transaction Type × Amount Tier</p>
          </div>
        </div>

        {/* 3D Operations Selector */}
        <div className="flex flex-wrap items-center gap-1.5 bg-bone/70 p-1 rounded-lg border border-bone">
          {[
            { id: 'ALL', label: 'Full Cube' },
            { id: 'ROLLUP', label: 'Roll-Up / Drill' },
            { id: 'SLICE', label: 'Slice Plane' },
            { id: 'DICE', label: 'Dice Sub-Cube' },
            { id: 'PIVOT', label: 'Pivot' }
          ].map(op => (
            <button
              key={op.id}
              onClick={() => {
                setActiveCubeOp(op.id);
                if (op.id === 'PIVOT') setIsPivoted(prev => !prev);
              }}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
                activeCubeOp === op.id 
                  ? 'bg-copper text-canvas shadow-sm font-bold' 
                  : 'text-slate hover:text-ink hover:bg-canvas'
              }`}
            >
              {op.label}
            </button>
          ))}
        </div>

        {/* Measure Selector */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate font-medium">Cell Metric:</span>
          <select
            value={activeMeasure}
            onChange={(e) => setActiveMeasure(e.target.value)}
            className="border border-bone rounded-md text-xs px-2.5 py-1.5 bg-canvas font-medium text-ink focus:outline-none focus:border-copper shadow-sm"
          >
            <option value="fraud_count">Fraud Concentration (!count)</option>
            <option value="total_volume">Total Volume (₹)</option>
            <option value="tx_count">Transaction Count</option>
          </select>
        </div>
      </div>

      {/* Main 3D Interactive Stage + Control Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 min-h-[490px]">
        {/* Left 3D Stage (Takes 3 columns) */}
        <div 
          className="lg:col-span-3 bg-ink p-6 relative flex items-center justify-center select-none overflow-hidden cursor-grab active:cursor-grabbing min-h-[450px]"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Subtle Grid Background Pattern */}
          <div 
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(#C2703E 1px, transparent 1px)`,
              backgroundSize: '24px 24px'
            }}
          />

          {/* Quick 3D Camera Angles */}
          <div className="absolute top-4 left-4 z-20 flex gap-1.5 bg-canvas/10 backdrop-blur-md p-1 rounded-lg border border-white/10 text-canvas text-xs">
            <button 
              onClick={() => resetOrientation('isometric')}
              className="px-2.5 py-1 rounded hover:bg-white/15 text-[11px] font-mono transition-colors"
            >
              Iso (3D)
            </button>
            <button 
              onClick={() => resetOrientation('top')}
              className="px-2.5 py-1 rounded hover:bg-white/15 text-[11px] font-mono transition-colors"
            >
              Top (Planar)
            </button>
            <button 
              onClick={() => resetOrientation('front')}
              className="px-2.5 py-1 rounded hover:bg-white/15 text-[11px] font-mono transition-colors"
            >
              Front
            </button>
            <button 
              onClick={() => resetOrientation('side')}
              className="px-2.5 py-1 rounded hover:bg-white/15 text-[11px] font-mono transition-colors"
            >
              Side
            </button>
          </div>

          {/* Current Hierarchy Mode Banner in 3D viewport */}
          <div className="absolute top-4 center z-20 bg-canvas/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/15 text-canvas text-[11px] font-mono font-medium flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-copper animate-pulse"></span>
            Hierarchy Level: <span className="font-bold text-copperLight">
              {cubeGranularity === 'MONTH' ? 'Month (Full Roll-Up)' : cubeGranularity === 'FORTNIGHT' ? 'Fortnights (Bi-Weekly Roll-Up)' : 'Weeks (Atomic Drill-Down)'}
            </span>
          </div>

          {/* Orbit hint */}
          <div className="absolute bottom-4 left-4 z-20 text-[11px] font-mono text-slate/70 flex items-center gap-1.5 pointer-events-none">
            <Compass className="h-3.5 w-3.5 text-copper" />
            Click & drag to rotate 3D cube ({rotX.toFixed(0)}°, {rotY.toFixed(0)}°)
          </div>

          {/* 3D Axis Orientation Badges */}
          <div className="absolute top-4 right-4 z-20 flex flex-col gap-1 text-[11px] font-mono text-right pointer-events-none">
            <span className="text-copper">X: {isPivoted ? 'Transaction Type' : 'Time Dimension'} &rarr;</span>
            <span className="text-signalBlue">Y: {isPivoted ? 'Time Dimension' : 'Transaction Type'} &darr;</span>
            <span className="text-threat">Z: Amount Tier &nearr;</span>
          </div>

          {/* 3D Transform Container */}
          <div 
            style={{
              perspective: '1200px',
              width: '320px',
              height: '320px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                transformStyle: 'preserve-3d',
                transform: `rotateX(${rotX}deg) rotateY(${rotY}deg) ${isPivoted ? 'rotateZ(90deg)' : ''}`,
                transition: isDragging ? 'none' : 'transform 0.4s ease-out'
              }}
            >
              {/* Render Voxels in 3D Space (36 weekly, 18 fortnight, or 9 monthly macro blocks) */}
              {processedCells.map(cell => {
                const colors = getCellColor(cell);
                const w = cell.width;
                const h = VOXEL_HEIGHT;
                const d = VOXEL_DEPTH;

                const posX = cell.posX;
                const posY = cell.posY;
                const posZ = cell.posZ + (cell.isPulledOut ? 60 : 0);

                const opacity = cell.isVisible ? 1 : 0.15;
                const isSelected = selectedCell?.id === cell.id;

                return (
                  <div
                    key={cell.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCell(cell);
                    }}
                    onMouseEnter={() => setSelectedCell(cell)}
                    style={{
                      position: 'absolute',
                      width: `${w}px`,
                      height: `${h}px`,
                      left: '50%',
                      top: '50%',
                      marginLeft: `-${w / 2}px`,
                      marginTop: `-${h / 2}px`,
                      transformStyle: 'preserve-3d',
                      transform: `translate3d(${posX}px, ${posY}px, ${posZ}px) scale(${cell.isHighlighted ? 1.04 : 1})`,
                      transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease',
                      cursor: 'pointer',
                      opacity
                    }}
                  >
                    {/* Front Face */}
                    <div
                      style={{
                        position: 'absolute',
                        width: `${w}px`,
                        height: `${h}px`,
                        backgroundColor: colors.front,
                        border: isSelected ? '2px solid #FFFFFF' : cell.isHighlighted ? '1.5px solid #FDBA74' : '1px solid rgba(255,255,255,0.2)',
                        transform: `translateZ(${d / 2}px)`,
                        boxShadow: cell.isHighlighted ? `0 0 16px ${colors.glow}` : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                        fontSize: w > 100 ? '11px' : '9px',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        userSelect: 'none'
                      }}
                    >
                      {activeMeasure === 'fraud_count' && cell.fraud_count > 0 ? (
                        <span>!{cell.fraud_count}</span>
                      ) : activeMeasure === 'total_volume' ? (
                        <span className="text-[9px]">{formatCurrency(cell.total_volume)}</span>
                      ) : null}
                    </div>

                    {/* Back Face */}
                    <div
                      style={{
                        position: 'absolute',
                        width: `${w}px`,
                        height: `${h}px`,
                        backgroundColor: colors.front,
                        border: '1px solid rgba(0,0,0,0.5)',
                        transform: `rotateY(180deg) translateZ(${d / 2}px)`
                      }}
                    />

                    {/* Top Face */}
                    <div
                      style={{
                        position: 'absolute',
                        width: `${w}px`,
                        height: `${d}px`,
                        left: '50%',
                        top: '50%',
                        marginLeft: `-${w / 2}px`,
                        marginTop: `-${d / 2}px`,
                        backgroundColor: colors.top,
                        border: isSelected ? '2px solid #FFFFFF' : cell.isHighlighted ? '1.5px solid #FDBA74' : '1px solid rgba(255,255,255,0.25)',
                        transform: `rotateX(90deg) translateZ(${h / 2}px)`
                      }}
                    />

                    {/* Bottom Face */}
                    <div
                      style={{
                        position: 'absolute',
                        width: `${w}px`,
                        height: `${d}px`,
                        left: '50%',
                        top: '50%',
                        marginLeft: `-${w / 2}px`,
                        marginTop: `-${d / 2}px`,
                        backgroundColor: colors.right,
                        transform: `rotateX(-90deg) translateZ(${h / 2}px)`
                      }}
                    />

                    {/* Right Face */}
                    <div
                      style={{
                        position: 'absolute',
                        width: `${d}px`,
                        height: `${h}px`,
                        left: '50%',
                        top: '50%',
                        marginLeft: `-${d / 2}px`,
                        marginTop: `-${h / 2}px`,
                        backgroundColor: colors.right,
                        border: isSelected ? '2px solid #FFFFFF' : cell.isHighlighted ? '1.5px solid #FDBA74' : '1px solid rgba(255,255,255,0.2)',
                        transform: `rotateY(90deg) translateZ(${w / 2}px)`
                      }}
                    />

                    {/* Left Face */}
                    <div
                      style={{
                        position: 'absolute',
                        width: `${d}px`,
                        height: `${h}px`,
                        left: '50%',
                        top: '50%',
                        marginLeft: `-${d / 2}px`,
                        marginTop: `-${h / 2}px`,
                        backgroundColor: colors.right,
                        border: isSelected ? '2px solid #FFFFFF' : cell.isHighlighted ? '1.5px solid #FDBA74' : '1px solid rgba(255,255,255,0.2)',
                        transform: `rotateY(-90deg) translateZ(${w / 2}px)`
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Operation Controls & Cell Inspector (1 column) */}
        <div className="bg-canvas p-5 border-t lg:border-t-0 lg:border-l border-bone flex flex-col justify-between space-y-4">
          <div>
            {/* Dynamic Controls based on selected 3D operation */}
            {activeCubeOp === 'ROLLUP' && (
              <div className="space-y-3.5">
                <div className="text-xs font-bold uppercase tracking-wider text-copper flex items-center gap-1.5">
                  <Database className="h-4 w-4" /> Hierarchy Roll-Up / Drill-Down
                </div>
                <p className="text-xs text-slate leading-relaxed">
                  Aggregate atomic week voxels into fused multi-week macro blocks (Roll-Up) or decompose into granular cells (Drill-Down).
                </p>
                
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setCubeGranularity('MONTH')}
                    className={`p-2.5 text-xs rounded-lg font-medium border text-left flex items-center justify-between transition-all ${
                      cubeGranularity === 'MONTH' 
                        ? 'bg-copper text-canvas font-bold border-copper shadow-sm' 
                        : 'bg-paper text-ink border-bone hover:border-slate/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ArrowUp className="h-4 w-4 shrink-0 text-copperLight" />
                      <div>
                        <div className="font-bold">Month Level (Full Roll-Up)</div>
                        <div className="text-[10px] opacity-80">1 × 3 × 3 = 9 Macro Slabs (All 4 Weeks Fused)</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setCubeGranularity('FORTNIGHT')}
                    className={`p-2.5 text-xs rounded-lg font-medium border text-left flex items-center justify-between transition-all ${
                      cubeGranularity === 'FORTNIGHT' 
                        ? 'bg-copper text-canvas font-bold border-copper shadow-sm' 
                        : 'bg-paper text-ink border-bone hover:border-slate/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 shrink-0 text-copperLight" />
                      <div>
                        <div className="font-bold">Bi-Weekly (Fortnight Roll-Up)</div>
                        <div className="text-[10px] opacity-80">2 × 3 × 3 = 18 Blocks (Pre vs Post Drift)</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setCubeGranularity('WEEKS')}
                    className={`p-2.5 text-xs rounded-lg font-medium border text-left flex items-center justify-between transition-all ${
                      cubeGranularity === 'WEEKS' 
                        ? 'bg-copper text-canvas font-bold border-copper shadow-sm' 
                        : 'bg-paper text-ink border-bone hover:border-slate/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ArrowDown className="h-4 w-4 shrink-0 text-copperLight" />
                      <div>
                        <div className="font-bold">Weekly (Atomic Drill-Down)</div>
                        <div className="text-[10px] opacity-80">4 × 3 × 3 = 36 Detailed Voxels</div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* SQL Expression for Roll-Up */}
                <div className="bg-paper p-3 rounded-lg border border-bone">
                  <div className="text-[11px] font-bold text-ink uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Code className="h-3.5 w-3.5 text-copper" /> DuckDB SQL Aggregation
                  </div>
                  <pre className="text-[10px] font-mono text-slate bg-canvas p-2 rounded border border-bone overflow-x-auto whitespace-pre">
{cubeGranularity === 'MONTH' 
  ? `-- Roll-Up to Month
SELECT 'Month 1' AS time_dim,
  type, amount_tier,
  COUNT(*) as tx_count,
  SUM(amount) as total_volume,
  SUM(is_fraud) as fraud_count
FROM fact_transactions
GROUP BY 1, 2, 3;`
  : cubeGranularity === 'FORTNIGHT'
  ? `-- Roll-Up to Fortnight
SELECT 
  CASE WHEN week <= 2 THEN 'FN1 (Pre)'
       ELSE 'FN2 (Post)' END AS time_dim,
  type, amount_tier,
  COUNT(*), SUM(amount), SUM(is_fraud)
FROM fact_transactions
GROUP BY 1, 2, 3;`
  : `-- Drill-Down to Weeks
SELECT strftime(timestamp, 'W%W') AS time_dim,
  type, amount_tier,
  COUNT(*), SUM(amount), SUM(is_fraud)
FROM fact_transactions
GROUP BY 1, 2, 3;`
}
                  </pre>
                </div>
              </div>
            )}

            {activeCubeOp === 'SLICE' && (
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-copper flex items-center gap-1.5">
                  <Layers className="h-4 w-4" /> Slice Plane Extractor
                </div>
                <p className="text-xs text-slate">Extract a 2D sub-matrix plane along one dimension (e.g. only TRANSFER or only High Amount).</p>
                
                <div>
                  <label className="text-xs font-semibold text-slate block mb-1">Slice Dimension</label>
                  <div className="grid grid-cols-3 gap-1">
                    {['TIME', 'TYPE', 'AMOUNT'].map(dim => (
                      <button
                        key={dim}
                        onClick={() => { setSliceDim(dim); setSliceIndex(0); }}
                        className={`py-1 text-xs font-medium rounded ${sliceDim === dim ? 'bg-copper text-canvas font-bold' : 'bg-paper text-slate hover:bg-bone'}`}
                      >
                        {dim}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate block mb-1">
                    Index ({sliceDim === 'TIME' ? TIME_DIM_WEEKS[sliceIndex] : sliceDim === 'TYPE' ? TYPE_DIM[sliceIndex] : AMOUNT_DIM[sliceIndex]})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={sliceDim === 'TIME' ? 3 : 2}
                    value={sliceIndex}
                    onChange={(e) => setSliceIndex(Number(e.target.value))}
                    className="w-full accent-copper"
                  />
                </div>
              </div>
            )}

            {activeCubeOp === 'DICE' && (
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-copper flex items-center gap-1.5">
                  <Filter className="h-4 w-4" /> Dice Sub-Cube Bounding Box
                </div>
                <p className="text-xs text-slate">Filter across multiple dimensions simultaneously to carve an isolated high-risk sub-cube.</p>
                
                <div>
                  <label className="text-xs font-semibold text-slate block mb-1">Time Horizon (Weeks)</label>
                  <div className="flex gap-1">
                    {TIME_DIM_WEEKS.map((t, idx) => {
                      const selected = idx >= diceTimeRange[0] && idx <= diceTimeRange[1];
                      return (
                        <button
                          key={t}
                          onClick={() => setDiceTimeRange([Math.min(idx, diceTimeRange[0]), Math.max(idx, diceTimeRange[1])])}
                          className={`flex-1 py-1 text-[11px] rounded ${selected ? 'bg-copper text-canvas font-bold' : 'bg-paper text-slate'}`}
                        >
                          W{idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate block mb-1">Transaction Types</label>
                  <div className="flex flex-wrap gap-1">
                    {TYPE_DIM.map(type => {
                      const sel = diceTypes.includes(type);
                      return (
                        <button
                          key={type}
                          onClick={() => {
                            if (sel) setDiceTypes(diceTypes.filter(t => t !== type));
                            else setDiceTypes([...diceTypes, type]);
                          }}
                          className={`px-2 py-0.5 text-xs rounded border ${sel ? 'bg-copperLight border-copper text-copperDark font-bold' : 'bg-canvas border-bone text-slate'}`}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeCubeOp === 'PIVOT' && (
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-copper flex items-center gap-1.5">
                  <ArrowRightLeft className="h-4 w-4" /> Axis Transposition (Pivot)
                </div>
                <p className="text-xs text-slate">Rotate the cube 90° to re-orient dimensional perspectives (swapping Time &harr; Type).</p>
                <button
                  onClick={() => setIsPivoted(!isPivoted)}
                  className="w-full py-2 bg-copper hover:bg-copperDark text-canvas rounded text-xs font-bold transition-colors shadow-sm"
                >
                  {isPivoted ? 'Restore Default Perspective' : 'Transpose Axes (90° Pivot)'}
                </button>
              </div>
            )}

            {activeCubeOp === 'ALL' && (
              <div className="space-y-2 text-xs text-slate">
                <div className="font-semibold text-ink">Cube Navigation Guide</div>
                <p>• <strong>Orbit</strong>: Click and drag anywhere in the 3D stage.</p>
                <p>• <strong>Inspect</strong>: Hover or click any voxel to inspect its exact metrics.</p>
                <p>• <strong>Roll-Up / Drill-Down</strong>: Switch to Roll-Up mode to physically fuse voxels into Month or Fortnight aggregates.</p>
              </div>
            )}
          </div>

          {/* Voxel Cell HUD Details */}
          <div className="bg-paper p-3.5 rounded-lg border border-bone shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate mb-2 flex items-center justify-between">
              <span>Voxel Inspector</span>
              {selectedCell && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedCell.fraud_count > 0 ? 'bg-threat/10 text-threat' : 'bg-safe/10 text-safe'}`}>
                  {selectedCell.fraud_count > 0 ? 'ALERT / HIGH RISK' : 'NORMAL'}
                </span>
              )}
            </div>

            {selectedCell ? (
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between font-mono">
                  <span className="text-slate">Time Horizon:</span>
                  <span className="font-bold text-ink truncate max-w-[170px]">{selectedCell.time}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate">Tx Type:</span>
                  <span className="font-bold text-copperDark">{selectedCell.type}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate">Amount Tier:</span>
                  <span className="text-copper font-medium">{selectedCell.amount}</span>
                </div>
                <div className="flex justify-between font-mono pt-1 border-t border-bone">
                  <span className="text-slate">Transactions:</span>
                  <span className="font-bold text-ink">{formatNumber(selectedCell.tx_count)}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate">Total Volume:</span>
                  <span className="font-bold text-ink">{formatCurrency(selectedCell.total_volume)}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate">Fraud Instances:</span>
                  <span className={`font-bold ${selectedCell.fraud_count > 0 ? 'text-threat' : 'text-slate'}`}>
                    {selectedCell.fraud_count} ({formatPercent(selectedCell.fraud_rate)})
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate py-4 text-center">
                Hover or click any 3D voxel to inspect dimensional aggregates.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
