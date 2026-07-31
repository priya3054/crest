import { useId } from 'react';

// Line chart with a soft gradient area fill and an end-point dot.
// Uses a fixed 600x250 viewBox that scales to the container width.
export function PriceChart({ data = [], color = '#2FC98C', height = 250 }) {
  const gid = useId();
  const W = 600;
  const H = 250;
  const pad = 16;
  const pts = data;
  if (pts.length < 2) return <div style={{ height }} />;

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const innerH = H - pad * 2;
  const step = W / (pts.length - 1);

  const xy = pts.map((v, i) => [i * step, pad + innerH - ((v - min) / range) * innerH]);
  const line = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const [cx, cy] = xy[xy.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`grad-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad-${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={cx} cy={cy} r="3.5" fill={color} />
    </svg>
  );
}
