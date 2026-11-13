// Reading a book app's export (Goodreads, Book Catalogue, or any CSV) in the
// browser, so the file never leaves their computer. Book apps list every volume
// as its own book; the shelf has one entry per series, so volumes are grouped by
// series first. Kept free of the DOM so it can be tested on its own.
//
// The code lives in the files beside this one, in the order a file goes
// through them; this file only gathers them, so everything else imports from
// here:
//   bookTypes.ts     a book (one row) and a series (one shelf entry)
//   bookCsv.ts       the file's text as rows and cells
//   bookNames.ts     a title as a series' name and a volume number
//   bookColumns.ts   each app's columns, read into books
//   bookVolumes.ts   books holding several volumes, box sets, and readBooks
//   bookFiles.ts     several files in one import
//   bookGroups.ts    books grouped into series, ready for the shelf
export * from "./bookTypes";
export * from "./bookCsv";
export * from "./bookNames";
export * from "./bookColumns";
export * from "./bookVolumes";
export * from "./bookFiles";
export * from "./bookGroups";
