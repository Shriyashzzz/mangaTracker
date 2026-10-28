# Manga Tracker

**Track what you read. Find what to buy next.**

Manga Tracker is a reading shelf and a US price checker for physical manga, in one web app. Readers keep their place in every series, record the volumes they own, and compare what stores charge for the next volume without opening ten tabs.

**Live:** [mangatracker.xyz](https://mangatracker.xyz/)

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6) ![React](https://img.shields.io/badge/React-19-61dafb) ![Express](https://img.shields.io/badge/Express-5-000000) ![Prisma](https://img.shields.io/badge/Prisma-7-2d3748) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8)

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [API reference](#api-reference)
- [Data model](#data-model)
- [How pricing works](#how-pricing-works)
- [Testing and quality](#testing-and-quality)
- [Deployment](#deployment)
- [Security](#security)
- [Design system](#design-system)
- [Roadmap](#roadmap)
- [Affiliate disclosure](#affiliate-disclosure)

---

## Features

### Reading shelf

- **Chapter bookmarks.** Save the chapter you're on and pick up where you left off.
- **Volumes owned.** Optionally record "own up to Vol. 14". Chapters track the story; volumes track your physical shelf. The app never guesses one from the other.
- **Status and ratings.** Reading or finished, rated out of five stars.
- **Search, filter and sort** across the whole collection, paged in blocks of 30.
- **Prices on the shelf.** Each card shows the lowest price seen for that series, and a manga's page leads with the next volume you need and its price.
- **Synced preferences.** Theme and page background follow the account across devices.

### Price checker

- **Series search** with English titles from AniList as you type.
- **Series pages** listing every English volume, with known prices.
- **Volume pages** with live prices from the stores checked, cheapest first. Color-coded stamps mark the **lowest overall** price, the **cheapest new** copy and the **cheapest marketplace** copy, and every offer is labelled **New print**, **Used**, **Marketplace** or **Ebook**.
- **Price history** for each kind of copy: lowest and highest (with date and store) and median, across every price ever recorded for that volume.
- **Store links** that search six US stores for the exact ISBN.
- **A shelf-aware button:** add the series to your shelf, or mark "I own Vol. 15" in one tap, with undo.
- **A price home** with popular series this season, recent deals and recently checked volumes, plus an A to Z series index with a genre filter.

### Built for manga readers

- A manga visual language: comic lettering, inked panels, screentone and an original mascot.
- Light and dark themes and four page backgrounds.
- Responsive down to a 375px phone.
- Search-engine ready: per-page metadata, structured data, a sitemap of every series and volume, and link previews that work in Discord, iMessage and X.

---

## Architecture

Three running pieces: the **site** (a React single-page app served by a small Express server), the **API** (Express + Prisma) and **PostgreSQL**. Only the site is public. The API sits on a private network, and the site's server forwards every `/api` request to it, so the browser only ever talks to one origin.

```mermaid
flowchart LR
  user([Reader's browser])
  crawler([Search engines<br/>and link previews])

  subgraph site["Site service (client/)"]
    spa["React SPA<br/>built by Vite"]
    edge["server.ts<br/>static files · /api proxy<br/>preview tags · sitemap"]
  end

  subgraph api["API service (server/)"]
    express["Express app"]
    engine["Price engine"]
    orm["Prisma models"]
  end

  db[(PostgreSQL)]

  subgraph ext["External services"]
    anilist["AniList<br/>series data"]
    ol["Open Library<br/>ISBNs · covers"]
    stores["SerpApi · Google Books<br/>eBay · Walmart · Keepa"]
  end

  user -->|"pages, /api/*"| edge
  crawler -->|"pages, sitemap"| edge
  edge -->|"private network"| express
  express --> engine
  express --> orm
  engine --> orm
  orm --> db
  engine --> anilist
  engine --> ol
  engine --> stores
```

### Request pipeline (API)

```mermaid
flowchart LR
  req([request]) --> helmet --> cors --> session["session<br/>(Postgres store)"] --> parsers["JSON / form<br/>parsers"]
  parsers --> router{router}
  router -->|"/api/auth · /api/prefs"| auth[authController]
  router -->|"/api/manga"| guard["requireSignIn<br/>requireOwner"] --> manga[mangaController]
  router -->|"/api/prices"| limit["per-route<br/>rate limit"] --> prices[pricesController]
  router -->|"/sitemap.xml · /robots.txt"| seo[seoController]
  auth & manga & prices & seo -->|"thrown errors"| err[errorHandler]
  err --> res(["JSON { error: [...] }"])
```

Handlers are written as validation chains (express-validator) followed by an async function. Express 5 forwards anything thrown in an async handler to the central `errorHandler`, so handlers carry no try/catch.

### Opening a volume page

The most involved request in the system, and the only one that can spend a paid search:

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant A as GET /api/prices/:isbn
  participant S as Price service
  participant DB as PostgreSQL
  participant OL as Open Library
  participant P as Price providers

  B->>A: /api/prices/9781974746019
  A->>A: validate ISBN, rate limit (30/min)
  A->>S: getVolumePrices(isbn, refresh = not a crawler)
  S->>DB: book stored?
  alt first visit to this volume
    S->>OL: look up the ISBN
    S->>DB: save the book
  end
  S->>DB: last price check
  alt older than 6 hours, and not a crawler
    S->>P: every enabled provider in parallel (8s timeout each)
    P-->>S: offers (failures are logged, not fatal)
    S->>S: drop unbelievable "new" listings
    S->>DB: save the check and every offer (one transaction)
  end
  S->>DB: latest offers + price history
  S-->>B: offers, history, series, sibling volumes, store links
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 8, Zustand, Tailwind CSS 4, Vite |
| Site server | Express 5 on `tsx` (static hosting, API proxy, link-preview tags) |
| API | Node.js 22, Express 5, express-validator, express-session, helmet, zod |
| Data | PostgreSQL 16, Prisma 7 (with the `pg` driver adapter), connect-pg-simple sessions |
| Testing | Jest (SWC) + supertest |
| Language | TypeScript, strict mode, on both sides |
| Hosting | Railway: two services on a private network, plus managed Postgres |

---

## Getting started

### Prerequisites

- **Node.js 22+**
- **PostgreSQL 14+**, from Postgres.app, Homebrew, or Docker (`docker compose up db` inside `server/` starts one on port 5433)

### Install

```bash
git clone https://github.com/Shriyashzzz/mangaTracker.git
cd mangaTracker
npm run install:all          # root, server and client dependencies
```

### Configure

Create `server/.env`:

```dotenv
DATABASE_URL=postgresql://user:password@localhost:5432/mangatracker
SECRET=a-long-random-string
CLIENT_URL=http://localhost:5173
```

Create `client/.env`:

```dotenv
VITE_API_URL=http://localhost:8080
```

The API validates its settings at startup and names any that are missing or malformed.

### Create the database

```bash
cd server
npm run db:deploy            # applies every migration in prisma/migrations
```

### Run

From the repository root:

```bash
npm run dev                  # API on http://localhost:8080, site on http://localhost:5173
```

Price checking works without any store keys: series, volumes and covers come from free sources. Live store prices switch on per provider when its keys are added (see [Configuration](#configuration)).

---

## Configuration

### API (`server/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SECRET` | yes | Session signing secret |
| `CLIENT_URL` | yes in production | The site's origin: allowed by CORS and used for sitemap links |
| `PORT` | no | Defaults to `8080` |
| `ENV` | no | `PROD` turns on secure, cross-subdomain cookies |
| `COOKIE_DOMAIN` | no | Production cookie domain, default `.mangatracker.xyz` |
| `SERPAPI_API_KEY`, `SERPAPI_MONTHLY_LIMIT` | no | Google Shopping prices; the limit (default 250) caps paid searches per month |
| `GOOGLE_BOOKS_API_KEY` | no | Ebook prices from Google Play Books |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | no | eBay listings |
| `WALMART_CONSUMER_ID`, `WALMART_KEY_VERSION`, `WALMART_PRIVATE_KEY` | no | Walmart listings |
| `KEEPA_API_KEY` | no | Amazon prices |
| `AMAZON_ASSOCIATE_TAG`, `BOOKSHOP_AFFILIATE_ID`, `EBAY_CAMPAIGN_ID`, `WALMART_AFFILIATE` | no | Affiliate links |

### Site (`client/`)

| Variable | When | Purpose |
|---|---|---|
| `VITE_API_URL` | build time, development only | The API's address for the browser. Leave it **unset** in production, where requests go to `/api` on the site itself. |
| `API_INTERNAL_URL` | runtime, production | Where the site's server reaches the API, e.g. `http://mangatracker.railway.internal:8080` |
| `PORT` | runtime | Set by the host |

---

## Project structure

```text
.
├── package.json             workspace scripts: dev, build, typecheck, test
├── server/                  the API
│   ├── prisma/              schema.prisma and SQL migrations
│   ├── prisma.config.ts     Prisma config, with a guard against destructive commands on remote databases
│   ├── scripts/             one-off maintenance scripts (dry run by default)
│   ├── Dockerfile           production image: build, migrate, run
│   └── src/
│       ├── server.ts        process entry point
│       ├── app.ts           middleware and routers (imported by tests)
│       ├── config/          validated settings, database pool
│       ├── routes/          URL → controller, per-route rate limits
│       ├── controllers/     validation and responses
│       ├── middlewares/     auth guards, validation, rate limiting, errors
│       ├── models/          all database access
│       ├── prices/          the price engine: catalog, AniList, covers, providers
│       └── tests/           Jest + supertest
└── client/                  the site
    ├── server.ts            production server: static files, /api proxy, preview tags
    ├── index.html           fonts, structured data, theme-before-paint script
    └── src/
        ├── pages/           one folder per page, plus routes.tsx
        ├── components/      shared UI
        ├── layouts/         header and footer
        ├── lib/             API client, types, SEO and formatting helpers
        ├── store/           session state (Zustand)
        └── index.css        Tailwind setup and design tokens
```

---

## API reference

All endpoints live under `/api` and speak JSON. Signed-in requests carry the session cookie (`connect.sid`).

### Authentication and preferences

| Method | Path | Body | Success |
|---|---|---|---|
| `POST` | `/api/auth/signup` | `{ username, password }` | `201`, signed in |
| `POST` | `/api/auth/login` | `{ username, password }` | `200`, signed in |
| `POST` | `/api/auth/logout` | | `200` |
| `GET` | `/api/auth/me` | | `200` if signed in, `401` if not |
| `GET` | `/api/prefs` | | `{ background?, theme? }` |
| `PUT` | `/api/prefs` | `{ background?, theme? }` | the merged preferences |

### Shelf (signed in; routes with `:id` also require ownership)

| Method | Path | Body | Success |
|---|---|---|---|
| `GET` | `/api/manga` | | `{ manga: Manga[] }` |
| `POST` | `/api/manga` | `{ name, status, bookmark?, volumesOwned?, genre?, description?, image? }` | `201 { id }` |
| `GET` | `/api/manga/:id` | | `{ manga }` |
| `PUT` | `/api/manga/:id` | same as `POST` | `204` |
| `DELETE` | `/api/manga/:id` | | `204` |
| `PATCH` | `/api/manga/:id/status` | `{ status }` | `204` |
| `PATCH` | `/api/manga/:id/rating` | `{ rating }` (0 to 5) | `204` |
| `PUT` | `/api/manga/:id/owned` | `{ volumesOwned }` (number or `null`) | `{ volumesOwned }` |
| `GET` | `/api/manga/prices` | | cheapest known price per manga id |
| `GET` | `/api/manga/match?series=` | | the shelf entry for that series, or `null` |

### Prices (public, rate limited per visitor)

| Path | Returns | Limit / min |
|---|---|---|
| `GET /api/prices/series-search?q=` | series typeahead results | 120 |
| `GET /api/prices/search?q=` | volumes by title or ISBN | 40 |
| `GET /api/prices/highlights` | trending series, deals, recent checks | 60 |
| `GET /api/prices/series-index` | every series known | 60 |
| `GET /api/prices/series?name=` | a series and its volumes | 40 |
| `GET /api/prices/:isbn` | a volume's offers, history and context (may refresh prices) | 30 |
| `GET /api/prices/cover/:isbn?size=M\|L` | `302` to the edition's cover image | 600 |
| `GET /api/prices/summary/volume/:isbn` | link-preview data (database only) | 300 |
| `GET /api/prices/summary/series?name=` | link-preview data (database only) | 300 |

Also: `GET /api/health`, `GET /sitemap.xml`, `GET /robots.txt`.

### Errors

Errors are JSON with an `error` array:

```json
{ "error": [{ "msg": "That isn't a valid ISBN", "path": "isbn", "location": "params" }] }
```

| Status | Meaning |
|---|---|
| `400` | Validation failed; one entry per failed rule |
| `401` | Not signed in, or wrong password |
| `403` | The resource belongs to another user |
| `404` | Not found |
| `409` | Username already taken |
| `429` | Rate limited; honor `Retry-After` |
| `502` | An upstream catalog or store failed |
| `500` | Unexpected server error |

The auth guards on shelf routes answer `401`, `403` and `404` with a plain-text status body rather than JSON.

---

## Data model

```mermaid
erDiagram
  users ||--o{ manga : owns
  books ||--o{ price_samples : "priced in"
  books ||--o| price_checks : "last checked"

  users {
    int id PK
    varchar username UK
    text password "bcrypt hash"
    jsonb prefs "theme, background"
  }
  manga {
    int id PK
    int user_id FK
    text name
    bool status "true = finished"
    int bookmark "current chapter"
    smallint volumes_owned
    smallint rating "0-5"
  }
  books {
    char13 isbn13 PK
    text title
    text authors
    text publisher
    smallint year
  }
  price_samples {
    bigint id PK
    char13 isbn13 FK
    varchar store
    varchar format "print / ebook"
    varchar condition "new / used / marketplace"
    int price_cents
    timestamptz fetched_at
  }
  price_checks {
    char13 isbn13 PK
    timestamptz checked_at
    text_array sources
  }
  series_info {
    varchar slug PK
    jsonb info "AniList data"
  }
  edition_covers {
    char13 isbn13 PK
    int cover_id
  }
  api_usage {
    varchar provider PK
    date month PK
    int calls
  }
```

`session` holds express-session data. Every fetched price is kept as a row in `price_samples`; a check and its samples share one timestamp, which is how "the offers from the latest check" is found. Simple reads and writes use Prisma's query builder; statistics that need window functions, `DISTINCT ON` or percentiles use parameterized SQL through `prisma.$queryRaw`.

---

## How pricing works

No single source covers every US volume and price, so several are combined:

| Source | Provides | Cost |
|---|---|---|
| [AniList](https://anilist.co/) | Series names, covers, scores, genres, popularity | Free |
| [Open Library](https://openlibrary.org/) | Every US edition and ISBN, edition covers | Free |
| [SerpApi](https://serpapi.com/) Google Shopping | Prices from many stores in one search | Paid, budgeted monthly |
| [Google Books](https://developers.google.com/books) | Ebook prices | Free key |
| [eBay Browse API](https://developer.ebay.com/) | New and used listings | Key required |
| Walmart (walmart.io) | Walmart.com listings | Key required |
| [Keepa](https://keepa.com/) | Amazon prices | Paid |

**Freshness.** A volume's prices are refreshed when someone opens its page and the last check is more than six hours old. Search engines and link-preview bots are recognized by user agent and only ever see stored prices.

**Trust.** Anyone can list on Google Shopping, so listings are judged before they're stored:

```mermaid
flowchart TD
  L["listing claims a new print copy"] --> R{"a big retailer?<br/>Amazon, Barnes and Noble, Walmart, Target"}
  R -->|yes| K["kept as new"]
  R -->|no| Y{"price below 60% of the yardstick?"}
  Y -->|no| K
  Y -->|yes| D["dropped"]
  Y -.- Z["yardstick: the cheapest big retailer in this check,<br/>else this volume's usual new price,<br/>else $6"]
```

Resale sites (eBay, AbeBooks, World of Books and others) are labelled marketplace; audiobooks and Japanese imports are excluded.

**History.** Each kind of copy (new print, used and marketplace, ebook) gets its own lowest, highest and median, computed from every stored in-stock price. The numbers are derived from the samples on every request, so they can never drift from the underlying data.

**Budget.** Paid searches are claimed atomically from a monthly allowance (`api_usage`), so concurrent requests can't overspend it.

**Adding a provider.** Implement the `Provider` interface (`id`, `store`, `enabled()`, `fetchOffers()`) in `server/src/prices/providers/`, add its keys to the schema in `server/src/config/config.ts`, and register it in `providers/index.ts`.

---

## Testing and quality

```bash
npm run typecheck            # strict TypeScript, server and client
npm test                     # server test suite (no database needed)
cd client && npm run lint    # ESLint
```

Tests focus on where a mistake shows a wrong price or loses money: title matching, ISBN conversion, listing believability, affiliate links, and the API's validation and auth guards. Tests never read `.env`, so real keys can't leak into them.

---

## Deployment

```mermaid
flowchart LR
  internet([Internet]) -->|"https://mangatracker.xyz"| site
  subgraph railway["Railway project"]
    site["Site service<br/>client/ · npm start"]
    api["API service<br/>server/ · Dockerfile"]
    pg[(Postgres)]
    site -->|"API_INTERNAL_URL<br/>private network"| api
    api -->|"postgres.railway.internal"| pg
  end
```

| Service | Build | Start | Key settings |
|---|---|---|---|
| API (`server/`) | its `Dockerfile` | the `Dockerfile` command (migrates, then starts) | `DATABASE_URL`, `SECRET`, `CLIENT_URL`, `ENV=PROD` |
| Site (`client/`) | `npm install && npm run build` | `npm start` | `API_INTERNAL_URL`; no `VITE_API_URL` |

- Database migrations run on every API start (`prisma migrate deploy`), which applies new migrations and does nothing otherwise.
- With a Dockerfile, leave the platform's custom start command empty: it would replace the image's command and run without a shell.
- The API needs no public domain; only the site is exposed.

---

## Security

- **Sessions** are stored in Postgres; the cookie holds only an id, is `HttpOnly`, and is `Secure` in production. Each sign-in issues a fresh session id.
- **Passwords** are hashed with bcrypt (cost 12).
- **Authorization:** every shelf route requires a session, and routes that take an id also check the record belongs to the signed-in user.
- **Input validation** on every route with express-validator; ISBNs are normalized before use.
- **SQL** goes through Prisma or tagged-template queries, so values are always sent as parameters.
- **Headers** from helmet; CORS allows only the configured site origin.
- **Rate limits** per visitor on every public price route.
- **Configuration** is validated with zod at startup.
- **Database safety:** destructive Prisma commands (`migrate reset`, `migrate dev`, `db push`) refuse to run against a non-local database.

---

## Design system

All styling is Tailwind CSS 4, configured in `client/src/index.css`:

- **Tokens** (`--paper`, `--ink`, `--accent`, the stamp colors) are CSS variables that switch for dark mode and become classes such as `bg-paper`, `text-ink` and `border-line`.
- **Type:** Bangers for display lettering, Comic Neue for speech bubbles, Fraunces for headlines, IBM Plex for body text and data.
- **Breakpoints** are written desktop first and overridden with inclusive max-width variants (`upto-720:`, `upto-560:` and so on).
- **Manga utilities** such as `screentone`, `speed-burst` and `caption-box` are ordinary classes.
- Larger pages keep their classes in typed class maps next to the page (`pages/*/styles.ts`), so markup stays readable.

---

## Roadmap

- [x] Reading shelf: chapters, status, ratings, filters
- [x] Session authentication backed by PostgreSQL
- [x] Price checker: series and volume pages, live prices, history
- [x] Volumes owned, shelf prices and a shelf-aware buy button
- [x] SEO: sitemap, structured data, readable URLs, link previews
- [x] Price stamps and per-kind price history
- [ ] Live eBay listings from eBay's own API, including used copies (eBay prices currently arrive through Google Shopping)
- [ ] More price sources, especially Amazon (access to live Amazon prices opens after the first affiliate sales)
- [ ] Scheduled price refreshes and price-drop alerts for volumes on your shelf, using Redis, BullMQ and an email newsletter via Resend

---

## Affiliate disclosure

Some store links are affiliate links (Amazon, Bookshop.org, eBay, and Walmart once approved). Buying through them may earn Manga Tracker a commission at no extra cost to you, which helps keep the site running. Affiliate links are marked `rel="sponsored"` and disclosed on the pages where they appear.

## Why I built it

I wanted one place to keep my place in every series I read. Then I kept opening ten tabs to find the next volume at a fair price, so the price checker followed. The goal is a tool that knows both what you've read and what you own, so buying the next volume takes one look.

---

Built by [Shriyash Ghimire](https://github.com/Shriyashzzz).
