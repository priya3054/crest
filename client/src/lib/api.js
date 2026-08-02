// Thin wrapper over fetch. All calls go to the Express API via the Vite proxy.
// The JWT (if present) is attached as a Bearer token on every request.

const TOKEN_KEY = 'crest_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// AuthProvider registers a handler here so a 401 anywhere logs the user out.
let onAuthError = () => {};
export const setAuthErrorHandler = (fn) => {
  onAuthError = fn;
};

async function req(path, { headers, ...options } = {}) {
  const token = getToken();
  const res = await fetch('/api' + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) onAuthError();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // auth
  register: (body) => req('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => req('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => req('/auth/me'),
  // app data
  getState: () => req('/state'),
  getPrices: () => req('/prices'),
  placeOrder: (body, idempotencyKey) =>
    req('/orders', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
  cancelOrder: (id) => req(`/orders/${id}/cancel`, { method: 'POST' }),
  wallet: (body) => req('/wallet', { method: 'POST', body: JSON.stringify(body) }),
  addWatch: (symbol) => req('/watchlist', { method: 'POST', body: JSON.stringify({ symbol }) }),
  removeWatch: (symbol) => req(`/watchlist/${symbol}`, { method: 'DELETE' }),
};
