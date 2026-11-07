// The API's shapes are written twice: the server's own, and the client's copy
// in client/src/lib (Railway builds each app from its own folder, so neither
// can import the other's). This file has no tests to run: it only has to
// typecheck (`npm run typecheck`, through tsconfig.test.json). If the server
// changes a shape and the client's copy isn't changed with it, the line for
// that shape below stops compiling and says which field is wrong.
//
//   Answers:  what the server sends, once it's JSON, must fit the client's type
//   Requests: what the client sends must fit the server's type
import type * as Client from "../../../../client/src/lib/types.js";
import type { ReleaseOutcome as ClientReleaseOutcome } from "../../../../client/src/lib/releaseMath.js";
import type { MalEntry as ClientMalEntry } from "../../../../client/src/lib/imports/malImport.js";
import type { SharedMatch as ClientSharedMatch } from "../../../../client/src/lib/imports/sharedMatches.js";
import type {
  ShelfMove as ClientShelfMove,
  ShelfPlace as ClientShelfPlace,
} from "../../../../client/src/store/shelf.js";
import type * as Prices from "../../prices/types.js";
import type { KindHistory } from "../../models/priceQueries.js";
import type { Prefs } from "../../models/userQueries.js";
import type {
  RangeMode,
  ReleaseRange,
  ReleaseSettings,
  ReleaseStatus,
} from "../../util/releases/releaseStatus.js";
import type { ReleaseOutcome } from "../../util/releases/releaseOutcome.js";
import type { MalEntry } from "../../util/shelf/malEntry.js";
import type { SharedMatch } from "../../util/shelf/sharedMatches.js";
import type { ShelfMove, ShelfPlace } from "../../models/mangaQueries.js";
import type { StoreLink } from "../../prices/stores/storeLinks.js";
import type { Manga } from "../../../generated/prisma/client.js";
import type { FormatedDates } from "../../util/releases/volumeDataFormatter.js";
import type {
  getSeries,
  ScannedBook,
  VolumePrices,
} from "../../prices/service.js";

// what JSON.stringify makes of a value: dates become strings
type Json<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;

// the fields of To that From is missing or gets wrong
type Mismatched<From, To> = {
  [K in keyof To]-?: K extends keyof From
    ? From[K] extends To[K]
      ? never
      : K
    : undefined extends To[K]
      ? never
      : K;
}[keyof To];

// compiles only when From can be used where To is expected; when it can't,
// it asks for an argument whose type lists the fields that differ (hover it).
// Only declared: this file is typechecked, never run
declare function fits<From, To>(
  ...differs: [From] extends [To] ? [] : [fields: Mismatched<From, To>]
): void;

// answers: server -> client
// a series on the shelf (and /match's ShelfMatch, made of the same fields)
fits<Json<Manga>, Client.Manga>();
// release dates for the details page
fits<Json<FormatedDates>, Client.ReleaseData>();
// a scanned barcode's book
fits<Json<ScannedBook>, Client.ScannedBook>();
fits<Json<Prices.CatalogBook>, Client.CatalogBook>();
fits<Json<Prices.SeriesHit>, Client.SeriesHit>();
fits<Json<Prices.SeriesInfo>, Client.SeriesInfo>();
fits<Json<StoreLink>, Client.StoreLink>();
fits<Json<KindHistory>, Client.KindHistory>();
// offers and the price history are checked inside these, as they're sent
fits<Json<VolumePrices>, Client.VolumePrices>();
fits<Json<NonNullable<Awaited<ReturnType<typeof getSeries>>>>, Client.Series>();
fits<Json<ReleaseStatus>, Client.ReleaseStatus>();
fits<Json<ReleaseOutcome>, ClientReleaseOutcome>();
fits<Json<SharedMatch>, ClientSharedMatch>();
fits<Json<Prefs>, Client.Prefs>();

// requests: client -> server
fits<ClientMalEntry, MalEntry>();
fits<ClientSharedMatch, SharedMatch>();
fits<Client.Prefs, Prefs>();
fits<Client.ReleaseSettings, ReleaseSettings>();
fits<Client.ReleaseRange, ReleaseRange>();
fits<Client.RangeMode, RangeMode>();
fits<ClientShelfMove, ShelfMove>();
fits<ClientShelfPlace, ShelfPlace>();
