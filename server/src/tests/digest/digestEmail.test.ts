// The weekly email as it's sent (src/digest/digestEmail.ts)
import {
  confirmMail,
  digestMail,
  digestSubject,
} from "../../digest/digestEmail.js";
import type { Digest, ReleaseItem } from "../../digest/digestRules.js";

const release = (over: Partial<ReleaseItem>): ReleaseItem => ({
  key: "out:1:3",
  kind: "out",
  mangaId: 1,
  series: "Vagabond",
  book: "VIZBIG 3",
  day: "2026-11-17",
  ...over,
});
const drop = {
  key: "drop:9781421520544",
  kind: "drop" as const,
  isbn13: "9781421520544",
  title: "Vagabond, Vol. 12",
  cents: 1099,
  usualCents: 1499,
  store: "Books-A-Million",
};
const reader = { username: "collector", code: "abcdefghijklmnopqrstuvwxyz" };
const empty: Digest = { out: [], soon: [], drops: [] };

test("the subject names the first thing in it", () => {
  expect(digestSubject({ ...empty, out: [release({})] })).toBe(
    "Vagabond VIZBIG 3 is out",
  );
  const soon = release({ kind: "soon", book: "Vol. 9", day: "2026-12-08" });
  expect(digestSubject({ ...empty, soon: [soon] })).toBe(
    "Vagabond Vol. 9 comes out Dec 8",
  );
  expect(digestSubject({ ...empty, drops: [drop] })).toBe(
    "Vagabond, Vol. 12 is $10.99",
  );
  expect(
    digestSubject({ out: [release({})], soon: [soon], drops: [drop] }),
  ).toBe("Vagabond VIZBIG 3 is out, and 2 more for your shelf");
});

test("every link is to the site, and each email can be unsubscribed from", () => {
  const mail = digestMail(reader, {
    out: [release({})],
    soon: [],
    drops: [drop],
  });
  const links = [...mail.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
  expect(links.length).toBeGreaterThan(3);
  const hosts = new Set(links.map((link) => new URL(link).host));
  expect(hosts.size).toBe(1);
  expect(mail.html).toContain(`/email/unsubscribe/${reader.code}`);
  expect(mail.text).toContain(`/email/unsubscribe/${reader.code}`);
  expect(mail.text).toContain("$10.99 at Books-A-Million, usually $14.99");
});

test("a series name is never read as HTML", () => {
  const named = release({ series: `<img src=x onerror="alert(1)">` });
  const mail = digestMail(reader, { ...empty, out: [named] });
  expect(mail.html).not.toContain("<img");
  expect(mail.html).toContain("&lt;img");
});

test("only so many lines of a kind: the rest are a link to the site", () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    release({ key: `out:${i}:1`, mangaId: i, series: `Series ${i}` }),
  );
  const mail = digestMail(reader, { ...empty, out: many });
  expect(mail.html).toContain("Series 7 ");
  expect(mail.html).not.toContain("Series 8 ");
  expect(mail.html).toContain("and 4 more on your shelf");
});

test("the confirm email carries its link", () => {
  const mail = confirmMail(reader);
  expect(mail.html).toContain(`/email/confirm/${reader.code}`);
  expect(mail.text).toContain(`/email/confirm/${reader.code}`);
});

test("a reader in Canada sees CA$, and prices are only mentioned with prices", () => {
  const canada = digestMail(
    { ...reader, country: "ca" },
    { ...empty, drops: [drop] },
  );
  expect(canada.subject).toBe("Vagabond, Vol. 12 is CA$10.99");
  expect(canada.html).toContain("CA$10.99");
  expect(canada.text).toContain(
    "CA$10.99 at Books-A-Million, usually CA$14.99",
  );
  expect(canada.html).toContain("Prices were checked");
  const noPrices = digestMail(reader, { ...empty, out: [release({})] });
  expect(noPrices.html).not.toContain("Prices were checked");
});
