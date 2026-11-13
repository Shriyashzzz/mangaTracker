// What the add form works out before it saves: which fields have a problem,
// which of them to take the reader to, and the request sent to the server.
// Pure: no requests and no state.
import { chapterProblem, coverLinkProblem } from "../../lib/formChecks";
import { parseVolumes } from "../../lib/ownedVolumes";
import type { MangaForm } from "../../lib/types";
import type { Stage } from "../../components/statusField/StatusField";

// what the form holds when Save is pressed
export type AddFormValues = {
  title: string;
  // still reading, finished it, or want to read (not started)
  stage: Stage;
  chapter: string;
  readVolume: string;
  // which counters this series shows (lib/reading.ts tracksOf)
  tracks: { chapters: boolean; volumes: boolean };
  byVolume: boolean;
  rating: number;
  image: string;
  // they typed their own cover link
  ownCover: boolean;
  genre: string;
  description: string;
  lightNovel: boolean;
  // the volume picker's two hidden fields, as the form holds them
  volumesOwned: string;
  ownedList: string;
};

export type FieldProblems = {
  title?: string;
  bookmark?: string;
  image?: string;
};

// what's wrong with each field, said under it. A chapter is only asked of
// someone reading by the chapter: a collector tracking volumes needn't say one
export function problemsIn(form: AddFormValues): FieldProblems {
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
export function requestFor(form: AddFormValues): MangaForm {
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
