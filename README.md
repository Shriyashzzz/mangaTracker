# Manga Tracker

A manga tracking app for readers who follow multiple series at once. Built to solve a simple problem: forgetting which chapter you left off on.

Live at [client-production-ae31.up.railway.app](https://client-production-ae31.up.railway.app/)

---

## Features

- Personal manga list — each account sees only their own collection
- Chapter bookmarking — save exactly where you left off
- Status tracking — mark series as ongoing or finished
- 0–5 star rating system
- Filter and sort by rating, chapters, or status
- Secure authentication with encrypted passwords
- Session persistence via HTTP-only cookies

---

## Tech Stack

| Layer         | Technology        |
| ------------- | ----------------- |
| Frontend      | React + Vite      |
| Routing       | React Router      |
| Backend       | Node.js + Express |
| Database      | PostgreSQL        |
| Session store | connect-pg-simple |
| Components    | Material UI       |
| Deployment    | Railway           |

---

## Security

- Passwords hashed with bcrypt (cost factor 12)
- Sessions stored server-side in PostgreSQL
- HTTP-only secure cookies
- Parameterized queries throughout — no SQL injection risk
- Input validation on all endpoints via express-validator
- All credentials stored in environment variables

## Some Challenges I'd like to be documented

**Sessions not persisting**

I spent a while debugging why sessions weren't being saved at all. Turned out I had created the session table in a different PostgreSQL database than the one the app was actually connected to. connect-pg-simple was silently failing to write sessions because the table didn't exist in the right place. I fixed it by connecting to the correct database and verifying with `SELECT * FROM session` after each login.

**Passwords not matching on login**

I had applied `.escape()` from express-validator to the password field thinking it would sanitize the input safely. What it actually does is convert special characters, so a password like `Hello@123` becomes `Hello&#64;123` before being passed to `bcrypt.compare()`, which then never matches the original hash. I removed `escape()` from password fields entirely. Turns out bcrypt handles passwords safely on its own. so sanitizing/escaping is not needed everywhere :P

**CORS + credentials across two Railway deployments**

The client and server are deployed as separate services on different origins. Getting cookies to work cross-origin took me a while, it required setting `credentials: true` in the Express CORS config and `credentials: 'include'` on every fetch call on the frontend. Missing either one causes the browser to silently drop the session cookie with no error, which made this particularly hard to debug.

**Cookie behavior differences between dev and prod**

`secure: true` on the session cookie means it only transmits over HTTPS. In development over HTTP this caused the cookie to never be sent, making every request look like a new unauthenticated session. I fixed it by conditionally setting `secure` based on the `ENV` environment variable so it's only enforced in production.

---

## What I'd Do Differently

- **Redis for session storage** — PostgreSQL works but querying it on every authenticated request adds unnecessary load. Redis is purpose-built for this. Looking to learn that eventually.
- **Passport.js** — now that I understand the auth flow from scratch more better, Passport would be worth revisiting to handle edge cases and OAuth down the line.
- **Stronger input sanitization** — express-validator covers the basics but a more thorough sanitization strategy would be preety, particularly around free-text fields like description.

---

## Coming Soon

Manga price tracker — search any title and compare prices across stores in your region.

---

## Author

Built by Shriyash — a manga reader with ADHD who needed a better system than scrolling through 50 chapters to find his place.
