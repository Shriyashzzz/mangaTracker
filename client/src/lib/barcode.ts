// What a camera read off the back of a book, as an ISBN. A book's barcode is
// an EAN-13 starting 978 or 979 (the "Bookland" prefixes); anything else the
// camera catches (a price add-on, a shop sticker, a UPC on a box set's wrap)
// isn't a book and is ignored. Pure, so the server's tests load it.

// the 13th digit of an ISBN-13: weights 1 and 3, alternating
const checkDigit = (first12: string) => {
  const sum = [...first12].reduce(
    (total, d, i) => total + Number(d) * (i % 2 ? 3 : 1),
    0,
  );
  return String((10 - (sum % 10)) % 10);
};

// the 13-digit ISBN in what was read, or null if it isn't one
export function isbnFromBarcode(read: string): string | null {
  const digits = read.replace(/\D/g, "");
  if (digits.length !== 13 || !/^97[89]/.test(digits)) return null;
  return checkDigit(digits.slice(0, 12)) === digits[12] ? digits : null;
}

// what someone types instead: an ISBN-13 with or without dashes and spaces,
// or the older 10-character ISBN printed on some volumes (turned into its
// ISBN-13)
export function isbnFromTyped(typed: string): string | null {
  const plain = typed.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{13}$/.test(plain)) return isbnFromBarcode(plain);
  if (!/^\d{9}[\dX]$/.test(plain)) return null;
  // ISBN-10's own check: weights 10 down to 1, X is ten
  const sum = [...plain].reduce(
    (total, c, i) => total + (c === "X" ? 10 : Number(c)) * (10 - i),
    0,
  );
  if (sum % 11) return null;
  const first12 = `978${plain.slice(0, 9)}`;
  return first12 + checkDigit(first12);
}

// "3", "3, 4", "3-4" or "3 & 4": whole volumes 1 to 999, a few at most
export function volumesFrom(typed: string): number[] | null {
  const parts = typed.split(/\s*(?:,|&|and)\s*/i).filter(Boolean);
  const all = new Set<number>();
  for (const part of parts) {
    const range = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    const [from, to] = range
      ? [Number(range[1]), Number(range[2])]
      : [Number(part), Number(part)];
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1)
      return null;
    if (to < from || to > 999 || to - from > 5) return null;
    for (let v = from; v <= to; v++) all.add(v);
  }
  return all.size && all.size <= 6 ? [...all].sort((a, b) => a - b) : null;
}
