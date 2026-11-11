// Who publishes a volume in English. Open Library lists a work's publishers
// across every edition, so its first one is often a Spanish, French or German
// house (One Piece 53 came out as "Planeta DeAgostini"). In order:
// 1. the ISBN's publisher prefix, for the big English manga publishers
// 2. the edition's own publisher, when we have the edition
// 3. a known English publisher from anywhere in the list
// otherwise none: no publisher beats a wrong one on the page and in search
//
// Prefixes are publisher blocks in the ISBN, checked against the books we
// had saved (2026-11-11): every 978-1-4215 was VIZ whatever the name said

const PREFIXES: [prefix: string, name: string][] = [
  ["97814215", "VIZ Media"],
  ["97819747", "VIZ Media"],
  ["978156931", "VIZ Media"],
  ["978159116", "VIZ Media"],
  ["978161262", "Kodansha"],
  ["978163236", "Kodansha"],
  ["978164651", "Kodansha"],
  ["97819753", "Yen Press"],
  ["978164609", "Square Enix Manga"],
  ["97814278", "Tokyopop"],
];

// English names as Open Library and Google Books spell them, to one name each.
// The rest of the list keeps its own spelling
const ENGLISH: [test: RegExp, name: string | null][] = [
  [/^(viz\b|shonen (jump|sunday)\b)/i, "VIZ Media"],
  [/^kodansha\b/i, "Kodansha"],
  [/^yen on\b/i, "Yen On"],
  [/^yen press\b/i, "Yen Press"],
  [/^seven seas\b/i, "Seven Seas"],
  [/^dark horse\b/i, "Dark Horse"],
  [/^square enix\b/i, "Square Enix Manga"],
  [/^tokyopop\b/i, "Tokyopop"],
  [/^vertical\b/i, "Vertical"],
  [
    /^(ghost ship|j-novel club|airship|cross infinite world|denpa|udon|one peace|ize press|kaiten|azuki|digital manga|sublime|del rey|titan|dc comics|orbit|graphix|first second|fantagraphics|drawn (&|and) quarterly|abrams|harpercollins|simon (&|and) schuster|penguin|random house|little,? brown|hachette|andrews mcmeel|lerner|scholastic)\b/i,
    null,
  ],
];

const english = (name: string) => {
  const clean = name.trim();
  const hit = ENGLISH.find(([test]) => test.test(clean));
  return hit ? (hit[1] ?? clean) : null;
};

export function publisherOf(
  isbn13: string,
  {
    edition = [],
    work = [],
  }: { edition?: (string | null)[]; work?: (string | null)[] } = {},
): string | null {
  const byPrefix = PREFIXES.find(([prefix]) => isbn13.startsWith(prefix));
  if (byPrefix) return byPrefix[1];
  const own = edition.find((p) => p?.trim());
  if (own) return english(own) ?? own.trim();
  for (const p of work) {
    const name = p && english(p);
    if (name) return name;
  }
  return null;
}
