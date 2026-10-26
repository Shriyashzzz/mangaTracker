# Manga Tracker

**Your personal manga shelf, now with price comparison.**

Manga Tracker started as a simple solution to a familiar problem: keeping track of where you left off across multiple manga series. It has since grown into something bigger — a place to organize your reading collection and find better prices on physical manga volumes.

The goal is to bring two things together: **tracking what you read and finding what to buy next.**

**Live app:** [mangatracker.xyz](https://mangatracker.xyz/)  
**Source code:** [GitHub](https://github.com/Shriyashzzz/mangaTracker)

> **Status:** Early development. The reading tracker is the foundation, while price comparison, historical pricing, and retailer coverage are being expanded.

## Features

### Personal Manga Shelf

Keep your reading collection organized in one place.

- **Chapter bookmarks:** Save your reading progress and pick up where you left off.
- **Reading status:** Track ongoing and completed series.
- **Ratings:** Rate manga on a 0–5 star scale.
- **Filtering and sorting:** Organize your collection by status, rating, chapters, and more.
- **Private collection:** Your saved manga belongs to your account.
- **Cross-device access:** Sign in to access your collection across devices.

### Manga Price Comparison

The next major addition is a price comparison tool for physical manga volumes in the US.

- **Series search:** Find a manga and browse its English volumes.
- **Price discovery:** Aggregate listings from multiple sources to give readers more purchasing options.
- **Retailer comparison:** Find competitive prices without manually checking every store.
- **Price history:** Build historical records from saved price snapshots.
- **Historical statistics:** Work toward showing each volume's historical low, high, average, and median.

Price coverage and catalog matching are still being developed. Not every retailer or volume will necessarily have complete or current pricing.

## Data Sources

No single source provides all the metadata and pricing information needed for a reliable manga price comparison tool. Manga Tracker combines multiple sources to help fill those gaps.

| Source                                            | Purpose                                  |
| ------------------------------------------------- | ---------------------------------------- |
| [AniList](https://anilist.co/)                    | Manga metadata                           |
| [Open Library](https://openlibrary.org/)          | Book metadata and cover information      |
| [SerpApi](https://serpapi.com/) — Google Shopping | Product and price discovery              |
| [Google Books](https://books.google.com/)         | Book listings and ebook information      |
| [eBay](https://www.ebay.com/)                     | Marketplace listings and price discovery |

Retailers being integrated into the purchasing workflow include:

- [Amazon](https://www.amazon.com/)
- [Barnes & Noble](https://www.barnesandnoble.com/)
- [Bookshop.org](https://bookshop.org/)
- [Walmart](https://www.walmart.com/)
- [eBay](https://www.ebay.com/)
- [Books-A-Million](https://www.booksamillion.com/)

Retailer availability depends on data access, API limitations, and affiliate program approvals. Not every retailer is necessarily connected through a direct integration.

## Tech Stack

| Layer           | Technology                             |
| --------------- | -------------------------------------- |
| Frontend        | React, Vite, React Router, CSS Modules |
| Backend         | Node.js, Express                       |
| Database        | PostgreSQL                             |
| Authentication  | `express-session`, `bcrypt`            |
| Session storage | `connect-pg-simple`                    |
| Validation      | `express-validator`                    |
| Price discovery | SerpApi, Google Books, eBay            |
| Deployment      | Railway                                |

### Architecture Decisions

**PostgreSQL for persistence**

PostgreSQL stores user data, reading collections, session records, and price snapshots. Persisting price data allows the application to build historical trends without relying on a fresh paid search for every visit.

**Session-based authentication**

The original tracker uses server-side sessions rather than storing authentication state entirely on the client. Sessions are persisted in PostgreSQL through `connect-pg-simple`, with HTTP-only cookies used to maintain authenticated sessions.

**Multiple external data sources**

Metadata and price discovery are handled separately because different providers expose different information. Combining sources helps compensate for missing listings and incomplete catalog data.

## Engineering Challenges

### API Rate Limits and Data Availability

External APIs impose rate limits, and some price discovery requests incur costs. A single provider cannot reliably supply every volume and retailer.

The current approach is to combine data sources and persist retrieved prices. Redis caching is also planned to reduce redundant API requests, improve response times, and make better use of limited API quotas.

### Catalog Matching

The same physical volume can appear under different titles, editions, identifiers, or language metadata. Listings can also have incomplete information or missing covers.

Matching listings to the correct series and volume is essential: comparing prices only makes sense when the products being compared are actually equivalent.

### Session Persistence and Cross-Origin Cookies

The frontend and backend are deployed as separate services. Getting session cookies to persist across origins required configuring credentialed CORS on the backend and including credentials in frontend requests.

Production deployment also introduced differences in secure-cookie behavior behind a hosting proxy. Configuring Express to trust the proxy appropriately was necessary for secure session handling to work as expected.

### Authentication Edge Cases

Building authentication manually provided a better understanding of the underlying mechanics, including password hashing, session creation, session persistence, and cookie behavior.

Passwords are hashed with `bcrypt`, SQL queries use parameterized statements, and request validation is handled with `express-validator`.

## Design

The interface is being developed around a manga-inspired visual identity:

- Bold, comic-style typography
- Ink panels, screentone, and speed-line details
- An original chibi mascot
- Light and dark themes
- Responsive layouts for desktop and mobile

The goal is to make the experience feel designed for manga readers rather than like a generic shopping dashboard.

## Roadmap

- [x] Personal manga collection
- [x] Chapter bookmarking and reading status
- [x] Ratings, filtering, and sorting
- [x] Session-based authentication
- [x] PostgreSQL-backed persistence
- [x] Initial external metadata and price sources
- [ ] Expand English-volume coverage
- [ ] Improve matching across inconsistent product listings
- [ ] Expand retailer price coverage
- [ ] Build out historical price statistics
- [ ] Add Redis caching for frequently requested data
- [ ] Continue expanding retailer and affiliate integrations

This roadmap reflects ongoing development; items and priorities may change as the project evolves.

## Affiliate Disclosure

Some retailer links may be affiliate links. If a purchase is made through an eligible link, Manga Tracker may earn a commission at no additional cost to the buyer. Affiliate availability and participation vary by retailer.

## Why I Built It

I built Manga Tracker because I wanted a better way to keep track of the manga I read. The price comparison feature grew out of another problem: finding the right physical volume at a reasonable price without checking multiple stores manually.

I'm keeping the original reading-tracker experience while expanding the project into something that helps readers both organize their shelves and decide what to add next.

The project is still evolving, and there are plenty of challenges left to solve — especially around external data, rate limits, and catalog consistency.

Feedback and suggestions are welcome.

---

Built by [Shriyash Ghimire](https://github.com/Shriyashzzz).
