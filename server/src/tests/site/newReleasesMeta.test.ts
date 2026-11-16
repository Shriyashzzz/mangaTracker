// How New works, as search results show it: one title and description for
// the page and the site's crawler copy (client/server.ts STATIC_PAGES)
import {
  NEW_RELEASES_DESCRIPTION,
  NEW_RELEASES_TITLE,
} from "../../../../client/src/lib/content/newReleases.js";
import { isAppPage } from "../../../../client/pagePaths.js";

test("the How New works page's description fits a search result", () => {
  expect(NEW_RELEASES_TITLE.length).toBeGreaterThan(0);
  // Google cuts a description off past about 160 characters
  expect(NEW_RELEASES_DESCRIPTION.length).toBeLessThanOrEqual(155);
  expect(isAppPage("/new-releases")).toBe(true);
});
