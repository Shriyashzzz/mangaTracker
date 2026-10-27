# Manga Tracker

**Track what you read. Find what to buy next.**

Manga Tracker is a reading shelf and a US price checker for physical manga, in one app. Keep your place in every series you read, record the volumes you own, and see what stores charge for the next one without opening ten tabs.

**Live:** [mangatracker.xyz](https://mangatracker.xyz/) · **Code:** [github.com/Shriyashzzz/mangaTracker](https://github.com/Shriyashzzz/mangaTracker)

> **Status: v2, TypeScript rewrite.** Same app, rebuilt on TypeScript, Prisma and Tailwind. The shelf is solid. Price coverage is still the work in progress: prices come from a few sources today, and price history is thin while data builds up.

---

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture) (diagrams)
- [Where things live](#where-things-live)
- [The API](#the-api)
- [The database](#the-database)
- [How prices work](#how-prices-work)
- [Running it locally](#running-it-locally)
- [Testing and checks](#testing-and-checks)
- [Deploying](#deploying), including [moving from v1](#moving-production-from-v1-to-v2-one-time)
- [Design system](#design-system)
- [How the styles are organized](#how-the-styles-are-organized)
- [Engineering notes](#engineering-notes)
- [Roadmap](#roadmap)

---

## What it does

### Your shelf

- **Chapter bookmarks:** save the chapter you're on and pick up where you left off.
- **Volumes you own:** optionally record "own up to Vol. 14". Chapters say where you are in the story; volumes say what's on your physical shelf. The app never guesses one from the other.
- **Status and ratings:** reading or finished, rated out of 5 stars.
- **Search, filter and sort** across your whole collection.
- **Prices on the shelf:** each card shows the lowest price we've seen for that series, and a manga's page shows the next volume you need with its price.
- **Your account, any device:** sign in and your shelf, theme and background follow you.

### Price checker

- **Series search** with English titles from AniList, as you type.
- **Series pages** listing every English volume, with known prices.
- **Volume pages** with live prices from the stores we check (cheapest first), "Lowest price" and "Low New print" badges, links to search six US stores for that exact ISBN, and price history (all-time low/high with dates, average, median, number of changes).
- **A shelf-aware button:** add the series to your shelf, or mark "I own Vol. 15" in one tap, with undo.
- **The price home:** popular series this season, recent deals and recently checked volumes.
- **An A to Z series index** at `/series`, with a genre filter.

### Made for manga readers

- A manga visual style: comic lettering, inked panels, screentone and an original mascot.
- Light and dark themes, plus four page backgrounds.
- Works on phones down to iPhone SE width.
- Shared links preview properly in Discord, iMessage and X.

---

## Architecture

Three running pieces: the **site** (React, built by Vite and served by a small Express server), the **API** (Express + Prisma), and **PostgreSQL**. The API also talks to free and paid outside services for catalog data and prices.

```mermaid
flowchart LR
  user([Reader's browser])
  crawler([Search engines<br/>and link previews])

  subgraph site["client/ — the site"]
    spa["React app<br/>(src/, built by Vite)"]
    preview["server.ts<br/>serves the build,<br/>writes preview tags"]
  end

  subgraph api["server/ — the API"]
    express["Express app<br/>(src/app.ts)"]
    prices["Price engine<br/>(src/prices/)"]
    prisma["Prisma client<br/>(src/models/)"]
  end

  db[(PostgreSQL)]

  subgraph outside["Outside services"]
    anilist["AniList<br/>series info (free)"]
    openlib["Open Library<br/>ISBNs, covers (free)"]
    serp["SerpApi Google Shopping<br/>prices (paid, budgeted)"]
    others["eBay · Walmart · Keepa<br/>Google Books (by key)"]
  end

  user -->|pages| preview
  crawler -->|pages, sitemap| preview
  preview -->|"summary + sitemap<br/>(DB only, never paid)"| express
  user -->|"fetch /api/* with<br/>session cookie"| express
  express --> prices
  express --> prisma
  prices --> prisma
  prisma --> db
  prices --> anilist
  prices --> openlib
  prices --> serp
  prices --> others
```

### What happens when someone opens a volume page

This is the most involved request in the app, and the only one that can spend a paid search.

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant A as API: GET /api/prices/:isbn
  participant S as prices/service.ts
  participant DB as PostgreSQL
  participant OL as Open Library
  participant P as Price providers

  B->>A: /api/prices/9781974749485
  A->>A: validate + normalize ISBN (rate limit: 30/min)
  A->>S: getVolumePrices(isbn, refresh = not a crawler)
  S->>DB: book stored?
  alt first time anyone opens it
    S->>OL: look up the ISBN
    OL-->>S: title, authors, publisher
    S->>DB: save book
  end
  S->>DB: last price check
  alt older than 6 hours (and not a crawler)
    S->>P: every enabled provider at once (8s timeout each)
    P-->>S: offers (failures are logged, not fatal)
    S->>DB: save check + every offer (one transaction)
  end
  S->>DB: latest offers, all-time stats
  S->>S: series + sibling volumes (cached 12h), affiliate links
  S-->>A: one JSON payload
  A-->>B: offers, stats, series, store links
```

### Request lifecycle inside the API

```mermaid
flowchart LR
  req([request]) --> helmet --> cors --> session["session<br/>(Postgres store)"] --> body["JSON / form<br/>parsers"]
  body --> router{router}
  router -->|/api/auth, /api/prefs| auth[authController]
  router -->|/api/manga| guard["requireSignIn<br/>requireOwner"] --> manga[mangaController]
  router -->|/api/prices| limit[rateLimit] --> pricesC[pricesController]
  router -->|/sitemap.xml, /robots.txt| seo[seoController]
  auth & manga & pricesC & seo -->|thrown errors| err[errorHandler]
  err --> res(["JSON { error: [{ msg }] }"])
```

Every error the client sees has the same shape, `{ "error": [{ "msg": "..." }] }`, whether it comes from validation (400), auth (401/403), a missing record (404), a taken username (409), a rate limit (429) or an outside service (502). Express 5 forwards errors thrown in async handlers to `errorHandler` automatically, so handlers don't need try/catch.

---

## Where things live

```text
.
├── package.json              root scripts: run both halves, typecheck, test
├── server/                   the API
│   ├── prisma/
│   │   ├── schema.prisma     every table, mapped onto the v1 table names
│   │   └── migrations/       0_init = the v1 database; later ones on top
│   ├── prisma.config.ts      where Prisma finds the schema and DATABASE_URL
│   ├── src/
│   │   ├── server.ts         starts listening (that's all)
│   │   ├── app.ts            middleware + routers; imported by tests
│   │   ├── config/
│   │   │   ├── config.ts     reads + validates .env with zod, fails fast
│   │   │   └── prisma.ts     one pg Pool shared by Prisma and sessions
│   │   ├── routes/           URL -> controller, plus per-route rate limits
│   │   ├── controllers/      validation (express-validator) + responses
│   │   ├── middlewares/      auth guards, validation, rate limit, errors
│   │   ├── models/           all database access (Prisma + raw SQL)
│   │   ├── prices/           the price engine (see below)
│   │   ├── errors/           AppError and friends
│   │   ├── types/            Express + session type additions
│   │   └── tests/            Jest + supertest
│   ├── Dockerfile            production image (build, migrate, run)
│   └── compose.yaml          local Postgres in one command
└── client/                   the site
    ├── index.html            fonts, theme-before-paint script, Impact script
    ├── server.ts             production server: static files + preview tags
    ├── vite.config.ts        React + Tailwind plugins, builds robots.txt
    └── src/
        ├── main.tsx          mounts the router
        ├── App.tsx           page frame: backdrop, header, page, footer
        ├── index.css         Tailwind setup + the manga design tokens
        ├── store/auth.ts     who's signed in (zustand)
        ├── lib/              API calls, types, prices, SEO, prefs helpers
        ├── layouts/          Header, Footer
        ├── components/       shared pieces: cards, stars, menu, mascot...
        ├── pages/            one folder per page (see routes.tsx)
        └── styles/           backdrop.css + class maps shared by pages
```

### The price engine (`server/src/prices/`)

| File                             | Job                                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `service.ts`                     | The orchestrator. Every price route calls one function here. Owns the 6-hour refresh rule and the in-memory caches.  |
| `catalog.ts`                     | Open Library search and ISBN lookup. Keeps US English editions, translates Japanese-only titles, drops light novels. |
| `anilist.ts`                     | Series info (cached a week in `series_info`), typeahead search, trending, Japanese to English names.                 |
| `covers.ts`                      | Finds each edition's cover once, in batches of 40, backing off when Open Library throttles.                          |
| `match.ts`                       | Decides whether a shop listing is the same volume: same series words, same number, not a box set.                    |
| `providers/*.ts`                 | One file per price source. Each switches on when its keys are in `.env`.                                             |
| `storeLinks.ts`, `affiliates.ts` | Store search links and affiliate tracking.                                                                           |
| `crawlers.ts`                    | Recognizes bots, so they never trigger a paid refresh.                                                               |

### Pages (`client/src/pages/routes.tsx`)

| URL                            | Page                                                  | Signed in? |
| ------------------------------ | ----------------------------------------------------- | ---------- |
| `/`                            | `Prices/PriceSearch` — price home, series search      | no         |
| `/series`                      | `Prices/SeriesIndex` — A to Z of every series         | no         |
| `/prices/series/:slug`         | `Prices/PriceSeries` — every volume of a series       | no         |
| `/prices/:isbn/:slug?`         | `Prices/PriceVolume` — one volume's prices            | no         |
| `/shelf`                       | `Home/Home` — your shelf (guest hero when signed out) | yes        |
| `/details/:id`                 | `Details/Details` — one manga, rating, buy strip      | yes        |
| `/add`, `/update/:id`          | `AddManga`, `UpdateManga` — the forms                 | yes        |
| `/signin`, `/signup`, `/about` | auth pages, about                                     | no         |

---

## The API

Base URL: `http://localhost:8080` in development. Requests with a session send the `connect.sid` cookie (`credentials: "include"` on the client).

### Auth and preferences

| Method    | Path               | Body                      | Returns                                   |
| --------- | ------------------ | ------------------------- | ----------------------------------------- |
| POST      | `/api/auth/signup` | `{ username, password }`  | 201, signed in · 409 if taken             |
| POST      | `/api/auth/login`  | `{ username, password }`  | 200 · 401 wrong password · 404 no account |
| POST      | `/api/auth/logout` |                           | 200                                       |
| GET       | `/api/auth/me`     |                           | 200 signed in · 401 not                   |
| GET / PUT | `/api/prefs`       | `{ background?, theme? }` | the stored prefs                          |

### The shelf (signed in; `:id` routes also check you own it)

| Method | Path                       | Body                                                                       | Returns                                      |
| ------ | -------------------------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| GET    | `/api/manga`               |                                                                            | `{ manga: Manga[] }`                         |
| POST   | `/api/manga`               | `{ name, status, bookmark?, volumesOwned?, genre?, description?, image? }` | 201 `{ id }`                                 |
| GET    | `/api/manga/:id`           |                                                                            | `{ manga }`                                  |
| PUT    | `/api/manga/:id`           | same as POST                                                               | 204                                          |
| DELETE | `/api/manga/:id`           |                                                                            | 204                                          |
| PATCH  | `/api/manga/:id/status`    | `{ status }`                                                               | 204                                          |
| PATCH  | `/api/manga/:id/rating`    | `{ rating: 0-5 }`                                                          | 204                                          |
| PUT    | `/api/manga/:id/owned`     | `{ volumesOwned: number \| null }`                                         | `{ volumesOwned }`                           |
| GET    | `/api/manga/prices`        |                                                                            | cheapest known price per manga id            |
| GET    | `/api/manga/match?series=` |                                                                            | the shelf manga that is this series, or null |

### Prices (public, rate limited per visitor)

| Path                                    | What                              | Per minute |
| --------------------------------------- | --------------------------------- | ---------- |
| `GET /api/prices/series-search?q=`      | typeahead                         | 120        |
| `GET /api/prices/search?q=`             | volumes by title or ISBN          | 40         |
| `GET /api/prices/highlights`            | home page rows                    | 60         |
| `GET /api/prices/series-index`          | every series we know              | 60         |
| `GET /api/prices/series?name=`          | one series and its volumes        | 40         |
| `GET /api/prices/:isbn`                 | one volume's prices (may refresh) | 30         |
| `GET /api/prices/cover/:isbn?size=M\|L` | redirect to the cover image       | 600        |
| `GET /api/prices/summary/volume/:isbn`  | link-preview data, DB only        | 300        |
| `GET /api/prices/summary/series?name=`  | link-preview data, DB only        | 300        |

Plus `GET /api/health`, `GET /sitemap.xml` and `GET /robots.txt`.

> **Changed from v1:** shelf routes moved from `/details/:id`, `/update/:id`, `/add`, `/api/mangadata` to `/api/manga/*`; auth moved from `/login`, `/signup`, `/logout`, `/api/me` to `/api/auth/*` (logout is now POST). Manga fields are camelCase (`volumesOwned`, `userId`), and the rating body is `{ rating }` instead of `{ newRating }`. The client in this repo already uses the new routes.

---

## The database

Defined in `server/prisma/schema.prisma`. The model names are Prisma-style (`PriceSample`), but `@@map` keeps the v1 table and column names (`price_samples.price_cents`), so the existing production database is used as it is.

```mermaid
erDiagram
  users ||--o{ manga : "owns"
  books ||--o{ price_samples : "priced in"
  books ||--o| price_checks : "last checked"

  users {
    int id PK
    varchar username UK
    text password "bcrypt hash"
    jsonb prefs "background, theme"
  }
  manga {
    int id PK
    int user_id FK
    text name
    varchar genre
    text description
    text image "cover URL"
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
    text cover_url
    smallint year
  }
  price_samples {
    bigint id PK
    char13 isbn13 FK
    varchar store
    varchar format "print / ebook"
    varchar condition "new / used / marketplace"
    int price_cents
    bool in_stock
    text url
    timestamptz fetched_at
  }
  price_checks {
    char13 isbn13 PK
    timestamptz checked_at "same instant as its samples"
    text_array sources
  }
  series_info {
    varchar slug PK
    jsonb info "AniList answer, cached a week"
    timestamptz fetched_at
  }
  edition_covers {
    char13 isbn13 PK
    int cover_id "null = has none"
  }
  api_usage {
    varchar provider PK
    date month PK
    int calls "monthly paid-API budget"
  }
  session {
    varchar sid PK
    json sess
    timestamp expire
  }
```

**Prisma or raw SQL?** Simple reads and writes use Prisma's query builder. The price statistics need window functions, `DISTINCT ON` and percentiles, which Prisma can't express, so those stay SQL inside `prisma.$queryRaw` tagged templates (values are always sent as parameters, never pasted into the SQL). They're all in `server/src/models/priceQueries.ts`.

**A check and its samples share one timestamp.** `saveCheck` writes the check and every offer with the same `Date`, in one transaction. "The offers from the latest check" is then a plain equality join, which several queries rely on.

---

## How prices work

Unfotunately, no single source has every US volume and every price, so the app combines several including but not lmited to :

| Source                                              | What it gives us                                 | Status                 |
| --------------------------------------------------- | ------------------------------------------------ | ---------------------- |
| [AniList](https://anilist.co/)                      | Series names, covers, scores, genres, popularity | Live, free             |
| [Open Library](https://openlibrary.org/)            | Every US edition and its ISBN, edition covers    | Live, free             |
| [SerpApi](https://serpapi.com/) Google Shopping     | Prices from many stores in one search            | Live, monthly budget   |
| [Google Books](https://developers.google.com/books) | Ebook prices from Google Play Books              | Needs an API key       |
| [eBay Browse API](https://developer.ebay.com/)      | New and used listings by ISBN                    | Built, waiting on keys |
| Walmart (walmart.io)                                | Walmart.com listings                             | Built, untested        |
| [Keepa](https://keepa.com/)                         | Amazon prices                                    | Built, untested (paid) |

- **Prices are refreshed when a volume is opened,** at most every 6 hours, and every check is saved. Price history comes from those saved checks.
- **Paid searches are budgeted** (`SERPAPI_MONTHLY_LIMIT`, 250 by default), and crawlers never trigger one.
- **"Lowest" means lowest among the stores we check,** and the site says so.

**Adding a price source:** write `server/src/prices/providers/yourstore.ts` implementing the `Provider` interface from `prices/types.ts` (`id`, `store`, `enabled()`, `fetchOffers()`), add its keys to the zod schema in `config/config.ts`, and list it in `providers/index.ts`.

---

## Running it locally

You'll need **Node.js 22+** and **PostgreSQL** (Postgres.app, Homebrew, or `docker compose up db` inside `server/`).

```bash
git clone https://github.com/Shriyashzzz/mangaTracker.git
cd mangaTracker
npm run install:all
```

**1. API settings:** create `server/.env`:

```dotenv
DATABASE_URL=postgresql://user:password@localhost:5432/mangatracker
SECRET=any-long-random-string
CLIENT_URL=http://localhost:5173
```

The server checks these at startup and tells you exactly which one is missing or wrong.

**2. Database:**

```bash
cd server
npm run db:deploy      # creates every table from prisma/migrations
```

Already have a v1 database locally? Run `npm run db:baseline` once first instead (see [moving from v1](#moving-production-from-v1-to-v2-one-time)), then `npm run db:deploy`.

**3. Site settings:** create `client/.env` with `VITE_API_URL=http://localhost:8080`.

**4. Run both halves** from the repo root:

```bash
npm run dev            # API on :8080, site on :5173
```

### Optional settings (`server/.env`)

| Setting                                                             | Turns on                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| `SERPAPI_API_KEY`, `SERPAPI_MONTHLY_LIMIT`                          | Google Shopping prices                                  |
| `GOOGLE_BOOKS_API_KEY`                                              | Ebook prices                                            |
| `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`                              | eBay listings                                           |
| `WALMART_CONSUMER_ID`, `WALMART_KEY_VERSION`, `WALMART_PRIVATE_KEY` | Walmart listings                                        |
| `KEEPA_API_KEY`                                                     | Amazon prices                                           |
| `AMAZON_ASSOCIATE_TAG`, `BOOKSHOP_AFFILIATE_ID`, `EBAY_CAMPAIGN_ID` | Affiliate links                                         |
| `WALMART_AFFILIATE=on`                                              | Marks Walmart links as affiliate (once Impact approves) |
| `ENV=PROD`, `COOKIE_DOMAIN`                                         | Production cookies (`.mangatracker.xyz` by default)     |

### Handy commands (`server/`)

| Command               | Does                                                             |
| --------------------- | ---------------------------------------------------------------- |
| `npm run dev`         | API with reload (tsx watch)                                      |
| `npm run db:migrate`  | after editing `schema.prisma`: makes and applies a new migration |
| `npm run db:studio`   | browse the database in Prisma Studio                             |
| `npm run db:generate` | rebuild the Prisma client (also part of `npm run build`)         |
| `npx tsx scripts/copyPriceData.ts --from <url> [--to <url>] [--apply]` | copies volumes, prices and series info between databases (dry run unless `--apply`) |

---

## Testing and checks

```bash
npm run typecheck      # server + client, strict TypeScript
npm test               # server Jest suite (no database needed)
cd client && npm run lint
```

The tests cover the parts where a mistake shows a wrong price or loses money: title matching (`match.test.ts`), ISBN conversion (`catalog.test.ts`), affiliate links (`storeLinks.test.ts`), and the API's validation and auth guards (`app.test.ts`). They never read your `.env`, so real keys can't leak into them.

---

## Deploying

Two Railway services. Only the site is public: the API sits on Railway's private network, and the site's server (`client/server.ts`) passes every `/api` request on to it, so the browser only ever talks to `mangatracker.xyz`.

| Service          | Build                                | Start                                        | Settings                                                                       |
| ---------------- | ------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------ |
| API (`server/`)  | none (its `Dockerfile` builds it)    | none (the `Dockerfile` migrates, then starts) | `DATABASE_URL`, `SECRET`, `CLIENT_URL`, `ENV=PROD`, plus any optional settings |
| Site (`client/`) | `npm install && npm run build`       | `npm start`                                  | `API_INTERNAL_URL=http://mangatracker.railway.internal:8080`, and **no** `VITE_API_URL` |

- Leave the API's custom build, pre-deploy and start commands empty. With a Dockerfile, Railway runs a custom start command without a shell, so `npm run db:deploy && npm start` only migrates and then exits.
- `VITE_API_URL` is baked into the JavaScript the browser runs, so it must be empty in production (calls then go to `/api` on the site). Never set it to a `.railway.internal` address: browsers can't reach those. Locally it stays `http://localhost:8080`.
- The API needs no public domain. `db:deploy` applies any new migrations and does nothing when there are none, so it's safe on every start.

### Moving production from v1 to v2 (one time)

The v1 tables already exist, so Prisma must be told not to create them again. **Do this once, before the first v2 deploy:**

```bash
cd server
DATABASE_URL="<production url>" npm run db:baseline   # marks 0_init as already applied
DATABASE_URL="<production url>" npm run db:deploy     # adds only what's new (an index on manga.user_id)
```

`db:deploy` also runs `v1_catch_up`, which creates anything an older v1 database is missing (for example `edition_covers` on a database made before covers were cached). It only uses `IF NOT EXISTS`, so it's a no-op on an up-to-date database.

> **Guarded:** `prisma migrate reset`, `migrate dev` and `db push` refuse to run unless `DATABASE_URL` is on localhost (see `server/prisma.config.ts`). Keep the production URL out of `server/.env`; it belongs in Railway's settings.
>
> **Don't run `npm run db:migrate` (`prisma migrate dev`) against a v1 database** that has tables the schema doesn't know about (a local database from the `feat/feedback` branch has `feedback`): it treats them as drift and offers to reset the whole database. `db:deploy` never drops anything.

This was rehearsed on a copy built from the v1 SQL: after baselining, Prisma reports zero differences between the schema and the database. Existing accounts, sessions, shelves and price history carry over untouched; signed-in users stay signed in.

---

## Design system

The manga look is unchanged from v1; v2 moves all of it into Tailwind v4 (there's no `tailwind.config.js`; v4 is configured in CSS). Everything shared lives in `client/src/index.css`:

- **Tokens** (`--paper`, `--ink`, `--accent`, ...) are CSS variables that swap for dark mode and for `.printed` panels (always ink on paper).
- **Tailwind theme:** those tokens become classes: `bg-paper`, `bg-card`, `text-ink`, `text-ink-soft`, `text-muted`, `border-line`, `border-line-soft`, `text-accent`, `bg-accent-wash`, `shadow-ink`, `shadow-ink-lg`, `font-brand` (Bangers), `font-letter` (Comic Neue), `font-display` (Fraunces), `font-hand` (Caveat), `max-w-page`, `ease-ink`, `rounded-ink`.
- **Breakpoints:** `upto-860:`, `upto-760:`, `upto-720:`, `upto-560:`, `upto-520:`, `upto-480:` (`max-width`, inclusive, matching v1 exactly) and `short-laptop:` (wide but short screens, so the add form fits without scrolling). Write desktop first, then override with these.
- **Manga utilities** (use like any class): `screentone`, `speed-burst`, `focus-lines`, `cover-lines`, `squiggle` (hand-drawn underline), `caption-box`, `bubble-tail-up`, `bubble-tail-mascot`, `tick-corner`, `select-chevron`, `px-gutter`.
- **Animations:** `animate-card-in`, `animate-panel-open`, `animate-panel-in`, `animate-quote-in`, `animate-drop`.
- **Components:** `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-sm/lg/block`, `.icon-btn`, `.skeleton`, `.fade-in`, `.mascot-spot`.
- **Dark mode:** `dark:` variants follow `<html data-theme="dark">`, which the settings menu sets. Most pages never need them: the color classes already switch.

Example, from `layouts/Footer/Footer.tsx`:

```tsx
<footer className="screentone mt-auto bg-ink text-paper">
```

---

## How the styles are organized

There are no CSS modules left. Small components keep their classes inline in the JSX. Pages with many elements keep them in a **class map** beside the page, a typed object of Tailwind strings, so the JSX stays readable and one change restyles every place that uses it:

| Class map                 | Used by                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `pages/Prices/styles.ts`  | every price page, `VolumeCard`, `SeriesCard`, `ShelfAction`, `SeriesSearchBox`, `SeriesFacts` |
| `pages/Home/styles.ts`    | the shelf and the guest landing                                                               |
| `pages/Details/styles.ts` | a manga's page and `BuyStrip`                                                                 |
| `pages/About/styles.ts`   | about page                                                                                    |
| `styles/auth.ts`          | sign in / up, `AuthArt`, `PasswordInput`                                                      |
| `styles/form.ts`          | add / edit                                                                                    |

```tsx
import { detailsStyles as styles } from "./styles";
<h1 className={styles.title}>{manga.name}</h1>;
```

Three rules keep it working (each one bit during the port):

1. **Write every class out in full.** Tailwind only generates classes it can read in the source; a class assembled in code (`"text-" + size`) gets no CSS.
2. **Don't put two utilities for the same property on one element** (say `min-h-[150px]` and `min-h-[170px]`); which one wins isn't up to the order you wrote them in. Give the variant its own complete string instead, like `panel` and `panelWide` in `pages/Home/styles.ts`.
3. **Use arbitrary sizes (`text-[0.9rem]`), not Tailwind's named ones (`text-sm`).** The named sizes also set a line-height, and the design relies on the page's 1.6.

The port was checked by screenshotting every page in v1 and v2 at laptop, short laptop, 720/760/860px and iPhone SE widths, in light and dark, signed in and out, plus the open menus, form errors and empty states. They match pixel for pixel; the deliberate changes are listed under "What v2 changed".

---

## Engineering notes

**Rate limits are the real constraint.** A burst of about 40 lookups once got the server blocked by Open Library. So cover lookups are batched (one request answers up to 40 ISBNs), saved in Postgres, back off when told to slow down, and the page retries a waiting cover before falling back to the series cover and then a drawn placeholder.

**Postgres does the caching.** Series info, edition covers and every price check live in the database, which is why Redis isn't needed yet: it only becomes worth adding with more than one server or background jobs.

**Crawlers can cost money.** Opening a volume can start a paid search, and the sitemap invites search engines to open every volume. Crawlers are recognized by User-Agent and only ever see stored prices.

**SEO without server-side rendering.** Every page sets its own title, description, canonical URL and structured data; the API builds a sitemap of every series and volume; volume URLs carry the title; and `client/server.ts` writes each page's preview tags into the HTML for link previews and crawlers that don't run JavaScript.

**Sessions across two origins.** The site and API are separate services, so cookies need credentialed CORS, `SameSite=None; Secure` in production, a shared cookie domain, and Express trusting Railway's proxy. v2 also gives each sign-in a fresh session id.

**Config fails fast.** `server/src/config/config.ts` validates every setting with zod at startup, so a typo in `.env` is an error naming the setting, not a crash later.

### What v2 changed beyond the port

- Duplicate usernames now get a clear 409 instead of a server error.
- Non-numeric manga ids are a 404 instead of a crash; another user's manga is a 403.
- Visiting `/add` directly no longer bounces signed-in users to the error page before their session has loaded; signed-out visitors go to sign in and come back.
- The volume page's "Lowest price" badge works again (it compared against `NaN`).
- `helmet` security headers, an index on `manga.user_id`, `/api/health` for uptime checks.
- The volume page carries the copy and badge tweaks that were in progress on `main`: "Low New print", a bigger badge, an italic affiliate note.

---

## Roadmap

- [x] Reading shelf: chapters, status, ratings, filters
- [x] Session auth with PostgreSQL
- [x] Price checker: series and volume pages, live prices, history
- [x] Volumes owned, shelf prices and a shelf-aware buy button
- [x] SEO: sitemap, structured data, readable URLs, link previews
- [x] TypeScript, Prisma, Tailwind (v2), every style in Tailwind
- [ ] Live eBay listings from it's own api, including used copies, currently live ebay lisitng's are taken from google books api
- [ ] More price sources, especially Amazon, unforntuately, I'll only get access to live amazon prices after 10 affiliate buys
- [ ] Price-drop alerts for volumes on your shelf, I am working on building a newsletter using resend, bullmq and redis for that, but that'll be live only after my core build is finished.

## Affiliate disclosure

Some store links are affiliate links (Amazon, Bookshop.org, eBay, and Walmart once approved). Buying through them may earn Manga Tracker a commission at no extra cost to you, which helps keep the site running. Affiliate links are marked `rel="sponsored"` and disclosed on the pages where they appear.

## Why I built it

I wanted one place to keep my place in every series I read. Then I kept opening ten tabs to find the next volume at a fair price, so the price checker followed. The goal is a tool that knows both what you've read and what you own, so buying the next volume takes one look.

---

Built by [Shriyash Ghimire](https://github.com/Shriyashzzz).
