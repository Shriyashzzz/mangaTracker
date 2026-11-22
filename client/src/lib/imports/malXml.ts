// A MyAnimeList export's bytes as its list of manga: unpacking the file and
// reading its XML. Pure (no API client), so the browser, the app and the
// tests all use it. malImport.ts re-exports it beside sending to the shelf
import { gunzipSync, strFromU8, unzipSync } from "fflate";
import type { MalItem } from "./malImport";

// errors that are worth showing as they are
export class ImportFileError extends Error {}

export const MAX_MAL_FILE_BYTES = 20 * 1024 * 1024;
export const MAL_FILE_TOO_BIG =
  "That file is too big to be a MyAnimeList export. Check you picked the right one.";

// the export's bytes as its XML: gzipped as the export page gives it, a zip
// if they zipped it, or the plain file
export function unpackMalExport(bytes: Uint8Array): string {
  try {
    if (bytes[0] === 0x1f && bytes[1] === 0x8b)
      return strFromU8(gunzipSync(bytes));
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      const files = unzipSync(bytes);
      const name = Object.keys(files).find((n) => /\.xml(\.gz)?$/i.test(n));
      const inside = name ? files[name] : undefined;
      if (!name || !inside)
        throw new ImportFileError("There's no list inside that zip.");
      return strFromU8(/\.gz$/i.test(name) ? gunzipSync(inside) : inside);
    }
  } catch (e) {
    if (e instanceof ImportFileError) throw e;
    throw new ImportFileError(
      "That file couldn't be opened. Try downloading it again.",
    );
  }
  return strFromU8(bytes);
}

// the export is flat XML (a <manga> holds one level of fields, each in a
// CDATA block or plain), so it's read without a DOM parser: the same reader
// in the browser and the app
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};
const unescapeXml = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#")
      return String.fromCodePoint(
        code[1]?.toLowerCase() === "x"
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10),
      );
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
// a field's text: what's inside its CDATA block, else its text with the
// entities put back
const fieldText = (element: string, tag: string) => {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(element);
  if (!match) return "";
  const inner = match[1]!.trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(inner);
  return (cdata ? cdata[1]! : unescapeXml(inner)).trim();
};
const whole = (element: string, tag: string) => {
  const value = Number.parseInt(fieldText(element, tag), 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

export function malItemsFromXml(xml: string): MalItem[] {
  const isMal =
    /^(?:\s*<\?xml[^>]*\?>)?(?:\s*<!--[\s\S]*?-->)*\s*<myanimelist[\s>]/i.test(
      xml,
    );
  if (!isMal) {
    throw new ImportFileError(
      "That isn't a MyAnimeList export. Pick the file you downloaded from the export page.",
    );
  }
  if (/<anime>/.test(xml)) {
    throw new ImportFileError(
      "That's your anime list. On the export page, choose Manga and try again.",
    );
  }

  const items: MalItem[] = [];
  for (const [, el] of xml.matchAll(/<manga>([\s\S]*?)<\/manga>/g)) {
    const title = fieldText(el!, "manga_title");
    if (!title) continue;
    const status = fieldText(el!, "my_status");
    const malId = whole(el!, "manga_mangadb_id");
    const comments = fieldText(el!, "my_comments");
    items.push({
      status,
      entry: {
        ...(malId ? { malId } : {}),
        title,
        finished: status === "Completed",
        ...(status === "Plan to Read" ? { planned: true } : {}),
        chapters: Math.min(whole(el!, "my_read_chapters"), 100000),
        readVolumes: Math.min(whole(el!, "my_read_volumes"), 999),
        ownedVolumes: Math.min(whole(el!, "my_retail_volumes"), 999),
        score: Math.min(whole(el!, "my_score"), 10),
        // the shelf keeps 450 characters, so a long list of notes stays small
        ...(comments ? { comments: comments.slice(0, 450) } : {}),
      },
    });
  }
  return items;
}
