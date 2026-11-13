// A book's title as a series' name and a volume number: "Berserk Deluxe
// Volume 2" is Berserk, 2. Part of the book import (bookImport.ts lists the
// parts).

// ---------- series and volume numbers ----------

// a special edition is still the same series: "Berserk Deluxe Edition" is Berserk.
// Words that end real names ("Rave Master") count only before "Edition"
const EDITION =
  /[\s,:(\-–—]+(the )?((deluxe|omnibus|complete( collection)?|box ?set|vizbig|full[\s-]colou?r(\s+collection)?|\d-in-\d|\d-in|\d+ ?in ?\d+)( edition)?|all-in-one( edition)?|(collector'?s|perfect|ultimate|master|revised|fullmetal) edition)\)?$/i;

export const tidy = (name: string) =>
  name
    // the format is kept apart (titleSaysLightNovel), not in the name, and
    // "(Manga)" only says it isn't the novel
    .replace(/\s*\(\s*(light[\s-]?novels?|ln|novel|manga)\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .replace(/[\s,:;.\-–—]+$/, "")
    // the format said in words: "Spice & Wolf: Manga", "Witch & Wizard: The Manga"
    .replace(
      /[\s,:\-–—]+(the )?(manga|manhwa|light[\s-]?novels?|graphic novels?)$/i,
      "",
    )
    // "English Version Attack on Titan"
    .replace(/^(english|japanese) (version|edition)\s+/i, "")
    // a "Vol" with its number lost: "Fairy Tail, Vol"
    .replace(/[,\s]+vol(ume)?\.?$/i, "")
    // library order: "Ghost in the Shell, The"
    .replace(/^(.+), (the|a|an)$/i, "$2 $1")
    .replace(EDITION, "")
    .replace(/[\s,:;.\-–—]+$/, "")
    // "Princess Jellyfish 2-in-1 Omnibus": one edition word, then another
    .replace(EDITION, "")
    // an edition's own number: "Siúil, a Rún Deluxe Edition II"
    .replace(
      /[\s,:(\-–—]+(deluxe|omnibus|collector'?s|perfect|ultimate|master) edition\s+[ivx]+$/i,
      "",
    )
    .replace(/[\s,:;.\-–—]+$/, "")
    .trim();

// two spaces between words are where an export dropped an "&": "Wolf  Parchment:
// New Theory Spice  Wolf" is Wolf & Parchment
export const withAmpersands = (text: string) =>
  // not before a volume word: "…Cheat Powers  Vol. 8" is just a typo
  text.replace(
    /(\p{L}) {2}(?!(?:vol(?:ume)?s?|book|part|tome|tomo|band|no)\b)(?=\p{L})/giu,
    "$1 & ",
  );

// some publishers spell it out: "Sex Criminals: Volume One"
const NUMBER_WORDS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];
// "Vol. II"
const ROMAN = [
  "i",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
  "xi",
  "xii",
];
// in English, French (tome), Spanish and Italian (tomo) and German (Band)
// and French "Gachiakuta T03"
const VOLUME_WORD = String.raw`(?:vol(?:ume)?\.?|v\.|book|tome|tomo|band|bd\.|t(?=\d)|#)`;
const NUMBERED = new RegExp(
  String.raw`^(.*?)(?:[,:]|\s[-–—])?\s+${VOLUME_WORD}\s*(\d+(?:\.\d+)?|${NUMBER_WORDS.join("|")}|${ROMAN.join("|")})\b`,
  "i",
);
// Japanese editions: "メイドインアビス 第5巻", "ワンピース 9巻"
const JAPANESE_VOLUME = /^(.*?)\s*第?\s*(\d+(?:\.\d+)?)\s*巻/;
// a number at the end: "xxxHOLiC 19", "GACHIAKUTA 04". Up to three digits, so
// a year isn't read as one
// and "Gantz/3"
const TRAILING_NUMBER = /^(.*?\S)[\s,:#/\-–—]+0*(\d{1,3}(?:\.\d)?)$/;
// or before the volume's own title: "One Piece 31: Over Here"
const NUMBER_THEN_SUBTITLE = /^(.*?\D)\s+0*(\d{1,3}):\s+\S/;

export const LATIN = /[a-z]/i;
// in square brackets but not a second name: "[Deluxe Edition]"
const NOT_A_NAME = new RegExp(
  [
    // editions and formats: "[Deluxe Edition]", "[Kindle]", "[Hardcover]"
    String.raw`^(deluxe|limited|special|collector'?s|omnibus|box ?set|hard ?cover|paper ?back|kindle|digital|e-?book|audio ?book|signed|first|1st|\d-in-\d)\b`,
    String.raw`\b(edition|version|translation|print(ing)?|format)$`,
    // languages: "[Japanese]", "[in Japanese]"
    String.raw`^(in )?(english|japanese|french|german|spanish|italian|korean|chinese|portuguese|polish|russian)( language)?$`,
    // what it is: "[Manga]", "[Light Novel]"
    String.raw`^(manga|manhwa|manhua|comics?|graphic novels?|light novels?|novels?)$`,
  ].join("|"),
  "i",
);

type Parsed = {
  series: string;
  volume: number | null;
  // every name the series goes by, the series first: both halves of
  // "メイドインアビス 5 [Made in Abyss 5]"
  names: string[];
  // only a number at the end said so: kept if another book backs it up
  // (confirmTrailingNumbers), so "Mob Psycho 100" on its own stays the name
  guessed?: boolean;
};

const numberOf = (text: string) => {
  const n = text.toLowerCase();
  const word = NUMBER_WORDS.indexOf(n);
  if (word >= 0) return word + 1;
  const roman = ROMAN.indexOf(n);
  if (roman >= 0) return roman + 1;
  return Number(n);
};

// "Crying Freeman, No. 1: Shades of Death". Only after a comma, so "No. 6"
// and "Kaiju No. 8" stay names
const COMMA_NUMBER = /^(.*?),\s+no\.\s*(\d{1,3})\b/i;

// a number right after Chinese or Japanese text: "One Piece 航海王37: 湯姆先生"
// is One Piece 航海王, vol. 37
const CJK_NUMBER =
  /^(.*[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])\s*0*(\d{1,3})(?=$|[\s:：(（])/u;

// one name with perhaps a volume in it, no brackets
function oneName(text: string, trailingNumber = true): Parsed {
  const comma = text.match(COMMA_NUMBER);
  if (comma && tidy(comma[1]!)) {
    const series = tidy(comma[1]!);
    return { series, volume: Number(comma[2]), names: [series] };
  }
  const numbered = text.match(NUMBERED);
  if (numbered && numbered[1]!.trim()) {
    const series = tidy(numbered[1]!);
    return { series, volume: numberOf(numbered[2]!), names: [series] };
  }
  const japanese = text.match(JAPANESE_VOLUME);
  if (japanese && japanese[1]!.trim()) {
    const series = tidy(japanese[1]!);
    return { series, volume: Number(japanese[2]), names: [series] };
  }
  const trailing =
    trailingNumber &&
    (tidy(text).match(TRAILING_NUMBER) ?? text.match(NUMBER_THEN_SUBTITLE));
  if (trailing && tidy(trailing[1]!)) {
    const series = tidy(trailing[1]!);
    return {
      series,
      volume: Number(trailing[2]),
      names: [series],
      guessed: true,
    };
  }
  // only a guess too, as the number can be the name's: "モブサイコ100"
  const cjk = trailingNumber && text.match(CJK_NUMBER);
  if (cjk && tidy(cjk[1]!)) {
    const series = tidy(cjk[1]!);
    return { series, volume: Number(cjk[2]), names: [series], guessed: true };
  }
  const series = tidy(text) || text.trim();
  return { series, volume: null, names: [series] };
}

// "メイドインアビス 5 [Made in Abyss 5]" or "Ayashimon [アヤシモン]": either
// half can be the Japanese one. The half in Latin letters leads, as that's
// how the English volumes and AniList usually write it
function bracketed(text: string, trailingNumber = true): Parsed | null {
  // or "進撃の巨人 / Attack on Titan"
  const m =
    text.match(/^(.*?)\s*\[([^[\]]+)\]\s*(.*)$/) ??
    text.match(/^(.+?)\s+\/\s+(.+)()$/);
  if (!m || !m[1]!.trim() || NOT_A_NAME.test(m[2]!.trim())) return null;
  const halves = [
    oneName(`${m[1]} ${m[3]}`.trim(), trailingNumber),
    oneName(m[2]!, trailingNumber),
  ];
  const [first, second] = LATIN.test(halves[0]!.series)
    ? halves
    : [halves[1]!, halves[0]!];
  const numbered = halves.filter((h) => h.volume != null);
  // both halves with the same number is as good as "Vol."
  const agree =
    numbered.length === 2 && numbered[0]!.volume === numbered[1]!.volume;
  return {
    series: first!.series,
    volume: numbered[0]?.volume ?? null,
    names: [...new Set([first!.series, second!.series].filter(Boolean))],
    ...(numbered.length && !agree && numbered.every((h) => h.guessed)
      ? { guessed: true }
      : {}),
  };
}

const parseName = (text: string, trailingNumber = true): Parsed =>
  bracketed(text, trailingNumber) ?? oneName(text, trailingNumber);

// "One Piece, Vol. 1: Romance Dawn (One Piece, #1)" → One Piece, 1
// "Frieren: Beyond Journey's End, Vol. 3" → Frieren: Beyond Journey's End, 3
// "メイドインアビス 5 [Made in Abyss 5]" → Made in Abyss (and メイドインアビス), 5
export function seriesFromTitle(raw: string, trailingNumber = true): Parsed {
  // full-width digits and brackets, as Japanese titles often have, made plain
  const asWritten = raw.normalize("NFKC");
  // some apps drop "&" and leave its two spaces: "Wolf  Parchment". It could
  // also be a typo ("One  Piece"), so the name as written stays one of its
  // names, searched if the "&" one finds nothing
  const restored = withAmpersands(asWritten);
  const parsed = parseTitle(restored, trailingNumber);
  if (restored === asWritten) return parsed;
  const plain = parseTitle(asWritten, trailingNumber);
  return { ...parsed, names: [...new Set([...parsed.names, ...plain.names])] };
}

function parseTitle(title: string, trailingNumber: boolean): Parsed {
  const tagged = title.match(/\(([^()]+?),?\s*#\s*(\d+(?:\.\d+)?)[^()]*\)\s*$/);
  if (tagged) {
    // the tag names the series, so a number in it is the name's: "(Mob
    // Psycho 100, #4)", "(Eyeshield 21, #2)"
    const named = parseName(tagged[1]!, false);
    return { ...named, volume: Number(tagged[2]), guessed: undefined };
  }
  const bare = title
    .replace(/\s*\(\s*manga\s*\)/gi, "")
    .replace(/(\s*\([^()]*\))+\s*$/, "");
  return parseName(bare || title, trailingNumber);
}

// what some apps put in the series field that isn't a series: "Manga",
// "3-in-1 Edition", "Graphic Novels)", "Vol. 4-6 Hardcover"
const LABEL =
  /^(manga|manhwa|comics?|graphic novels?\)?|light novels?|novels?|omnibus|id_entity|.*\bedition\b.*|vol(ume)?s?\.?\s*[\d\s\-–&,]+.*)$/i;

// a name worth grouping by: has letters, isn't a label like "Manga", and isn't
// a scrap like "Dark Horse)" left by a publisher in brackets
export const isName = (name: string) =>
  name.length > 1 &&
  /\p{L}/u.test(name) &&
  !LABEL.test(name) &&
  !NOT_A_NAME.test(name) &&
  // a title that's just "Volume 1" leaves "Volume", which names nothing
  !/^(vol(ume)?|v|book|tome|tomo|band|bd|part|chapter|issue|no|number|t)\.?$/i.test(
    name,
  ) &&
  !/^[^(]*\)/.test(name);

// Book Catalogue's "Discworld (4)", several joined with "|": the first one counts
export function seriesFromDetails(details: string): Parsed | null {
  const first = details.split("|")[0]!.normalize("NFKC").trim();
  if (!first || LABEL.test(first)) return null;
  const m = first.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!m || !m[1]!.trim()) return seriesFromColumn(first);
  if (LABEL.test(m[1]!.trim())) return null;
  const n = Number.parseFloat(m[2]!);
  const named = seriesFromColumn(m[1]!);
  return named && { ...named, volume: Number.isFinite(n) && n > 0 ? n : null };
}

// a series column names the series, so a number in it is part of the name
export function seriesFromColumn(text: string): Parsed | null {
  const clean = text.normalize("NFKC").trim();
  if (!clean || LABEL.test(clean)) return null;
  const named = bracketed(clean);
  const names = named?.names ?? [tidy(clean) || clean];
  return { series: names[0]!, volume: null, names };
}

// a light novel's names are its own: a manga never joins one
export const formatOf = (b: { lightNovel: boolean }) =>
  b.lightNovel ? "ln" : "m";

// the series name compared: case, accents, spacing and punctuation don't count.
// Only Latin accents come off, so ネバーランド keeps its marks
export const seriesKey = (name: string) =>
  name
    .toLowerCase()
    // "Hunter × Hunter"
    .replace(/×/g, "x")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// publishers tag the novel editions, so the manga of the same name stays apart
const LIGHT_NOVEL = /\blight[\s-]?novels?\b|\(\s*(ln|novel)\s*\)/i;
export const titleSaysLightNovel = (...text: string[]) =>
  text.some((t) => LIGHT_NOVEL.test(t));
