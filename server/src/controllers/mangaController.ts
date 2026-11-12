// The shelf's route handlers, gathered for routes/mangaRouter.ts. Each lives
// with its kind in controllers/manga/:
//   shelf.ts     one series: list, add, details, edit, delete, inline updates
//   many.ts      the shelf's Select and every undo
//   import.ts    importing a list, and the shared import matches
//   releases.ts  what's newly out, and the shelf's prices
//   fields.ts    the validation they share
import {
  list,
  add,
  detail,
  update,
  remove,
  setStatus,
  setPlanned,
  setRating,
  setBookmark,
  setReading,
  books,
  allBooks,
  addBooks,
  removeBook,
  setPurchase,
  setSeen,
  setNotes,
  setImage,
  setOwned,
} from "./manga/shelf.js";
import {
  removeMany,
  restoreMany,
  moveMany,
  placeMany,
  restore,
  merge,
} from "./manga/many.js";
import {
  importList,
  match,
  knownImportMatches,
  tellImportMatches,
} from "./manga/import.js";
import { releases, savedReleases, shelfPrices } from "./manga/releases.js";

// named, for the tests
export { nothingLeftToCheck } from "./manga/releases.js";
export { checkRestored, notOnShelf } from "./manga/many.js";

export default {
  list,
  add,
  detail,
  releases,
  savedReleases,
  update,
  remove,
  removeMany,
  restoreMany,
  moveMany,
  placeMany,
  merge,
  setStatus,
  setPlanned,
  setRating,
  importList,
  setBookmark,
  setReading,
  books,
  allBooks,
  addBooks,
  removeBook,
  setPurchase,
  setSeen,
  restore,
  setNotes,
  setImage,
  setOwned,
  shelfPrices,
  match,
  knownImportMatches,
  tellImportMatches,
};
