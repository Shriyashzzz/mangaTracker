// An edition's name cut short, for the places a whole one won't fit: a New
// tab row on a phone, a stamp on a cover. "Definitive 3" is "Def. 3". The
// full name stays for hover and screen readers. Pure, so the server's Jest
// can test it. One entry for each label the app gives an edition
// (server/src/util/shelf/editionNames.ts)
const SHORT: Record<string, string> = {
  Definitive: "Def.",
  Deluxe: "Dlx",
  Omnibus: "Omni",
  VIZBIG: "VIZBIG",
  Hardcover: "HC",
  Kanzenban: "Kanz.",
  "All-in-One": "AiO",
  "Perfect Edition": "Perf.",
  "Collector's Edition": "Coll.",
  "Master Edition": "Mstr.",
  "Master's Edition": "Mstr.",
  "Fullmetal Edition": "FMA",
  "Eternal Edition": "Eter.",
  "Complete Edition": "Compl.",
  "Anniversary Edition": "Anniv.",
  "Black Edition": "Black",
  "Ultimate Edition": "Ult.",
  "Colossal Edition": "Colos.",
  "Legendary Edition": "Legd.",
};

// a label the table doesn't know yet: "Edition" off, and a long word cut
function shortLabel(label: string) {
  if (SHORT[label]) return SHORT[label];
  const plain = label.replace(/\s+edition$/i, "");
  return plain.length <= 6 ? plain : `${plain.slice(0, 4)}.`;
}

// "Def. 3", "Omni 12"; the 3-in-1s keep their name, it's short already:
// "3-in-1 #4"
export const shortBookName = (label: string, number: number) =>
  /-in-1$/i.test(label)
    ? `${label} #${number}`
    : `${shortLabel(label)} ${number}`;
