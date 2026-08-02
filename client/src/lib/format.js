// Indian-locale money & number formatting used everywhere numbers are shown.

// ₹1,71,842.55 — Indian digit grouping, 2 decimals.
export const inr = (n) =>
  '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ₹25,000 — no decimals (used for whole-rupee amounts like transactions/quick-add).
export const inr0 = (n) =>
  '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

// Signed money: +₹2,036.10 / -₹247.23
export const signedInr = (n) => (n >= 0 ? '+' : '-') + inr(Math.abs(n));

// Signed percent: +1.20% / -0.26%
export const pct = (n) => (n >= 0 ? '+' : '-') + Math.abs(n).toFixed(2) + '%';

// Plain grouped integer (volumes): 1,71,842
export const grouped = (n) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

// "16 Jul, 18:59"
export const fdate = (ts) => {
  const d = new Date(ts);
  const day = d.getDate();
  const mon = d.toLocaleString('en-US', { month: 'short' });
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${mon}, ${hh}:${mm}`;
};
