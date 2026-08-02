import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api } from './api';

const StoreCtx = createContext(null);
export const useStore = () => useContext(StoreCtx);

const EMPTY = {
  loaded: false,
  cash: 0,
  watchlist: [],
  stocks: {}, // symbol -> { symbol, name, sector, price, prevClose, hist[], flash, volq }
  holdings: [],
  orders: [],
  txns: [],
  market: { open: true, tickMs: 1400 },
};

export function StoreProvider({ children }) {
  const [state, setState] = useState(EMPTY);
  const flashTimer = useRef(null);

  // Full snapshot from the server. Called on load and after every mutation so the
  // UI always reflects authoritative cash/holdings/orders.
  const hydrate = useCallback(async () => {
    const s = await api.getState();
    const stocks = {};
    for (const st of s.stocks) stocks[st.symbol] = { ...st, flash: 0 };
    setState((prev) => ({
      ...prev,
      loaded: true,
      cash: s.cash,
      watchlist: s.watchlist,
      stocks,
      holdings: s.holdings,
      orders: s.orders,
      txns: s.txns,
      market: s.market,
    }));
  }, []);

  useEffect(() => {
    hydrate().catch((e) => console.error('hydrate failed', e));
  }, [hydrate]);

  // Live-price polling. Every tick we merge fresh prices and set a flash direction;
  // a short timer then clears flashes to 0 so the row background fades back out.
  useEffect(() => {
    if (!state.loaded) return undefined;
    const ms = state.market?.tickMs || 1400;
    let alive = true;

    const poll = async () => {
      try {
        const feed = await api.getPrices();
        if (!alive) return;
        setState((prev) => {
          const stocks = { ...prev.stocks };
          for (const p of feed.stocks) {
            const cur = stocks[p.symbol];
            if (cur) stocks[p.symbol] = { ...cur, price: p.price, prevClose: p.prevClose, hist: p.hist, flash: p.flash };
          }
          return { ...prev, stocks, market: { ...prev.market, open: feed.open } };
        });
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => {
          if (!alive) return;
          setState((prev) => {
            const stocks = { ...prev.stocks };
            for (const k of Object.keys(stocks)) stocks[k] = { ...stocks[k], flash: 0 };
            return { ...prev, stocks };
          });
        }, Math.min(700, ms - 100));
      } catch {
        /* transient network error — next tick retries */
      }
    };

    const id = setInterval(poll, ms);
    return () => {
      alive = false;
      clearInterval(id);
      clearTimeout(flashTimer.current);
    };
  }, [state.loaded, state.market?.tickMs]);

  // ---- mutations: hit the API, then re-hydrate the snapshot ----
  const placeOrder = async (body) => {
    const r = await api.placeOrder(body);
    await hydrate();
    return r;
  };
  const cancelOrder = async (id) => {
    await api.cancelOrder(id);
    await hydrate();
  };
  const wallet = async (body) => {
    const r = await api.wallet(body);
    await hydrate();
    return r;
  };
  const addWatch = async (symbol) => {
    await api.addWatch(symbol);
    await hydrate();
  };
  const removeWatch = async (symbol) => {
    await api.removeWatch(symbol);
    await hydrate();
  };

  const value = { ...state, hydrate, placeOrder, cancelOrder, wallet, addWatch, removeWatch };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
