import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import { connectSocket } from '../lib/socket.js';

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

  // Live prices arrive over a WebSocket (pushed by the server) instead of polling.
  // On connect we get one FULL `snapshot` (with history); after that only slim
  // `tick` payloads (price + flash), and we append each new price to the history
  // we already hold — so the server ships ~0.4 KB per tick, not ~23 KB.
  useEffect(() => {
    if (!state.loaded) return undefined;
    const socket = connectSocket();
    const HISTORY = 240;

    // FULL snapshot: replace history outright.
    const onSnapshot = (feed) => {
      setState((prev) => {
        const stocks = { ...prev.stocks };
        for (const p of feed.stocks) {
          const cur = stocks[p.symbol];
          stocks[p.symbol] = { ...(cur || { symbol: p.symbol }), price: p.price, prevClose: p.prevClose, hist: p.hist, flash: 0 };
        }
        return { ...prev, stocks, market: { ...prev.market, open: feed.open, reason: feed.reason } };
      });
    };

    // SLIM tick: update price/flash and append to our own history.
    const onTick = (feed) => {
      setState((prev) => {
        const stocks = { ...prev.stocks };
        for (const p of feed.stocks) {
          const cur = stocks[p.symbol];
          if (!cur) continue;
          const hist = cur.hist ? [...cur.hist, p.price] : [p.price];
          if (hist.length > HISTORY) hist.shift();
          stocks[p.symbol] = { ...cur, price: p.price, prevClose: p.prevClose ?? cur.prevClose, hist, flash: p.flash };
        }
        return { ...prev, stocks, market: { ...prev.market, open: feed.open, reason: feed.reason } };
      });
      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => {
        setState((prev) => {
          const stocks = { ...prev.stocks };
          for (const k of Object.keys(stocks)) stocks[k] = { ...stocks[k], flash: 0 };
          return { ...prev, stocks };
        });
      }, 700);
    };

    socket.on('snapshot', onSnapshot);
    socket.on('tick', onTick);
    return () => {
      socket.off('snapshot', onSnapshot);
      socket.off('tick', onTick);
      socket.close();
      clearTimeout(flashTimer.current);
    };
  }, [state.loaded]);

  // ---- mutations ----
  // A trade changes cash, holdings, orders and txns together, so a full refresh
  // is the simplest correct choice here.
  const placeOrder = async (body, idempotencyKey) => {
    const r = await api.placeOrder(body, idempotencyKey);
    await hydrate();
    return r;
  };
  // The lighter mutations return exactly what changed, so we merge the response
  // into state rather than refetching the whole snapshot (cash + watchlist + all
  // stocks with history + holdings + orders + txns) just to flip one field.
  const cancelOrder = async (id) => {
    await api.cancelOrder(id);
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === id ? { ...o, status: 'cancelled' } : o)),
    }));
  };
  const wallet = async (body) => {
    const r = await api.wallet(body);
    setState((prev) => ({ ...prev, cash: r.cash, txns: [r.txn, ...prev.txns] }));
    return r;
  };
  const addWatch = async (symbol) => {
    const r = await api.addWatch(symbol);
    setState((prev) => ({ ...prev, watchlist: r.watchlist }));
  };
  const removeWatch = async (symbol) => {
    const r = await api.removeWatch(symbol);
    setState((prev) => ({ ...prev, watchlist: r.watchlist }));
  };

  const value = { ...state, hydrate, placeOrder, cancelOrder, wallet, addWatch, removeWatch };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
