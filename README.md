# Crest — Real-Time Paper-Trading Platform

[![CI](https://github.com/priya3054/crest/actions/workflows/ci.yml/badge.svg)](https://github.com/priya3054/crest/actions/workflows/ci.yml)

Crest is a **simulated stock-trading web app**: a virtual INR wallet, live-ticking
NSE-style prices, market & limit orders, a portfolio with live P&L, a watchlist,
and a simulated Razorpay wallet flow — in a polished dark-theme UI that runs from
phones to desktop.

Under the hood it's built as a **real-time distributed system**, not a CRUD app:
a WebSocket price feed, Redis pub/sub + caching, rate limiting, concurrency-safe
money handling, and a horizontally-scaled deployment behind an Nginx load balancer.

**Stack:** MongoDB · Express · React (Vite) · Node · Redis · Socket.IO · Nginx · Docker

---

## Architecture

```mermaid
flowchart LR
  Browser["React SPA<br/>(Vite build)"]
  NGINX["Nginx<br/>static + load balancer"]
  G1["Gateway 1<br/>API + WebSocket"]
  G2["Gateway 2<br/>API + WebSocket"]
  PROD["Price Producer<br/>(single instance)"]
  REDIS[("Redis<br/>pub/sub · cache · rate-limit · idempotency")]
  MONGO[("MongoDB<br/>users · wallets · orders")]

  Browser -->|"REST (round-robin)"| NGINX
  Browser -.->|"WebSocket (sticky)"| NGINX
  NGINX --> G1
  NGINX --> G2
  PROD -->|publish ticks| REDIS
  REDIS -->|subscribe| G1
  REDIS -->|subscribe| G2
  G1 --> MONGO
  G2 --> MONGO
  PROD --> MONGO
```

**Why this shape:** a single **producer** owns the price simulation and publishes
each tick to Redis, so every load-balanced **gateway** delivers the *same* feed to
its clients — you can scale the API/WebSocket tier horizontally without clients
seeing divergent prices. Gateways are stateless (JWT auth), so Nginx round-robins
REST across them; WebSockets are pinned per-client with `ip_hash`.

---

## System-design highlights

| Concern | How Crest handles it |
|---|---|
| **Real-time prices** | Server **pushes** ticks over **Socket.IO** (JWT-authed) — no client polling. |
| **Pub/Sub fan-out** | The producer publishes to **Redis**; each gateway subscribes and fans out to its own sockets. |
| **Caching** | Latest market snapshot cached in Redis; new socket connections get it instantly. |
| **Rate limiting** | **Redis sliding-window** limiter — auth (20 / 15 min per IP) and orders (30 / min per user); returns `429` + `Retry-After`. |
| **Concurrency safety** | Wallet **and trade** moves use **atomic guarded updates** (`$gte`) for cash and **optimistic compare-and-swap** for share counts — [a committed test](server/test/concurrency.test.js) fires 40 concurrent buys and asserts cash never goes negative *and* shares are conserved. |
| **Efficient live feed** | New clients get one full snapshot (with history); each tick then ships only what changed — **~22.4 KB → ~0.8 KB per tick (measured), ~96%** less bandwidth. |
| **Idempotency** | `Idempotency-Key` on order placement — retries replay the first result instead of double-filling. |
| **Atomic IDs** | Order/transaction ids come from an atomic Mongo counter (`$inc`), not a race-prone max-scan. |
| **Horizontal scaling** | Producer / gateway split via a `ROLE` env; **Nginx** balances 2 gateways in Docker Compose. |
| **Auth & isolation** | JWT + bcrypt; every query scoped to `userId` so accounts never see each other's data. |
| **Testing & CI** | Vitest + GitHub Actions (real Mongo + Redis service containers) run the concurrency test on every push. |

---

## Project structure

```
Crest/
├── docker-compose.yml          full stack: nginx + 2 gateways + producer + redis + mongo
├── server/
│   ├── Dockerfile
│   └── src/
│       ├── index.js            entrypoint (ROLE = all | producer | gateway)
│       ├── seed.js             demo data + id counters
│       ├── config/             db.js, redis.js
│       ├── models/             mongoose schemas
│       ├── services/           auth.js (jwt/bcrypt), trade.js (atomic fills)
│       ├── middleware/         auth.js, rateLimit.js, idempotency.js
│       ├── market/             market.js (sim), producer.js (ticks), realtime.js (socket.io)
│       ├── routes/             api.js, auth.js
│       └── utils/              ids.js (atomic counter)
└── client/
    ├── Dockerfile              multi-stage build → Nginx (serves app + load-balances)
    ├── nginx.conf
    └── src/
        ├── main.jsx, App.jsx, index.css
        ├── context/            auth, store (WebSocket), ui (modals)
        ├── lib/                api, socket, format, selectors
        ├── components/         Sidebar, TopBar, modals, charts
        └── screens/            Dashboard, Watchlist, Portfolio, Orders, Wallet, StockDetail
```

---

## Run it

### Option A — Docker Compose (the full load-balanced stack)
Brings up Nginx + 2 gateways + producer + Redis + Mongo:
```bash
docker compose up -d --build
```
Open **http://localhost:8080**. Every response carries an `X-Served-By` header so
you can watch requests round-robin between the two gateways. Stop it with
`docker compose down` (add `-v` to wipe the demo data volume).

### Option B — Local dev (hot reload)
Prerequisites: Node 18+, a local **MongoDB** (`:27017`) and **Redis** (`:6379`).
Start Redis quickly with `docker run -d -p 6379:6379 redis:7-alpine`.

```bash
# terminal 1 — backend (producer + gateway in one process)
cd server && npm install && cp .env.example .env && npm run seed && npm run dev

# terminal 2 — frontend
cd client && npm install && npm run dev
```
Open **http://localhost:5173** (Vite proxies `/api` and `/socket.io` to `:4000`).

### Accounts
Sign up (new accounts start with **₹1,00,000** virtual funds) or use the seeded
demo account — **`demo@crest.app` / `demo123`**.

### Tests
```bash
cd server && npm test        # needs a local Mongo on :27017 (skips cleanly if absent)
```
Runs the concurrency test (40 parallel buys → cash never negative, shares conserved).
CI runs it on every push against real Mongo + Redis containers.

---

## Configuration (`server/.env`)
| Var | Default | Notes |
|---|---|---|
| `ROLE` | `all` | `all` \| `producer` \| `gateway` (split for scaling) |
| `MARKET_HOURS` | `auto` | `auto` (real NSE hours) \| `always` (24/7 demo) \| `closed` |
| `TICK_MS` | `1400` | simulation tick interval |
| `REVERSION` | `0.0015` | how strongly prices mean-revert toward their anchor |
| `MARKET_HOLIDAYS` | (a few) | comma-separated `YYYY-MM-DD` NSE holidays (market closed) |
| `CLIENT_ORIGIN` | — | lock CORS to this origin in production |
| `MONGO_URI` / `REDIS_URL` | local | connection strings |
| `JWT_SECRET` | — | **required in production** (boot fails without it); long random string |

---

## API
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` · `/login` | create account / sign in → JWT (rate-limited) |
| GET | `/api/auth/me` | current user |
| GET | `/api/state` | full snapshot for the signed-in user |
| POST | `/api/orders` | place a market/limit order (rate-limited, idempotent) |
| POST | `/api/orders/:id/cancel` | cancel a pending order |
| POST | `/api/wallet` | add / withdraw funds |
| POST / DELETE | `/api/watchlist[/:symbol]` | add / remove a symbol |

Live prices are delivered over **Socket.IO**: a full `snapshot` event on connect,
then slim `tick` events — not REST polling. Every endpoint except
`/api/auth/register` and `/api/auth/login` requires an `Authorization: Bearer
<token>` header and acts only on the signed-in user's data.

---

## Known limitations (and the production fix for each)

Deliberate trade-offs for a demo, each with the path to production-grade:

- **Trades aren't wrapped in a DB transaction.** A trade touches two documents
  (cash + holding); each write is atomic and guarded, so nothing goes negative,
  but a crash *between* them could diverge the halves. *Fix:* a Mongo
  multi-document transaction via a session — needs a replica set; the demo runs
  standalone Mongo.
- **Limit orders don't reserve funds.** The balance is checked at placement, but a
  pending limit order debits nothing, so several large limit-buys can be placed
  against the same cash; the first fills and the rest are rejected on fill. *Fix:*
  a `reserved` balance debited at placement and released on cancel/reject.
- **JWTs are stored in `localStorage`** (7-day expiry, no server-side revocation),
  so any XSS could read the token and logout is client-side only. *Fix:* httpOnly
  cookies + short-lived access tokens with refresh rotation + a Redis denylist on
  logout.
