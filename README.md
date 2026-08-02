# Crest — Simulated Stock Trading Platform (MERN)

Crest is a **paper-trading** web app: a virtual INR wallet, live-ticking stock
prices, market & limit orders, a portfolio with live P&L, and a simulated
Razorpay wallet flow. Dark theme only. Built from the approved design handoff.

**Stack:** MongoDB · Express · React (Vite) · Node — with the price simulation
running server-side and the React client polling for live prices.

```
Crest/
├── server/          Express + Mongoose API + in-memory price simulation
│   └── src/
│       ├── index.js         boot: connect DB, hydrate market, start sim, serve API
│       ├── db.js            mongoose connection
│       ├── models/index.js  Account, Stock, Holding, Order, Transaction
│       ├── market.js        in-memory tick loop + limit-order auto-fill
│       ├── trade.js         the single place cash/holdings change on a trade
│       ├── seed.js          seed 12 stocks, holdings, orders, transactions
│       └── routes/api.js    REST endpoints
└── client/          React SPA (Vite)
    └── src/
        ├── store.jsx        global state + live-price polling
        ├── api.js           fetch wrapper
        ├── format.js        Indian-locale money/number/date formatting
        ├── selectors.js     derived P&L / change math
        ├── components/      Sidebar, TopBar, modals, charts, bits
        └── screens/         Dashboard, Watchlist, Portfolio, Orders, Wallet, StockDetail
```

## Prerequisites
- Node 18+
- A running local MongoDB (`mongodb://127.0.0.1:27017`)

## Run it

**1. Backend** (terminal 1):
```bash
cd server
npm install
cp .env.example .env      # first time only
npm run seed              # load the demo data (safe to re-run: it resets)
npm run dev               # http://localhost:4000
```

**2. Frontend** (terminal 2):
```bash
cd client
npm install
npm run dev               # http://localhost:5173
```

Open http://localhost:5173. The client proxies `/api` to the backend on :4000.

### Accounts
The app requires sign-in. Either **sign up** (new accounts start with ₹1,00,000
in virtual funds) or use the seeded **demo account**:

- **Email:** `demo@crest.app`
- **Password:** `demo123`

Each user has their own isolated wallet, holdings, orders and watchlist; stock
prices are shared market data.

## How it works
- **Prices** live in memory on the server (`market.js`) and re-price every
  `TICK_MS` (1400ms) with a slight upward bias, exactly like the design
  prototype. The client polls `GET /api/prices` each tick and flashes rows on
  change. Prices are ephemeral by design — restarting the server regenerates
  them while your cash/holdings/orders persist in MongoDB.
- **Money is authoritative on the server.** Every fill goes through
  `trade.js#applyTrade`, so market orders, limit auto-fills, weighted-average
  buys and balance/holdings validation can never diverge.
- **Limit orders** stay pending and auto-fill when price crosses the limit
  (buy: price ≤ limit, sell: price ≥ limit), re-checked every tick.
- **Wallet** add/withdraw is a simulated Razorpay flow (no real money moves).
- **Market hours:** with `MARKET_HOURS=auto` the sim follows real NSE hours
  (Mon–Fri 09:15–15:30 IST) — ticking pauses and the badge shows CLOSED outside
  them. Set `MARKET_HOURS=always` to keep it live around the clock for demos.
- **Responsive:** works from phones to desktop — the sidebar becomes a drawer on
  narrow screens and layouts restack.

## API
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | create an account, returns a JWT |
| POST | `/api/auth/login` | sign in, returns a JWT |
| GET | `/api/auth/me` | current user (requires token) |
| GET | `/api/state` | full snapshot to hydrate the app |
| GET | `/api/prices` | lightweight live price feed (polled) |
| POST | `/api/orders` | place a market/limit order |
| POST | `/api/orders/:id/cancel` | cancel a pending order |
| POST | `/api/wallet` | add / withdraw funds |
| POST | `/api/watchlist` | add a symbol |
| DELETE | `/api/watchlist/:symbol` | remove a symbol |

Every endpoint except `/api/auth/register` and `/api/auth/login` requires an
`Authorization: Bearer <token>` header; data endpoints act only on the signed-in
user's records (`/api/prices` returns the shared market feed).
