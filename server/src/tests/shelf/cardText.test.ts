// What a shelf card says for someone collecting an edition
// (client/src/lib/reading.ts placeText, components/mangaCard/cardText.ts)
test("a card says the edition's book, not the volume, for its collector", async () => {
  const { placeText } = await import("../../../../client/src/lib/reading.js");
  const { ownedTextOf } =
    await import("../../../../client/src/components/mangaCard/cardText.js");
  const vizbig = { label: "VIZBIG", read: 4, owned: [1, 2, 3, 4] };
  const reader = { byVolume: true, bookmark: null, readVolume: 12 };

  expect(placeText({ ...reader, editionPlace: vizbig }, "series")).toBe(
    "VIZBIG 4",
  );
  expect(placeText(reader, "series")).toBe("vol. 12");
  // a volume the edition has no book for is said as it is
  const past = { ...vizbig, read: null };
  expect(
    placeText({ ...reader, readVolume: 37, editionPlace: past }, "series"),
  ).toBe("vol. 37");

  const owned = Array.from({ length: 12 }, (_, i) => i + 1);
  expect(ownedTextOf(owned, vizbig)).toBe("own VIZBIG 1–4");
  expect(ownedTextOf(owned)).toBe("own vols. 1–12");
  // one volume of a book bought on its own: volumes, as before
  expect(ownedTextOf([...owned, 13], { ...vizbig, owned: null })).toBe(
    "own vols. 1–13",
  );
  expect(ownedTextOf([], vizbig)).toBeNull();
});
