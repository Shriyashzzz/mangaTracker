// Kenji's notes take turns: one a visit (this browser tab). Each note asks
// noteFree before it shows and claims it when it does. The tour itself is
// offered on the empty shelf, never by a note

const KEY = "noteThisVisit";

type NoteName = "release" | "view" | "support" | "weekly";

const shownThisVisit = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const noteFree = (name: NoteName) => {
  const shown = shownThisVisit();
  return !shown || shown === name;
};

export const claimNote = (name: NoteName) => {
  try {
    sessionStorage.setItem(KEY, name);
  } catch {
    // storage can be blocked; notes just don't take turns then
  }
};
