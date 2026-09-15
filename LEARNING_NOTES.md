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

---

## Phase 2 — Auth & multi-user

The app went from one shared wallet to real accounts, each with isolated money,
holdings, orders and watchlist.

### Passwords are never stored — only hashes
`server/src/auth.js` uses **bcrypt** to turn a password into a one-way hash
(`hashPassword`). On login we `verifyPassword` by re-hashing the attempt and
comparing. Even someone with full database access can't read anyone's password.

### JWT — how the server knows who you are
HTTP is stateless: each request arrives with no memory of the last. After login
the server hands back a **JSON Web Token** — a signed string encoding your user
id. The browser stores it and sends it on every request as
`Authorization: Bearer <token>`. `requireAuth` (`server/src/middleware.js`)
verifies the signature and sets `req.userId`. Because it's *signed* with
`JWT_SECRET`, nobody can forge one without the secret.

### Scoping every query to the user
This is the heart of multi-user: **every** database read/write now filters by
`userId` — `Account.findOne({ userId })`, `Holding.find({ userId })`, and so on.
`applyTrade` takes a `userId` too. Miss one filter and users would see or move
each other's money, so the rule is: no query touches Account/Holding/Order/
Transaction without a `userId`. Holdings use a **compound unique index**
`{ userId, symbol }` so each user has one holding per stock, but two users can
both hold RELIANCE independently.

### What's shared vs. per-user
Stocks and live prices are **shared market data** (everyone sees the same
prices — that's what a market is). Cash, holdings, orders, transactions and
watchlist are **per-user**. The `/api/prices` feed is the same for all;
`/api/state` is filtered to you.

### Frontend: gating the app behind auth
`client/src/auth.jsx` is a Context that holds the token (in `localStorage`) and
the current user. `main.jsx` renders one of three things: a loader while it
validates a saved token, the login/signup screen when logged out, or the full
app when logged in. The store + polling only mount **after** login, so no data
is fetched without a token. A `401` from any API call auto-logs-you-out.

### A security note (localStorage vs. cookies)
We keep the JWT in `localStorage` — simple and easy to reason about, fine for a
no-real-money learning app. In a production app handling real value you'd
usually prefer an **httpOnly cookie** (JavaScript can't read it, which blocks a
class of XSS token theft). Worth knowing the trade-off.

**Verified end-to-end:** demo login, wrong-password rejection, new-user signup
with ₹1,00,000 starter funds and an isolated empty portfolio, duplicate-email
rejection, logout, and full data isolation between two accounts.

---

## Phase 2.1 — Detailed audit & depth pass

A full feature-by-feature audit against the design handoff, testing every flow
live (buy, sell, limit→pending→cancel, funds add/withdraw + validation, watchlist
search/add/remove, filters, empty states, auth) and reviewing the code for
correctness. Two improvements came out of it:

### Chart ranges made real (not cosmetic)
The 1D/1W/1M/1Y chips previously just changed styling — every range drew the same
data. The sim now retains **240 points** of history (was ~80) and `PriceChart`
slices a different window per range (1D≈55, 1W≈110, 1M≈170, 1Y=all 240), so the
chips genuinely change the chart. Sparklines still read the last ~32.

### Crisp, undistorted chart
The chart used to stretch a fixed `600×250` viewBox to fit its container, which
subtly distorted the line and turned the end-dot into an ellipse. It now uses a
`ResizeObserver` to measure its real pixel width and draws geometry in true
pixels — the line is crisp and the dot is a perfect circle at any width.

### Things confirmed genuinely done (not superficial)
Market/limit orders with weighted-average buys and limit auto-fill; every
validation error returns the exact spec copy; Indian digit grouping everywhere;
tick-flash; order book depth bars + spread; per-filter empty states; the full
Razorpay-sim funds flow (form→processing→success). Known trade-offs left as-is on
purpose: prices carry the spec's slight upward bias (faithful to the prototype),
and the JWT lives in localStorage (simple; a cookie would be stricter).

---

## Phase 3 — Market hours & responsive design

### Real NSE market hours
The sim now knows when the market is open: **Mon–Fri, 09:15–15:30 IST**. The tick
loop pauses outside those hours (prices freeze at the last value, limit orders
stop filling) and the sidebar badge flips to **CLOSED** with a helpful caption.
Two ideas worth remembering:
- **Timezone-safe:** we compute "now in IST" from UTC (`getTime()` +
  `getTimezoneOffset()` + 5.5h) so it's correct no matter what timezone the
  server runs in.
- **`MARKET_HOURS` env** has three modes: `auto` (real hours — the shipped
  default), `always` (open 24/7, handy for demos), `closed`. The live open/closed
  flag rides along in the `/api/prices` poll so the badge flips mid-session.

### Responsive layout (mobile → desktop)
The desktop-only layout now adapts down to phones:
- **The key trick:** the fixed multi-column grids were inline styles, which media
  queries *can't* override. Moving them to CSS classes (`.grid-main`,
  `.grid-detail`, `.grid-summary`) let breakpoints restack them to one column.
