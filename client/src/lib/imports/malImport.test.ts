// The MyAnimeList export reader: a gzipped export's fields, with CDATA and
// entities, and the two files that aren't a manga list
import { gzipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import {
  ImportFileError,
  malItemsFromXml,
  unpackMalExport,
} from "./malImport";

const EXPORT = `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo><user_id>1</user_id><user_name>x</user_name></myinfo>
  <manga>
    <manga_mangadb_id>2</manga_mangadb_id>
    <manga_title><![CDATA[Berserk & Co]]></manga_title>
    <manga_volumes>0</manga_volumes>
    <my_read_volumes>12</my_read_volumes>
    <my_read_chapters>101</my_read_chapters>
    <my_retail_volumes>5</my_retail_volumes>
    <my_score>10</my_score>
    <my_status>Reading</my_status>
    <my_comments><![CDATA[]]></my_comments>
  </manga>
  <manga>
    <manga_mangadb_id>13</manga_mangadb_id>
    <manga_title>Tom &amp; Jerry&#39;s</manga_title>
    <my_status>Plan to Read</my_status>
    <my_score>0</my_score>
    <my_comments><![CDATA[note here]]></my_comments>
  </manga>
  <manga>
    <manga_title></manga_title>
    <my_status>Dropped</my_status>
  </manga>
</myanimelist>`;

describe("malItemsFromXml", () => {
  it("reads each manga's fields, from a gzipped export", () => {
    const items = malItemsFromXml(unpackMalExport(gzipSync(strToU8(EXPORT))));
    expect(items).toEqual([
      {
        status: "Reading",
        entry: {
          malId: 2,
          title: "Berserk & Co",
          finished: false,
          chapters: 101,
          readVolumes: 12,
          ownedVolumes: 5,
          score: 10,
        },
      },
      {
        status: "Plan to Read",
        entry: {
          malId: 13,
          title: "Tom & Jerry's",
          finished: false,
          planned: true,
          chapters: 0,
          readVolumes: 0,
          ownedVolumes: 0,
          score: 0,
          comments: "note here",
        },
      },
    ]);
  });

  it("says what a wrong file is", () => {
    expect(() => malItemsFromXml("<html></html>")).toThrow(ImportFileError);
    expect(() =>
      malItemsFromXml("<myanimelist><anime></anime></myanimelist>"),
    ).toThrow(/anime list/);
  });
});
