import { useEffect, useId, useRef, useState } from 'react';

// How many recent points each range shows. The server keeps ~240 points, so the
// ranges are genuinely different windows, not just styled chips.
const RANGE_POINTS = { '1D': 55, '1W': 110, '1M': 170, '1Y': 240 };

// Line chart with a soft gradient area fill and a round end-point dot.
// It measures its own width so the geometry is drawn in real pixels — no aspect
// distortion, and the dot stays a true circle at any container width.
export function PriceChart({ data = [], color = '#2FC98C', height = 250, range = '1D' }) {
  const gid = useId();
  const wrapRef = useRef(null);
  const [w, setW] = useState(600);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setW(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pts = data.slice(-(RANGE_POINTS[range] || data.length));
  const H = height;
  const pad = 16;

  let body = null;
  if (pts.length >= 2) {
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range2 = max - min || 1;
    const innerH = H - pad * 2;
    const step = w / (pts.length - 1);
    const xy = pts.map((v, i) => [i * step, pad + innerH - ((v - min) / range2) * innerH]);
    const line = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
    const area = `${line} L${w} ${H} L0 ${H} Z`;
    const [cx, cy] = xy[xy.length - 1];
    body = (
      <svg width={w} height={H} style={{ display: 'block' }}>
        <defs>
          <linearGradient id={`grad-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#grad-${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="3.5" fill={color} />
      </svg>
    );
  }

  return (
    <div ref={wrapRef} style={{ width: '100%', height: H }}>
      {body}
    </div>
  );
}