- **Off-canvas sidebar:** below 900px the sidebar becomes a fixed drawer
  (`translateX(-100%)`), a ☰ button in the top bar toggles it, and a scrim sits
  behind it. Nav state lives in the UI context so the top bar and sidebar share
  it. Tapping a link or the scrim closes it.
- **Wide tables scroll inside their own container** (`.table-scroll`) instead of
  pushing the whole page sideways — the body never scrolls horizontally.
- **The chart measures its own width** (ResizeObserver) so it fills whatever
  column it lands in, on any screen.

**Verified:** CLOSED badge on a real Saturday + LIVE ticking when forced open;
drawer open/close with scrim; every screen stacks with zero horizontal overflow
at 375px; desktop unchanged (sidebar sticky, hamburger hidden, grids multi-col).

---

## Phase 4 — System design (real-time, Redis, scaling)

This is what makes Crest read as a real system, not a CRUD app. Concepts:

### Push, not poll (WebSockets)
Polling asks "any changes?" every 1.4s — wasteful and not truly live. Instead the
**server pushes**: the client opens one **Socket.IO** connection and the server
emits a `tick` whenever prices change. Fewer requests, instant updates.

### Pub/Sub decoupling (Redis)
If we ran two API servers each with their own price loop, users would see two
different feeds. So one **producer** owns the sim and **publishes** each tick to a
**Redis channel**; every **gateway** *subscribes* and re-emits to its own sockets.
Now you can add gateways freely — they all relay the same feed. This is the
publish/subscribe pattern, and it's the key that unlocks horizontal scaling.

### Caching
The latest snapshot is stored in Redis. A newly-connected client gets it
immediately (a cache read) instead of waiting for the next tick or recomputing.

### Rate limiting (sliding window)
A Redis **sorted set** stores a timestamp per request; we drop entries older than
the window and count what's left. Over the limit → `429`. Because the counter is
in Redis, the limit holds across *all* gateways, not per-process.

### Concurrency safety (the money bug most apps have)
The naive "read balance → subtract → save" has a race: two orders both read the
old balance and both succeed, overspending. The fix is an **atomic conditional
update** — `findOneAndUpdate({ cash: { $gte: cost } }, { $inc: { cash: -cost } })`
— which debits *only if* the guard still holds, in one indivisible DB operation.
Stress-tested with 40 concurrent buys: exactly the affordable number filled and
cash never went negative.

### Idempotency
A dropped response makes clients retry — and a retried "buy" could fill twice. An
**Idempotency-Key** fixes this: the first request runs and its result is cached in
Redis; any repeat with the same key replays that result instead of trading again.

### Horizontal scaling (Nginx + Docker Compose)
A `ROLE` env splits the process into `producer` (one) and `gateway` (many).
`docker-compose` runs a producer, **two gateways**, Redis, Mongo, and an **Nginx**
front door that serves the React build, **round-robins REST** across gateways and
**pins each WebSocket** to one (`ip_hash`). An `X-Served-By` header proves requests
land on different instances. Everything above (pub/sub, shared cache, shared rate
limits) is exactly what lets those two gateways behave as one system.

