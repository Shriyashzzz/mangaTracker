// Saving a series from someone's shared shelf to the visitor's own To read
// list: the sheet's "Add to my To read" and a row's "+ To read" both use it.
import { apiFetch } from "../../lib/api";
import type { SharedManga } from "./shareParts";

// Puts a shared series on the visitor's own To read list. False when it
// didn't save. One that's already there under another name counts as saved
// (the shelf's reload shows it)
export async function addToRead(m: SharedManga) {
  const res = await apiFetch("/api/manga", {
    method: "POST",
    body: {
      name: m.name.slice(0, 150),
      status: false,
      planned: true,
      ...(m.lightNovel ? { lightNovel: true } : {}),
      ...(m.image ? { image: m.image } : {}),
      ...(m.genre && m.genre !== "unlabled" ? { genre: m.genre } : {}),
    },
  }).catch(() => null);
  return Boolean(res && (res.ok || res.status === 409));
}
