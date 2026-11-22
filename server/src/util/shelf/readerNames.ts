import { withoutDirectionMarks } from "../directionMarks.js";
// Names for anyone who hasn't picked their own. Each account always gets the same
// one (with a number, below) until they do, and the profile page offers them
// all through "Surprise me".
export const READER_NAMES = [
  "Chapter Goblin",
  "Cliffhanger Survivor",
  "Tsundoku Champion",
  "Filler Arc Defender",
  "Backlog Wizard",
  "Panel Gremlin",
  "Margin Doodler",
  "Spoiler Dodger",
  "Volume Hoarder",
  "Screentone Spirit",
  "Ink-Stained Menace",
  "Sleepless Reader",
  "Plot Armor Enjoyer",
  "Side Character #7",
  "Hiatus Survivor",
  "Last Panel Peeker",
  "Final Arc Crier",
  "Bookmark Bandit",
  "Right-to-Left Legend",
  "Bonus Page Enjoyer",
  "Power of Friendship",
  "Mysterious Transfer Student",
  "Flashback Enthusiast",
  "Tournament Arc Fan",
  "Author's Note Reader",
  "Cover Art Collector",
  "Dramatic Wind Haver",
  "One More Chapter",
  "Sweat Drop Specialist",
  "Unnamed Background Girl",
];

// The stand-in name: one of the names above and a four-digit number,
// "Spoiler Dodger #4821", so two readers without a name of their own are
// told apart (30 names alone repeated every 30th account). Both come from
// the account's number, so it's always the same for one account and
// nothing is stored; they're stepped by primes, so accounts made one after
// another get names and numbers that look unrelated, and no two of the
// first 30,000 accounts share both
const NAME_STEP = 17;
const NUMBER_STEP = 7919;
const NUMBER_START = 1234;
const NUMBERS = 10_000;

export function defaultReaderName(userId: number) {
  const name = READER_NAMES[(userId * NAME_STEP) % READER_NAMES.length]!;
  const number = (userId * NUMBER_STEP + NUMBER_START) % NUMBERS;
  const digits = String(number).padStart(4, "0");
  // "Side Character #7" carries a number already: it takes this one
  return /#\d+$/.test(name)
    ? name.replace(/#\d+$/, `#${digits}`)
    : `${name} #${digits}`;
}

// the name others see for a reader: theirs, cleaned of characters that
// would turn it around (directionMarks.ts), or else the one picked for them
export const readerName = (user: { id: number; displayName: string | null }) =>
  withoutDirectionMarks(user.displayName ?? "").trim() ||
  defaultReaderName(user.id);