---

## Phase — Audit fixes: correctness & hardening

A code audit flagged ~30 issues. This phase fixes the correctness bugs first —
including the ones where the README claimed something the code didn't do — then
turns claims into evidence (a real test + CI). Ordered by how much each hurt.

### The lesson of this phase: a claim without a test is a liability
The README said "verified 40 concurrent buys never overspend", but there was no
test in the repo. When we finally wrote that test (`server/test/concurrency.test.js`),
it **failed** — and not on cash. Cash was safe (exactly 10 of 40 buys filled, wallet
never negative), but the user's **share count came back 2 instead of 10**. The buy
had a second, un-noticed race. Writing the test is what found it. A claim you can't
run is worse than no claim: an interviewer opens the file and sees the gap.

### #1 — The wallet endpoint was NOT concurrency-safe
`applyTrade()` used the atomic guarded-update pattern, but `POST /api/wallet` still
did the old "read balance → check → save" — the exact race the README said we'd
fixed. Two concurrent withdrawals both read ₹1,000, both pass the check, both write:
₹2,000 out of a ₹1,000 wallet. Fixed by using the same pattern everywhere:
`findOneAndUpdate({ cash: { $gte: amt } }, { $inc: { cash: -amt } })` — the debit
only applies if the balance still covers it, in one indivisible operation.

### The buy-side share race (found by the test, not the audit)
`applyTrade`'s buy path did `findOne(holding) → holding.qty += n → save()`. Under
concurrent buys, several reads see the same qty and the last `save()` overwrites the
others — **lost updates**, silently dropping shares the user paid for. Cash was fine
because it used `$inc`; shares weren't because they used read-modify-write.
Fix = **optimistic concurrency control (compare-and-swap)**: re-read qty, then update
*only if qty is still what we read* (`findOneAndUpdate({ qty: oldQty }, ...)`); if a
racing buy moved it, the update matches nothing and we retry. A brand-new holding is
inserted, and the unique `(userId, symbol)` index turns a create-race into a
duplicate-key error we retry as an update. Takeaway: **any read-modify-write on shared
data is a race** — either `$inc` it or guard it.

### Indexes must exist *before* the concurrency they protect
The test first returned 2 shares even after the CAS fix. Cause: on a fresh DB the
unique index hadn't been built yet (Mongoose builds indexes lazily in the
background), so racing creates made duplicate documents instead of erroring. Because
trade safety now *depends* on that index, the server builds indexes at boot with
`await Account.init(); Holding.init(); Order.init()` before serving traffic.

### #5 / #8 — Order lifecycle: write-ahead + reject failed fills
- **Write-ahead:** the order is now saved as `pending` *before* any money moves, so
  there's always an audit record of intent even if the fill throws. Money moving with
  no order to explain it is the kind of thing you can never reconstruct later.
- **Reject, don't retry forever:** a limit order whose fill failed used to stay
  `pending`, so the producer retried it *every 1.4s forever*, failing every time. Now
  a failed fill is marked `rejected` (new status + `rejectReason`) once and left alone.

### #6 — An unindexed scan running 43×/min
The producer's `Order.find({ status:'pending', type:'limit' })` matched no index, so
Mongo scanned every order in the collection each tick. Added
`index({ status:1, type:1, symbol:1 })` so it walks only the relevant slice.

### #7 — Honest about the non-atomic trade
A trade touches two documents (cash + holding) and they're not in one transaction.
Each write is atomic and guarded (nothing goes negative), but a crash *between* them
can diverge the halves. The proper fix is a Mongo multi-document transaction, which
needs a replica set; the demo runs standalone Mongo. Documented in `trade.js` and the
README rather than pretended away — naming a limitation precisely beats hiding it.

