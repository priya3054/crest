# Crest — Learning Notes

Beginner-oriented notes on *why* the code is shaped the way it is. Appended per
phase as the project grows.

---

## Phase 1 — Foundation: MERN scaffold, backend, and full UI

### What MERN means here
- **M**ongoDB — the database. Stores documents (JSON-like objects) in collections.
- **E**xpress — the web server framework on Node. Defines HTTP routes (`GET /api/...`).
- **R**eact — the UI library running in the browser.
- **N**ode — the JavaScript runtime the server runs on.

Data flows: **React (browser)** → HTTP → **Express (server)** → **Mongoose** → **MongoDB**.

### Why the price simulation runs on the *server*, not the browser
A trading app must have one authoritative price. If each browser invented its own
random prices, two things break: (1) different users would see different prices,
and (2) the server couldn't trust an order the client claims was valid. So the
tick loop lives in `server/src/market.js`, and the browser just *polls* for the
latest prices every 1.4s (`GET /api/prices`). This is the same seam you'd use to
later swap in a real market feed — only `market.js` would change.

### Mongoose models (`server/src/models/index.js`)
A **schema** describes the shape of a document; a **model** is the thing you call
`.find()` / `.create()` on. We have five: `Account` (a single doc holding cash +
watchlist), `Stock`, `Holding`, `Order`, `Transaction`. Keeping money data in the
DB means it survives a server restart — only the (simulated) live prices are
regenerated on boot.

### One place for trade rules (`server/src/trade.js`)
Both a user's manual order *and* the automatic limit-order fill need to move cash
and adjust a holding by the exact same rules (including the weighted-average buy
price). Duplicating that logic in two places is how bugs creep in, so it lives in
a single `applyTrade()` function that both callers use.

### Weighted-average buy price
When you buy more of a stock you already hold, the new average cost is:
`(oldAvg × oldQty + newCost) ÷ (oldQty + newQty)`. That's why buying 2 more
RELIANCE at ₹2,996 moved the average from ₹2,870 up to ₹2,906 — verified live.

### Express routes (`server/src/routes/api.js`)
Each endpoint reads/writes Mongo and returns JSON. Two key ones:
- `GET /api/state` — one big snapshot to *hydrate* the app on load.
- `GET /api/prices` — a tiny payload the client polls constantly.
Mutations (place order, wallet, watchlist) return `{ ok }` and the client then
re-fetches `/state` so the UI always reflects the authoritative server data.

### React state with Context (`client/src/store.jsx`)
Instead of passing data through every component by hand ("prop drilling"), a
**Context** provider holds the whole app state once and any component reads it via
`useStore()`. The provider also owns the polling `setInterval` and the
tick-flash timing.

### The Vite dev proxy
The React dev server (`:5173`) and API (`:4000`) are different origins. Rather
than fight CORS, `vite.config.js` proxies `/api` → `:4000`, so the browser thinks
it's all one origin during development.

### Design fidelity
All colours, fonts (Instrument Sans for text, IBM Plex Mono for every number),
radii and spacing come from the handoff's design tokens, centralised as CSS
variables in `client/src/index.css`. Green/red are reserved for price/P&L/side
only; blue is for primary actions and active nav.

**Verified working end-to-end:** live ticking prices, dashboard/portfolio P&L,
a market buy that debited the wallet and re-weighted the average, order book,
and the order-success receipt.
