// The app's pages (src/pages/routes.tsx), for the site server: any other
// address gets the app's not-found page with a real 404. The price pages have
// their own routes in server.ts. Case doesn't matter, as in React Router.
// server/src/tests/site/pagePaths.test.ts fails if a route is missing here
const PAGES = [
  /^\/(shelf|signin|signup|add|import|about|updates|acknowledgements|new-releases|calendar|profile|series|prices|deals)?\/?$/i,
  /^\/(details|update|u)\/[^/]+\/?$/i,
  /^\/settings(\/[^/]+)?\/?$/i,
];

export const isAppPage = (path: string) =>
  PAGES.some((page) => page.test(path));