### #9 / #10 / #11 — Failure-path hygiene
- **Null guards** on `Account` reads so a missing account returns a clean 400, not a 500.
- **JSON error handler** (last middleware): Express 5 forwards async throws to a
  default handler that returns an HTML page the JSON client can't read — so every
  error became a generic "Request failed". Now unhandled errors return `{ error }`.
- **Idempotency key release:** if a handler crashed, its key stayed `pending` for its
  full 1-hour TTL and the client's honest retry got "Duplicate request in progress"
  for an hour. Now the key is released on response-finish if no success was stored.

### #20 / #21 — Operational basics
- `/health` now returns 503 if Mongo/Redis aren't connected (it used to always say
  "ok", so a load balancer would keep routing to a broken instance).
- **Graceful shutdown** on SIGTERM/SIGINT: stop the server, halt the tick loop, close
  DB/Redis — so `docker compose down` can't kill us mid-write with dangling timers.

### #3 — Deleted the dead `/api/prices` endpoint
> Correction to Phase 1: the note above says the browser *polls* `GET /api/prices`
> every 1.4s. That stopped being true once live prices moved to a **WebSocket** push.
> `/api/prices` and its client helper were dead code (and undercut the "no polling"
> selling point), so both were removed.

### Evidence: test + CI
`npm test` runs the concurrency test (Vitest). `.github/workflows/ci.yml` spins up
real Mongo + Redis service containers and runs it on every push — so the "40 concurrent
buys" claim is now backed by a green check anyone can re-run, not a sentence.

### Security, performance, simulation, polish (P2–P5)

- **Secrets fail loud:** the server now *crashes at boot* if `JWT_SECRET` is missing
  in production, instead of silently signing tokens with a public fallback string
  anyone could forge.
- **Rate limiter fails closed for auth:** the order limiter still fails *open* (a
  Redis hiccup shouldn't break trading), but the login limiter now fails *closed* —
  if we can't count attempts, we block, so a Redis outage can't unlock brute-force.
- **Security headers** (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`)
  added as a tiny middleware — the helmet essentials without the dependency.
- **Limit-price sanity band:** limit orders must be within 20% of the last price, so a
  fat-fingered "buy at ₹1" can't sit un-fillable in the scan loop.
- **The big bandwidth win (measured, not guessed):** the per-tick payload dropped from
  **~22.4 KB to ~0.8 KB (~96%)** — new clients get one full `snapshot` with history,
  then each tick ships only `{ symbol, price, prevClose, flash }` and the client (and
  gateway-only instances) appends to the history it already holds.
- **Don't refetch the world:** toggling a watchlist star used to refetch cash +
  watchlist + all 12 stocks-with-history + holdings + orders + txns. Now the light
  mutations merge the small response they already return; only a *trade* (which
  changes several things at once) still does a full refresh.
- **Simulation realism:** removed a hidden upward price bias (`random - 0.494`, which
  compounded to ~+29%/day) in favour of symmetric noise + **mean reversion** toward
  each stock's anchor; **prevClose now rolls once per IST trading day** (so "day change"
  isn't "change since server boot"); added an NSE **holiday** check.
- **Verify the audit too:** one flagged item (#25, "market open through 15:30:59") was
  already correct in the code (`minutes < CLOSE_MIN`) — confirmed before "fixing" it.
- **Polish:** shared `round2` in `utils/money.js`; boot-time env validation; `seed.js`
  refuses to run (and drop the DB) under `NODE_ENV=production`.

### Extra loopholes found in a full review pass
- The new `rejected` order status had **no client rendering** (blank chip) — added the
  chip + colour + an Orders filter. *Lesson: a new server enum needs matching client UI.*
- **Money-path idempotency hardening:** after a successful fill, a failure to *record*
  the executed status no longer returns a 5xx (which would release the idempotency key
  and allow a retry to double-fill). Success is returned regardless; the status write is
  a secondary record.
- **Registration race:** two concurrent sign-ups with the same email both passed the
  existence check; the unique index caught the loser as a raw 500 — now a clean 409.
