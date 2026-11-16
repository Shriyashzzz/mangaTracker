// The invisible characters that turn text around (U+202E "right-to-left
// override" and its kin). In a display name they showed it backwards on the
// shared shelf. Taken out when a name is saved, and when an older saved one
// is shown
const DIRECTION_MARKS = /[‎‏؜‪-‮⁦-⁩]/g;

export const withoutDirectionMarks = (text: string) =>
  text.replace(DIRECTION_MARKS, "");

// as a request field's cleanup: text loses the marks, anything else is left
// for the field's own rules to turn away
export const directionMarksOff = (value: unknown) =>
  typeof value === "string" ? withoutDirectionMarks(value) : value;
