// What one book of an edition is called: "Deluxe 3", "Omnibus 2", and
// "2-in-1 Book 1" (the publishers call those books "Book 1", and "2-in-1 1"
// read as a typo). No imports, so the server's tests can check its copy
// (server prices/editionLines.ts) answers the same
export const bookName = (label: string, number: number) =>
  /-in-1$/i.test(label) ? `${label} Book ${number}` : `${label} ${number}`;
