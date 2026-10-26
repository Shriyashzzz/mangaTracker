# Manga Tracker

**Track what you read. Find what to buy next.**

Manga Tracker is a reading shelf and a US price checker for physical manga, in one app. Keep your place in every series you read, record the volumes you own, and see what stores charge for the next one without opening ten tabs.

**Live:** [mangatracker.xyz](https://mangatracker.xyz/) · **Code:** [github.com/Shriyashzzz/mangaTracker](https://github.com/Shriyashzzz/mangaTracker)

> **Status: early.** The shelf is solid. Price coverage is the work in progress: prices come from a few sources today, and price history is still thin while data builds up.

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
- **Volume pages** with:
  - live prices from the stores we check, cheapest first;
  - "Lowest price" and "Lowest new print" badges, each claiming only what it says;
  - links to search Amazon, Barnes & Noble, Bookshop.org, Walmart, eBay and Books-A-Million for that exact ISBN;
  - price history: all-time low and high with dates, average, median and how often the price changed.
- **A shelf-aware button:** add the series to your shelf, or mark "I own Vol. 15" in one tap, with undo.
- **The price home:** popular series this season, recent deals (volumes cheaper than their own average) and recently checked volumes.
- **An A to Z series index** at `/series`, with a genre filter.

### Made for manga readers

- A manga visual style: comic lettering, inked panels, screentone and an original mascot.
- Light and dark themes, plus four page backgrounds to choose from.
- Works on phones down to iPhone SE width.
- Shared links preview properly in Discord, iMessage and X, with the volume's title, price and cover.

## How prices work

No single source has every US volume and every price, so the app combines several:

| Source                                              | What it gives us                                 | Status                 |
| --------------------------------------------------- | ------------------------------------------------ | ---------------------- |
| [AniList](https://anilist.co/)                      | Series names, covers, scores, genres, popularity | Live, free             |
| [Open Library](https://openlibrary.org/)            | Every US edition and its ISBN, edition covers    | Live, free             |
| [SerpApi](https://serpapi.com/) Google Shopping     | Prices from many stores in one search            | Live, monthly budget   |
| [Google Books](https://developers.google.com/books) | Ebook prices from Google Play Books              | Needs an API key       |
| [eBay Browse API](https://developer.ebay.com/)      | New and used listings by ISBN                    | Built, waiting on keys |
| Walmart (walmart.io)                                | Walmart.com listings                             | Built, untested        |
| [Keepa](https://keepa.com/)                         | Amazon prices                                    | Built, untested (paid) |

Each price source switches on when its keys are set, and is skipped otherwise.

- **Prices are refreshed when a volume is opened,** at most every 6 hours, and every check is saved. Price history comes from those saved checks.
- **Paid searches are budgeted** (`SERPAPI_MONTHLY_LIMIT`, 250 by default), and search engines crawling the site never trigger one.
- **"Lowest" means lowest among the stores we check,** and the site says so. It isn't a promise of the cheapest price anywhere.

## Tech stack

| Layer       | Technology                                                      |
| ----------- | --------------------------------------------------------------- |
| Frontend    | React 19, React Router, Vite, CSS Modules                       |
| Site server | Express (serves the build and fills in link-preview tags)       |
| API         | Node.js, Express 5, express-validator                           |
| Database    | PostgreSQL (`pg`, plain parameterized SQL)                      |
| Auth        | express-session, connect-pg-simple, bcryptjs, HTTP-only cookies |
| Hosting     | Railway (site and API as separate services)                     |

## Engineering notes

**Rate limits are the real constraint.** A burst of about 40 lookups got the server temporarily blocked by Open Library. Since then:

- Cover lookups are **batched**: one request answers up to 40 ISBNs.
- Lookups are **saved in Postgres**, so restarts and deploys don't start over.
- The app **backs off** when an API says slow down.
- The page **retries** a cover that's waiting, and falls back to the series cover from AniList, then to a drawn placeholder.

**Postgres does the caching.** Series info, edition covers and every price check live in the database. That's why Redis isn't needed yet: it only becomes worth adding with more than one server or background job queues.

**Crawlers can cost money.** Opening a volume can start a paid price search, and the sitemap invites search engines to open every volume. Crawlers are recognized by their User-Agent and only ever see stored prices.

**SEO without server-side rendering.**

- Every page sets its own title, description, canonical URL and structured data (Product/Book with price ranges, BookSeries, breadcrumbs).
- The API serves a sitemap of every series and volume.
- Volume URLs carry the title (`/prices/9781974749485/jujutsu-kaisen-vol-24`).
- A small Express server in front of the site writes each page's preview tags into the HTML, for link previews and crawlers that don't run JavaScript.

**Catalog matching is messy.** The same volume can appear under different titles, editions and languages. Volumes are matched by ISBN, and series by slugs of their names, so "SPY x FAMILY" on a shelf finds "Spy x Family, Vol. 15".

**Sessions across two origins.** The site and API are separate services, so cookies need credentialed CORS, `SameSite=None; Secure` in production, a shared cookie domain, and Express trusting Railway's proxy.

## Running it locally

You'll need Node.js 20.6 or newer (for `--env-file`) and PostgreSQL.

```bash
git clone https://github.com/Shriyashzzz/mangaTracker.git
cd mangaTracker
```

**API** (`server/`): create `server/.env` with at least:

```dotenv
DATABASE_URL=postgres://user:password@localhost:5432/mangatracker
SECRET=any-long-random-string
CLIENT_URL=http://localhost:5173
```

Then:

```bash
cd server
npm install
npm run initdb-dev      # creates the tables (first time only)
npm run initprices-dev  # price tables (safe to run again)
npm run migrate-dev     # newer columns and tables (safe to run again)
npm run dev             # http://localhost:8080
```

**Site** (`client/`): create `client/.env` with `VITE_API_URL=http://localhost:8080`, then:

```bash
cd client
npm install
npm run dev             # http://localhost:5173
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

## Deploying

The API and the site run as two Railway services:

| Service          | Build           | Start       | Settings                                                                       |
| ---------------- | --------------- | ----------- | ------------------------------------------------------------------------------ |
| API (`server/`)  | `npm install`   | `npm start` | `DATABASE_URL`, `SECRET`, `CLIENT_URL`, `ENV=PROD`, plus any optional settings |
| Site (`client/`) | `npm run build` | `npm start` | `VITE_API_URL`                                                                 |

After a deploy that changes the database, run `npm run migrate` (and `npm run initprices` the first time) on the API.

## Project layout

```text
client/
  server.js            serves the build, adds link-preview tags
  src/pages/           shelf, details, add/edit, price pages, series index
  src/components/      cards, mascot, settings menu, backdrop, ...
  src/lib/             API calls, prices, SEO helpers, preferences
server/
  server.js            Express app
  routes/, controller/ HTTP endpoints
  models/              SQL queries, table setup, migrations
  prices/              catalog, covers, price providers, affiliates, caching
```

## Roadmap

- [x] Reading shelf: chapters, status, ratings, filters
- [x] Session auth with PostgreSQL
- [x] Price checker: series and volume pages, live prices, history
- [x] Volumes owned, shelf prices and a shelf-aware buy button
- [x] SEO: sitemap, structured data, readable URLs, link previews
- [ ] eBay listings, including used copies
- [ ] More price sources, especially Amazon
- [ ] Price-drop alerts for volumes on your shelf
- [ ] Richer price history as data builds up
- [ ] TypeScript, and an ORM (Prisma or Drizzle) in place of raw SQL

## Affiliate disclosure

Some store links are affiliate links (Amazon, Bookshop.org, eBay, and Walmart once approved). Buying through them may earn Manga Tracker a commission at no extra cost to you, which helps keep the site running. Affiliate links are marked `rel="sponsored"` and disclosed on the pages where they appear.

## Why I built it

I wanted one place to keep my place in every series I read. Then I kept opening ten tabs to find the next volume at a fair price, so the price checker followed. The goal is a tool that knows both what you've read and what you own, so buying the next volume takes one look.

Feedback and ideas are welcome: open an issue, or tell me which stores you buy from.

---

Built by [Shriyash Ghimire](https://github.com/Shriyashzzz).
