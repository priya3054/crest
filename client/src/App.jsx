import { Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar.jsx';
import { useStore } from './context/store.jsx';
import { Dashboard } from './screens/Dashboard.jsx';
import { Watchlist } from './screens/Watchlist.jsx';
import { Portfolio } from './screens/Portfolio.jsx';
import { Orders } from './screens/Orders.jsx';
import { Wallet } from './screens/Wallet.jsx';
import { StockDetail } from './screens/StockDetail.jsx';

export default function App() {
  const { loaded } = useStore();

  return (
    <div className="app">
      <Sidebar />
      <div className="content-wrap">
        {!loaded ? (
          <div className="empty" style={{ marginTop: 120 }}>
            <div className="muted">Loading market…</div>
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/stock/:symbol" element={<StockDetail />} />
          </Routes>
        )}
      </div>
    </div>
  );
}
