import { createContext, useContext, useState, useCallback } from 'react';
import { OrderModal } from './components/OrderModal.jsx';
import { FundsModal } from './components/FundsModal.jsx';

const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

// Owns the two overlay modals (order + funds) so any screen can open them.
export function UIProvider({ children }) {
  const [order, setOrder] = useState(null); // { symbol?, side? }
  const [funds, setFunds] = useState(null); // { mode }
  const [navOpen, setNavOpen] = useState(false); // mobile sidebar drawer

  const openOrder = useCallback((symbol, side = 'buy') => setOrder({ symbol, side }), []);
  const openFunds = useCallback((mode = 'add') => setFunds({ mode }), []);
  const closeOrder = useCallback(() => setOrder(null), []);
  const closeFunds = useCallback(() => setFunds(null), []);
  const toggleNav = useCallback(() => setNavOpen((v) => !v), []);
  const closeNav = useCallback(() => setNavOpen(false), []);

  return (
    <UICtx.Provider value={{ openOrder, openFunds, navOpen, toggleNav, closeNav }}>
      {children}
      {order && <OrderModal initial={order} onClose={closeOrder} />}
      {funds && <FundsModal mode={funds.mode} onClose={closeFunds} />}
    </UICtx.Provider>
  );
}
