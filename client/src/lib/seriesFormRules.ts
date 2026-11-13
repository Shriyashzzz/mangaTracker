// What the add form and the edit form work out before they save: which
// fields have a problem, which of them to take the reader to, and the request
// sent to the server. One set of rules for both forms. Pure: no requests and
// no state.
import { chapterProblem, coverLinkProblem } from "./formChecks";
import { parseVolumes } from "./ownedVolumes";
import type { MangaForm } from "./types";
import type { Stage } from "../components/statusField/StatusField";

// what the form holds when Save is pressed
export type SeriesFormValues = {
  title: string;
  // still reading, finished it, or want to read (not started)
  stage: Stage;
  chapter: string;
  readVolume: string;
  // which counters this series shows (lib/reading.ts tracksOf)
  tracks: { chapters: boolean; volumes: boolean };
  byVolume: boolean;
  // stars given on the add form; 0 for none (the edit form doesn't rate)
  rating: number;
  image: string;
  // the cover is a link they typed, so it's checked. Always so on the edit
  // form; on the add form only once they open "Add a cover image"
  ownCover: boolean;
  genre: string;
  description: string;
  lightNovel: boolean;
  // the volume picker's two hidden fields, as the form holds them
  volumesOwned: string;
  ownedList: string;
};

type FieldProblems = {
  title?: string;
  bookmark?: string;
  image?: string;
};

// what's wrong with each field, said under it. A chapter is only asked of
// someone reading by the chapter: a collector tracking volumes needn't say one
export function problemsIn(form: SeriesFormValues): FieldProblems {
  const asksChapter = form.stage === "reading" && form.tracks.chapters;
  return {
    title: !form.title.trim() ? "Give it a title." : undefined,
    bookmark: asksChapter ? chapterProblem(form.chapter) : undefined,
    image: form.ownCover ? coverLinkProblem(form.image) : undefined,
  };
}

// the id of the first field with a problem, to scroll to and focus. A missing
// title is handled apart: the form goes back to its search
export function firstProblemField(problems: FieldProblems) {
  if (problems.bookmark) return "bookmark";
  if (problems.image) return "cover-link";
  return null;
}

// the series as the server takes it
export function requestFor(form: SeriesFormValues): MangaForm {
  const isReading = form.stage === "reading";
  const request: MangaForm = {
    name: form.title,
    description: form.description,
    image: form.image,
    genre: form.genre,
    status: form.stage === "finished",
    planned: form.stage === "planned",
    lightNovel: form.lightNovel,
    volumesOwned: form.volumesOwned,
    ownedList: parseVolumes(form.ownedList) ?? [],
  };
  request.byVolume = form.byVolume;
  // a place only for someone reading it, and only the counters they keep
  if (isReading && form.tracks.chapters) request.bookmark = form.chapter;
  if (isReading && form.tracks.volumes) request.readVolume = form.readVolume;
  // stars only for something they've read some of
  if (form.stage !== "planned" && form.rating) request.rating = form.rating;
  return request;
}
