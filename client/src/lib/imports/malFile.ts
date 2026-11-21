// A MyAnimeList export as the browser hands it over: a File from the picker
// or a drop. The app has its own copy of this file, reading a picked path
import {
  MAL_FILE_TOO_BIG,
  MAX_MAL_FILE_BYTES,
  ImportFileError,
  malItemsFromXml,
  unpackMalExport,
  type MalItem,
} from "./malImport";

export type MalFile = File;

export async function readMalExport(file: MalFile): Promise<MalItem[]> {
  if (file.size > MAX_MAL_FILE_BYTES)
    throw new ImportFileError(MAL_FILE_TOO_BIG);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return malItemsFromXml(unpackMalExport(bytes));
}
