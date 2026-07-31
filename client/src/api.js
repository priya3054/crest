// Thin wrapper over fetch. All calls go to the Express API via the Vite proxy.

async function req(path, options) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  getState: () => req('/state'),
  getPrices: () => req('/prices'),
  placeOrder: (body) => req('/orders', { method: 'POST', body: JSON.stringify(body) }),
  cancelOrder: (id) => req(`/orders/${id}/cancel`, { method: 'POST' }),
  wallet: (body) => req('/wallet', { method: 'POST', body: JSON.stringify(body) }),
  addWatch: (symbol) => req('/watchlist', { method: 'POST', body: JSON.stringify({ symbol }) }),
  removeWatch: (symbol) => req(`/watchlist/${symbol}`, { method: 'DELETE' }),
};
