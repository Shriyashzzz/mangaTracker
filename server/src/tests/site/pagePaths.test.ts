// The site server answers 404 for any address that isn't one of the app's
// pages (client/pagePaths.ts). A route added to the app without it would be a
// 404 to search engines, so every route in routes.tsx must match
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAppPage } from "../../../../client/pagePaths.js";

const routesFile = fileURLToPath(
  new URL("../../../../client/src/pages/routes.tsx", import.meta.url),
);
const routes = [
  ...readFileSync(routesFile, "utf8").matchAll(/path:\s*"([^"]+)"/g),
]
  .map((m) => m[1]!)
  // the not-found page, and the price pages, which have their own routes
  .filter((p) => p !== "*" && !/^\/prices\/./.test(p));

// "/settings/:tab?" -> "/settings" and "/settings/x"
const examples = (path: string) => {
  const required = path.replace(/\/:[^/]+\?/g, "").replace(/:[^/?]+/g, "x");
  const all = path.replace(/:[^/?]+\??/g, "x");
  return [...new Set([required, all])];
};

test("the route list was read", () => {
  expect(routes.length).toBeGreaterThan(10);
});

test.each(routes)("%s is a page to the site server", (path) => {
  for (const example of examples(path)) expect(isAppPage(example)).toBe(true);
});

test("case doesn't matter, as in the app", () => {
  expect(isAppPage("/About")).toBe(true);
  expect(isAppPage("/Details/42")).toBe(true);
});

test("an address that isn't a page is not", () => {
  for (const path of ["/nope", "/foo/bar", "/shelf/x/y", "/settings/a/b"])
    expect(isAppPage(path)).toBe(false);
});
