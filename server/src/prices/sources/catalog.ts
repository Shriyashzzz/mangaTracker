// Open Library: free, no key. Finds volumes and their ISBNs.
// https://openlibrary.org/dev/docs/api/search
import { openLibraryFetch } from "./openLibrary.js";
import { englishSeriesName } from "./anilist.js";
import { coverPath } from "./covers.js";
import { isSingleVolume, normalize, seriesName, seriesOf } from "../stores/match.js";
import { baseName, isNovelName, novelName } from "../lightNovel.js";
import type { CatalogBook } from "../types.js";

const SEARCH_URL = "https://openlibrary.org/search.json";
const FIELDS =
  "key,title,isbn,cover_i,author_name,publisher,first_publish_year,subject,number_of_pages_median";
const TIMEOUT_MS = 8000;

// the author names in English letters: a Japanese work lists both
// ("丸山くがね, Kugane Maruyama"), and readers here get the English one
const englishAuthors = (names: string[] | undefined) => {
  const english = (names ?? []).filter((n) => !/[\u3000-ヿ㐀-鿿＀-￯]/.test(n));
  return english.length ? english.join(", ") : null;
};

// one search hit, with only the fields we ask for
type Doc = {
  key?: string;
  title?: string;
  isbn?: string[];
  author_name?: string[];
  publisher?: string[];
  first_publish_year?: number;
  subject?: string[];
  number_of_pages_median?: number;
};

// a converted title, or null; `degraded` = couldn't be translated right now
type TitleResult = { title: string | null; degraded?: boolean };

// Open Library lists every language edition of a work together. US English
// editions use the 978-0, 978-1 and 979-8 ISBN ranges, so we keep those
const ENGLISH_ISBN = /^(9780|9781|9798)\d{9}$/;

export const isIsbn13 = (value: string) => /^97[89]\d{10}$/.test(value);

// accepts an ISBN-10 or ISBN-13 (dashes and spaces ignored) and returns
// the ISBN-13, or null when it isn't one
export function toIsbn13(raw: unknown): string | null {
  const digits = String(raw).replace(/[\s-]/g, "").toUpperCase();
  if (/^97[89]\d{10}$/.test(digits)) return digits;
  if (!/^\d{9}[\dX]$/.test(digits)) return null;
  const core = "978" + digits.slice(0, 9);
  const sum = [...core].reduce(
    (acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1),
    0,
  );
  return core + ((10 - (sum % 10)) % 10);
}

