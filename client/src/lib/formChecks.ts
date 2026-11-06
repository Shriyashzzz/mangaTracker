// The add and edit forms check these themselves (they're noValidate, so the
// browser's own bubbles don't speak for them), in the site's words, before
// the server would turn them away in its own

// a chapter typed in: blank is the caller's call; below 0 or not a number isn't
export const chapterProblem = (text: string) => {
  const t = text.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return "That isn't a chapter number.";
  if (n < 0) return "A chapter can't be below 0.";
  return undefined;
};

// a pasted cover link: a web address, or nothing
export const coverLinkProblem = (url: string) =>
  url && !/^https?:\/\/\S+$/i.test(url.trim())
    ? "That isn't a web address. Paste one that starts with https://"
    : undefined;
