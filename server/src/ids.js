// Generate the next sequential human-readable id (ORD-1048, TXN-3022) by scanning
// the highest existing numeric suffix. IDs are globally unique across users.
export async function nextId(Model, field, prefix, floor) {
  const docs = await Model.find({}, field);
  const max = docs.reduce((m, d) => {
    const n = parseInt(String(d[field]).split('-')[1], 10);
    return Number.isNaN(n) ? m : Math.max(m, n);
  }, floor);
  return `${prefix}-${max + 1}`;
}
