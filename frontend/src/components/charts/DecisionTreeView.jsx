import React, { useMemo, useState } from 'react';

export default function DecisionTreeView({ tree }) {
  const [levels, setLevels] = useState(3);
  const [selected, setSelected] = useState(null);
  const layout = useMemo(() => {
    let leaf = 0;
    const nodes = [], edges = [];
    function place(node, depth = 0) {
      const terminal = node.leaf || depth >= levels - 1;
      const item = { ...node, y: depth * 120 + 50, terminal };
      if (terminal) item.x = leaf++ * 210 + 110;
      else {
        const left = place(node.left, depth + 1), right = place(node.right, depth + 1);
        item.x = (left.x + right.x) / 2;
        edges.push({ from: item, to: left, label: 'Yes' }, { from: item, to: right, label: 'No' });
      }
      nodes.push(item);
      return item;
    }
    place(tree);
    return { nodes, edges, width: Math.max(430, leaf * 210), height: levels * 120 + 35 };
  }, [tree, levels]);
  return <><div className="tree-toolbar"><span>Follow “Yes” when a value is at or below the split.</span><label>Visible levels <select value={levels} onChange={e => setLevels(Number(e.target.value))}><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option></select></label></div>
    <div className="tree-scroll"><svg width={layout.width} height={layout.height} role="img" aria-label="Trained decision tree; branches show feature thresholds and leaf predictions">
      {layout.edges.map((e, i) => <g key={i}><path d={`M ${e.from.x} ${e.from.y+36} C ${e.from.x} ${e.from.y+70},${e.to.x} ${e.to.y-60},${e.to.x} ${e.to.y-36}`} stroke="#a1bfc0" strokeWidth={1.5} fill="none"/><text x={(e.from.x+e.to.x)/2} y={(e.from.y+e.to.y)/2+3} textAnchor="middle" fill="#54736f" fontSize={11}>{e.label}</text></g>)}
      {layout.nodes.map(n => <g key={n.id} tabIndex={0} role="button" aria-label={`Node ${n.id}: ${n.leaf ? n.prediction?'Flagged':'Not flagged' : `${n.feature} at most ${n.threshold}`}`} onClick={() => setSelected(n)} onKeyDown={e => {if(e.key==='Enter')setSelected(n);}} className="tree-node" transform={`translate(${n.x-96},${n.y-36})`}>
        <rect width={192} height={72} rx={10} fill={n.leaf?(n.prediction?'#fff0e7':'#e8f4f0'):'#fff'} stroke={selected?.id===n.id?'#12776c':n.prediction?'#d8a275':'#adcfc5'} strokeWidth={selected?.id===n.id?2.5:1.2}/>
        <text x={96} y={23} textAnchor="middle" fontSize={11} fontWeight={700} fill="#204e49">{n.leaf?(n.prediction?'Flagged for review':'Not flagged'):n.feature}</text>
        <text x={96} y={41} textAnchor="middle" fontSize={11} fill="#456b65">{n.leaf?`${n.samples} training rows`:`≤ ${n.threshold.toLocaleString()}`}</text>
        <text x={96} y={59} textAnchor="middle" fontSize={9} fill="#68877f">{!n.leaf&&n.terminal?'More branches in full rules below':`Node ${n.id} · ${n.samples} rows`}</text>
      </g>)}
    </svg></div>
    {selected && <div className="recent-scope-note">Node {selected.id}: {selected.samples} training rows; impurity {selected.impurity}. {selected.leaf?`This leaf predicts ${selected.prediction?'flagged for review':'not flagged'}.`:`Split on ${selected.feature} at ${selected.threshold.toLocaleString()}.`}</div>}
  </>;
}
