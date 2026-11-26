// A catalog's details as a volume's page says them (models/volumeDetails.ts):
// Google's HTML description as plain text, and only a release day or month
// and a real page count
import {
  knownDay,
  knownPages,
  plainDescription,
} from "../../models/volumeDetails.js";

test("Google's HTML description reads as plain text, its paragraphs kept", () => {
  expect(
    plainDescription(
      "<p><b>Sometimes</b> you find what you yearn for&#39;s&hellip;</p><p>Konatsu &amp; Koyuki<br>meet.</p>",
    ),
  ).toBe("Sometimes you find what you yearn for's…\n\nKonatsu & Koyuki\nmeet.");
  expect(plainDescription("  <p> </p> ")).toBeNull();
  expect(plainDescription(undefined)).toBeNull();
});

test("a release date is a day or a month, never a year alone", () => {
  expect(knownDay("2019-11-12")).toBe("2019-11-12");
  expect(knownDay("2019-11")).toBe("2019-11");
  // "2019" would read as January 2019
  expect(knownDay("2019")).toBeNull();
  expect(knownDay(null)).toBeNull();
});

test("a page count is a book's own", () => {
  expect(knownPages(192)).toBe(192);
  expect(knownPages(0)).toBeNull();
  expect(knownPages(null)).toBeNull();
});

test("named and numbered entities read as their characters", () => {
  expect(
    plainDescription("It&rsquo;s &ldquo;Vol.&nbsp;2&rdquo; &#8212; &#x2026;"),
  ).toBe("It’s “Vol. 2” — …");
});
