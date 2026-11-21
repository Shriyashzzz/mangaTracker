// The app's pages (src/pages/routes.tsx), for the site server: any other
// address gets the app's not-found page with a real 404. The price pages have
// their own routes in server.ts. Case doesn't matter, as in React Router.
// server/src/tests/site/pagePaths.test.ts fails if a route is missing here
const PAGES = [
  /^\/(shelf|signin|login|signup|forgot-password|add|import|about|updates|faq|acknowledgements|privacy|friends|new-releases|calendar|profile|series|editions|prices|deals|to-buy)?\/?$/i,
  /^\/(details|update|u|reset-password)\/[^/]+\/?$/i,
  /^\/settings(\/[^/]+)?\/?$/i,
  // a year in manga, this year's or one asked for
  /^\/year(\/[^/]+)?\/?$/i,
  // the confirm and unsubscribe links in our emails
  /^\/email\/(confirm|unsubscribe)\/[^/]+\/?$/i,
  // the list of shows, and the owner's review page (a show's own page has
  // its route in server.ts)
  /^\/after-the-anime(\/review)?\/?$/i,
  // the owner's list of reported reviews
  /^\/reviews\/reported\/?$/i,
  // the owner's list of books readers reported missing from an edition
  /^\/editions\/review\/?$/i,
];

export const isAppPage = (path: string) =>
  PAGES.some((page) => page.test(path));
