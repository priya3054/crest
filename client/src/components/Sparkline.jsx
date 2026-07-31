// Tiny inline line chart for list rows. Colour = trend (gain/loss).
export function Sparkline({ data = [], width = 76, height = 24, color = '#2FC98C', points = 32 }) {
  const pts = data.slice(-points);
  if (pts.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const pad = 2;
  const h = height - pad * 2;
  const step = width / (pts.length - 1);
  const path = pts
    .map((v, i) => `${(i * step).toFixed(2)},${(pad + h - ((v - min) / range) * h).toFixed(2)}`)
    .join(' ');
  return (
    <svg width={width} height={height} aria-hidden>
      <polyline points={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
