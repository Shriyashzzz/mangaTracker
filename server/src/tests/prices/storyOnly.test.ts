// A series' description is its story only: AniList's notes after it (awards,
// "includes one extra chapter") read as junk in search results
import { storyOnly } from "../../prices/sources/anilist.js";

test("notes after the story are cut", () => {
  expect(
    storyOnly(
      "Chihiro lives for revenge.\n\nNote:\n\n- Winner of the Tsugimanga 2024 Award.",
    ),
  ).toBe("Chihiro lives for revenge.");
  expect(
    storyOnly("A ghoul story.\n\nNotes: Includes one extra chapter."),
  ).toBe("A ghoul story.");
});

test("a story that only mentions notes keeps them", () => {
  expect(storyOnly("She passes him notes in class.\n\nThen trouble.")).toBe(
    "She passes him notes in class.\n\nThen trouble.",
  );
});
