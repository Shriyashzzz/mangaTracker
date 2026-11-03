// Names for anyone who hasn't picked their own. Each account always gets the same
// one until they do, and the profile page offers them all through "Surprise me".
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

export const defaultReaderName = (userId: number) =>
  READER_NAMES[userId % READER_NAMES.length]!;