// Open Library sometimes puts the Japanese title alongside the English one,
// e.g. "Jujutsu Kaisen, Vol. 2 (呪術廻戦 Jujutsu Kaisen #2)". Our readers are
// in the US, so keep the English part only. Korean too: a manhwa's first
// volume can be filed as "나 혼자만 레벨업 1 (comic)"
const JAPANESE = /[\u3000-ヿ㐀-鿿＀-￯가-힯ᄀ-ᇿ]/;
const englishTitle = (title: string) =>
  title
    .replace(/\s*[(（][^)）]*[\u3000-ヿ㐀-鿿가-힯][^)）]*[)）]/g, "")
    .replace(/[\u3000-ヿ㐀-鿿＀-￯가-힯ᄀ-ᇿ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// "Vol. 12", "Volume 12" or a bare trailing number ("... as a Slime 21")
const volumeNumber = (title: string) => {
  const m =
    title.match(/\bvol(?:ume)?\.?\s*(\d+)/i) ?? title.match(/\s(\d{1,3})\s*$/);
  return m ? Number(m[1]) : null;
};

// catalog titles often tag the format: "(manga)", "(light novel)". The manga tag
// is dropped; a light novel becomes a volume of the novel series, named apart
// from the manga's (see lightNovel.ts)
const LIGHT_NOVEL = /\(\s*(light\s*novel|novel|ln)\s*\)|\blight novel\b/i;
const LIGHT_NOVEL_TAGS = /\(\s*(light\s*novel|novel|ln)\s*\)|\blight novel\b/gi;

// Open Library's titles mostly don't say "(light novel)", but the work does: a
// subject like "series:オーバーロード (light novel)" or "Light novels", or a
// novel imprint as publisher (Yen On is Yen Press's novels, Airship Seven
// Seas'). Without this the manga's page listed the novel's volumes
// Only subjects that say the book is one ("Light novels", "series:オーバーロード
// (light novel)"), not ones about them: a manga adaptation can carry
// "Adaptations of light novels". A work's publishers can mix the manga's and
// the novel's when Open Library has grouped editions together, so a novel
// imprint only counts when the manga imprint isn't there too
const NOVEL_SUBJECT = /^light\s*novels?(\s*[,(]|$)|\(\s*light\s*novel\s*\)\s*$/i;
const NOVEL_IMPRINT = /^(yen on|j-novel club|airship|cross infinite world)\b/i;
const MANGA_IMPRINT = /^yen press\b/i;
export const isNovelEdition = (
  title: string,
  subjects: string[] = [],
  publishers: string[] = [],
) =>
  LIGHT_NOVEL.test(title) ||
  subjects.some((s) => NOVEL_SUBJECT.test(s.trim())) ||
  (publishers.some((p) => NOVEL_IMPRINT.test(p.trim())) &&
    !publishers.some((p) => MANGA_IMPRINT.test(p.trim())));

// "Overlord, Vol. 3 (light novel): The Bloody Valkyrie" ->
// "Overlord Light Novel, Vol. 3"
// the record says it's a comic: "Solo Leveling, Vol. 5 (comic)", "(manga)", or
// a subject like "series:나 혼자만 레벨업 (comic)". A manhwa in full colour runs
// 300+ pages, as long as a novel, so length never makes one of these a novel
const COMIC_SUBJECT = /\(\s*(comic|manga|manhwa|manhua)\s*\)\s*$/i;
const saysComic = (title: string, subjects: string[] = []) =>
  new RegExp(FORMAT_TAG.source, "i").test(title) ||
  /\(\s*(manhwa|manhua)\s*\)/i.test(title) ||
  subjects.some((s) => COMIC_SUBJECT.test(s.trim()));

// Open Library mostly writes the number before the volume's own subtitle:
// "Sword Art Online 9 (light novel): Alicization Beginning". "Vol. 3"
// anywhere wins; otherwise the number before a ":" or " - ", or at the end.
// Not handled: series numbered by part ("Ascendance of a Bookworm: Part 1
// Volume 3"), whose volume numbers start again each part. They read as their
// own "…: Part 1" series, which no shelf entry is named, so they're left out
// rather than filed under the wrong number
export const novelSeriesAndVolume = (raw: string) => {
  const title = raw
    .replace(LIGHT_NOVEL_TAGS, " ")
    .replace(/\s+/g, " ")
    // "Sword Art Online Progressive 2 - light novel" leaves a dash behind
    .replace(/[\s,:;\-–—]+$/, "")
    .trim();
  const vol = title.match(/^(.*?)[,\s]*\bvol(?:ume)?\.?\s*(\d+)/i);
  const numbered =
    vol ?? title.match(/^(.*?\S)\s+0*(\d{1,3})\s*(?::|\s[-–—]\s|\[|$)/);
  // as written: seriesName would drop the 1 of "Part 1"
  const series = (numbered ? numbered[1]! : title)
    .replace(/\(.*?\)/g, " ")
    .replace(/\s+/g, " ")
    // a separator, not Re:ZERO's own closing "-"
    .replace(/(\s+[-–—])?[\s,:;]*$/, "")
    .trim();
  return { series, volume: numbered ? Number(numbered[2]) : null };
};

const asNovelTitle = (title: string) => {
  const { series, volume } = novelSeriesAndVolume(title);
  if (!/[a-z]{2}/i.test(series)) return null;
  return `${novelName(series)}${volume != null ? `, Vol. ${volume}` : ""}`;
};
const FORMAT_TAG = /\s*\(\s*(manga|comic|graphic novel)\s*\)/gi;

// a US edition listed only under its Japanese title, like "葬送のフリーレン 12":
// look up the official English series name and rebuild "Name, Vol. 12"
// "オーバーロード15 半森妖精の神人 ［上］": the series is what comes before the
// number, so every volume asks AniList the same short question (asked once)
// rather than one question per subtitle. A novel is asked as a novel: the
// manga search can answer with a manga spin-off's name
async function translateTitle(
  japaneseTitle: string,
  novel = false,
): Promise<TitleResult> {
  const trailing = japaneseTitle.match(/^(.*?)\s*(\d+)\s*$/);
  const split = trailing ?? japaneseTitle.match(/^(\D+?)\s*(\d{1,3})(?!\d)/);
  const number = split?.[2];
  const series = (split ? split[1]! : japaneseTitle).trim();
  if (!series) return { title: null };
  try {
    const english = await englishSeriesName(series, novel);
    if (!english) return { title: null };
    return {
      title: number ? `${english}, Vol. ${Number(number)}` : english,
    };
  } catch {
    return { title: null, degraded: true };
  }
}

// Japanese stripped out, or translated when nothing English is left
async function englishOnly(
  rawTitle: string,
  novel = LIGHT_NOVEL.test(rawTitle),
): Promise<TitleResult> {
  const untagged = rawTitle
    .replace(novel ? LIGHT_NOVEL_TAGS : FORMAT_TAG, " ")
    .replace(FORMAT_TAG, " ")
    .replace(/\s+/g, " ")
    .trim();
  const english = await englishPart(untagged, novel);
  if (!novel || !english.title) return english;
  return { ...english, title: asNovelTitle(english.title) };
}

async function englishPart(untagged: string, novel = false): Promise<TitleResult> {
  if (!JAPANESE.test(untagged)) return { title: untagged };
  const stripped = englishTitle(untagged);
  if (/[a-z]{2}/i.test(stripped)) return { title: stripped };
  return translateTitle(untagged, novel);
}

const toBook = async (
  doc: Doc,
  isbn13: string | undefined,
): Promise<{ book: CatalogBook | null; degraded?: boolean }> => {
  if (!isbn13 || !doc.title) return { book: null };
  const { title, degraded } = await englishOnly(
    doc.title,
    isNovelEdition(doc.title, doc.subject, doc.publisher),
  );
  // no English title even after translating: leave it out
  if (!title) return { book: null, ...(degraded && { degraded }) };
  return {
    book: {
      isbn13,
      title,
      authors: englishAuthors(doc.author_name),
      publisher: doc.publisher?.[0] ?? null,
      year: doc.first_publish_year ?? null,
      volume: volumeNumber(title),
      pages: doc.number_of_pages_median ?? null,
      ...(saysComic(doc.title, doc.subject) ? { comic: true } : {}),
      // the cover of this exact edition, looked up and cached by our server
      // (see covers.ts). The work's cover (doc.cover_i) can belong to another
      // language edition, or to an unrelated book when Open Library has
      // grouped editions wrongly
      coverUrl: coverPath(isbn13),
    },
  };
};

// Open Library is free but uneven: the same query can take half a second or
// time out. A failed attempt is retried once after a short pause
async function search(
  q: string,
  limit: number,
  timeoutMs = TIMEOUT_MS,
  attempt = 1,
): Promise<Doc[]> {
  const params = new URLSearchParams({
    q,
    fields: FIELDS,
    limit: String(limit),
  });
  try {
    const res = await openLibraryFetch(`${SEARCH_URL}?${params}`, timeoutMs);
    if (!res.ok) throw new Error(`Open Library responded ${res.status}`);
    const { docs } = (await res.json()) as { docs: Doc[] };
    return docs;
  } catch (e) {
    const err = e as Error;
    // a timeout already waited the full time; retrying would double it
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    const clientError = /responded 4\d\d/.test(err.message);
    if (attempt >= 2 || clientError || timedOut) throw e;
    await new Promise((r) => setTimeout(r, 800));
    return search(q, limit, timeoutMs, attempt + 1);
  }
}

// ---------- works that hold a whole series ----------
// Open Library sometimes merges every volume into one work, like "Wistoria" with
// ten English ISBNs and no volume number. Each edition still says which volume
// it is ("Wistoria" + "Wand and Sword 1"), so those are read one by one. A volume
// is only ever numbered from what its own edition says
const EDITIONS_FRESH_MS = 24 * 60 * 60 * 1000;
const MAX_EDITIONS = 200;
// enough for the real work; a common title like "Vagabond" also matches novels
const MAX_MERGED_WORKS = 5;
// a Japanese-titled work per volume
const MAX_JAPANESE_WORKS = 24;

type Edition = {
  title?: string;
  subtitle?: string;
  isbn_13?: string[];
  isbn_10?: string[];
  publishers?: string[];
  languages?: { key?: string }[];
  number_of_pages?: number;
};

// several searches can ask about the same work; failures aren't kept
const editionsCache = new Map<string, { at: number; found: Promise<Edition[]> }>();

function fetchEditions(workKey: string, timeoutMs = TIMEOUT_MS) {
  const hit = editionsCache.get(workKey);
  if (hit && Date.now() - hit.at < EDITIONS_FRESH_MS) return hit.found;
  const found = openLibraryFetch(
    `https://openlibrary.org${workKey}/editions.json?limit=${MAX_EDITIONS}`,
    timeoutMs,
  ).then(async (res) => {
    if (!res.ok) throw new Error(`Open Library responded ${res.status}`);
    const { entries = [] } = (await res.json()) as { entries?: Edition[] };
    return entries;
  });
  editionsCache.set(workKey, { at: Date.now(), found });
  found.catch(() => editionsCache.delete(workKey));
  if (editionsCache.size > 500) {
    editionsCache.delete(editionsCache.keys().next().value!);
  }
  return found;
}

// one work carrying several English editions under this series' own name, with
// nothing in its title saying which volume it is
export function isMergedWork(doc: Doc, seriesName: string) {
  const englishEditions = (doc.isbn ?? []).filter((i) => ENGLISH_ISBN.test(i));
  if (!doc.key || !doc.title || englishEditions.length < 2) return false;
  const title = normalize(doc.title.replace(LIGHT_NOVEL_TAGS, " "));
  const wanted = normalize(baseName(seriesName));
  if (!title) return false;
  const related = wanted.includes(title) || title.includes(wanted);
  return related && (title === wanted || volumeNumber(doc.title) === null);
}

// listed under its Japanese title, which didn't lead back to this series: AniList
// can answer with a spin-off, as it does for 怪獣8号. Its English edition may
// still carry the right name ("Kaiju No. 8, Vol. 1")
export function isUntranslatedWork(
  doc: Doc,
  book: CatalogBook | null,
  seriesName: string,
) {
  if (!doc.key || !doc.title || !JAPANESE.test(doc.title)) return false;
  if (!(doc.isbn ?? []).some((i) => ENGLISH_ISBN.test(i))) return false;
  return !book || seriesOf(book.title) !== seriesOf(seriesName);
}

// ① to ⑳, which some editions use for the volume
const circledToDigits = (text: string) =>
  text.replace(/[①-⑳]/g, (c) => ` ${c.charCodeAt(0) - 0x2460 + 1}`);

// the volumes one merged work's editions name, filed under the series' own name
export function booksFromEditions(
  editions: Edition[],
  doc: Doc,
  seriesName: string,
): CatalogBook[] {
  // the novel series takes only the novel editions, named as the novel's
  const novel = isNovelName(seriesName);
  const wanted = seriesOf(baseName(seriesName));
  const whole = normalize(baseName(seriesName));
  const books: CatalogBook[] = [];
  for (const edition of editions) {
    const isbn13 = [...(edition.isbn_13 ?? []), ...(edition.isbn_10 ?? [])]
      .map(toIsbn13)
      .find((i) => i && ENGLISH_ISBN.test(i));
    if (!isbn13 || !edition.title) continue;
    const languages = edition.languages ?? [];
    if (languages.length && !languages.some((l) => l.key === "/languages/eng")) {
      continue;
    }
    const tagged = circledToDigits(
      [edition.title, edition.subtitle].filter(Boolean).join(" "),
    );
    const isNovel = isNovelEdition(
      tagged,
      doc.subject,
      edition.publishers ?? doc.publisher,
    );
    if (isNovel !== novel || !isSingleVolume(tagged)) continue;
    const full = tagged.replace(LIGHT_NOVEL_TAGS, " ").replace(/\s+/g, " ").trim();
    // "Kaiju No. 8" alone is the series, not its eighth volume
    if (normalize(full) === whole) continue;
    // a novel's "Sword Art Online 9: Alicization Beginning" reads as 9
    const parsed = novel ? novelSeriesAndVolume(full) : null;
    const volume = parsed ? parsed.volume : volumeNumber(full);
    if (volume === null) continue;
    // a name ending in a number loses it in seriesOf: "Kaiju No. 8 2"
    const named = parsed ? seriesOf(parsed.series) : seriesOf(full);
    if (named !== wanted && named !== whole) continue;
    books.push({
      isbn13,
      title: `${seriesName}, Vol. ${volume}`,
      authors: englishAuthors(doc.author_name),
      publisher: edition.publishers?.[0] ?? doc.publisher?.[0] ?? null,
      year: doc.first_publish_year ?? null,
      volume,
      coverUrl: coverPath(isbn13),
      pages: edition.number_of_pages ?? null,
      ...(saysComic(tagged, doc.subject) ? { comic: true } : {}),
    });
  }
  return books;
}

// title / author / series search, or a pasted ISBN. Numbered volumes first,
// in order, then box sets and one-offs. `degraded` says the answer may be
// missing volumes because a title couldn't be translated right now
export async function searchVolumesDetailed(
  query: string,
  {
    max = 24,
    timeoutMs,
    seriesName,
  }: {
    max?: number;
    timeoutMs?: number;
    // looking for this series' volumes: also read inside works that merge them
    seriesName?: string;
  } = {},
): Promise<{ books: CatalogBook[]; degraded: boolean }> {
  const isbn = toIsbn13(query);
  const docs = await search(
    isbn ? `isbn:${isbn}` : query,
    Math.max(40, max * 2),
    timeoutMs,
  );

  const candidates = await Promise.all(
    docs.map((doc) =>
      toBook(
        doc,
        (doc.isbn ?? []).find((i) => ENGLISH_ISBN.test(i)),
      ),
    ),
  );
  const seen = new Set<string>();
  const books: CatalogBook[] = [];
  let degraded = false;
  for (const { book, degraded: d } of candidates) {
    degraded ||= Boolean(d);
    if (!book || seen.has(book.isbn13)) continue;
    seen.add(book.isbn13);
    books.push(book);
  }

  if (seriesName) {
    const toRead = [
      ...docs
        .filter((doc) => isMergedWork(doc, seriesName))
        .slice(0, MAX_MERGED_WORKS),
      ...docs
        .filter((doc, i) =>
          isUntranslatedWork(doc, candidates[i]!.book, seriesName),
        )
        .slice(0, MAX_JAPANESE_WORKS),
    ];
    const editions = await Promise.allSettled(
      toRead.map((doc) => fetchEditions(doc.key!, timeoutMs)),
    );
    editions.forEach((result, i) => {
      // a volume list that may be short, not a finished answer
      if (result.status === "rejected") {
        degraded = true;
        return;
      }
      for (const book of booksFromEditions(result.value, toRead[i]!, seriesName)) {
        // the search result for this ISBN may be the work's numberless title
        const same = books.findIndex((b) => b.isbn13 === book.isbn13);
        if (same === -1) books.push(book);
        else if (books[same]!.volume === null) books[same] = book;
      }
    });
  }

  return {
    books: books
      .sort((a, b) => (a.volume ?? Infinity) - (b.volume ?? Infinity))
      .slice(0, max),
    degraded,
  };
}

export const searchVolumes = async (
  query: string,
  options?: { max?: number; timeoutMs?: number },
) => (await searchVolumesDetailed(query, options)).books;

export async function lookupIsbn(isbn13: string): Promise<CatalogBook | null> {
  const docs = await search(`isbn:${isbn13}`, 1);
  // the requested ISBN wins even if Open Library lists another edition first
  return docs[0] ? (await toBook(docs[0], isbn13)).book : null;
}
