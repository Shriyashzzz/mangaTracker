// The add and edit forms' own checks (client/src/lib/formChecks.ts)
import {
  chapterProblem,
  coverLinkProblem,
} from "../../../../client/src/lib/formChecks.js";

describe("chapterProblem", () => {
  it("leaves blank to the form, takes 0 and up", () => {
    expect(chapterProblem("")).toBeUndefined();
    expect(chapterProblem("0")).toBeUndefined();
    expect(chapterProblem("1073.5")).toBeUndefined();
  });

  it("says when it's below 0 or not a number", () => {
    expect(chapterProblem("-5")).toMatch(/below 0/);
    expect(chapterProblem("abc")).toMatch(/isn't a chapter/);
  });
});

describe("coverLinkProblem", () => {
  it("takes nothing, or a web address", () => {
    expect(coverLinkProblem("")).toBeUndefined();
    expect(coverLinkProblem("https://s4.anilist.co/x.jpg")).toBeUndefined();
    expect(coverLinkProblem("http://example.com/a.png")).toBeUndefined();
  });

  it("says when it isn't one", () => {
    expect(coverLinkProblem("example.com/a.png")).toMatch(/web address/);
    expect(coverLinkProblem("https://has space.jpg")).toMatch(/web address/);
  });
});
