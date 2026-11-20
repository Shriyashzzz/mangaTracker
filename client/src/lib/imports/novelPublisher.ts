// A book from a novel or classics publisher (Oxford, Penguin Classics,
// Vintage): from a general reader's library, Madame Bovary or The Long
// Goodbye, which AniList finds a manga adaptation of by the same name. A
// series whose books all are is left unticked in the import, said why.
// Checked against collectors' exports (about 9,000 books): none of their
// manga is caught. So never:
// - Del Rey, Ballantine, St. Martin's: they published manga (xxxHolic,
//   Fairy Tail, Dark-Hunters)
// - a publisher that also names a manga one ("Tor/Seven Seas", "Orbit/Yen
//   Press")
// - a title that says it's the manga ("Daniel X: The Manga")
// Random House, Little, Brown, HarperCollins and plain Penguin are left off
// too: they distribute Kodansha and Yen Press books under their own names.
const NOVEL_HOUSE =
  /^(oxford( university)?|penguin (classics|books|modern classics)|vintage|w\.? ?w\.? norton|norton|signet|new directions|(random house: )?modern library|berkley|tor|tor books|bantam|scribner|(alfred a\.? )?knopf|picador|faber|everyman|wordsworth|dover|bloomsbury|riverhead|grove|farrar|doubleday|anchor|harper perennial|mariner|houghton|puffin|orbit|ace|daw|gallery|saga press|simon (&|and) schuster|crown|hachette|mcsweeney|graywolf|coffee house|melville house|nyrb|new york review|verso|ak press|pm press|beacon|routledge|duke university|princeton|harvard|yale|mit press|university of)\b/i;
const MANGA_HOUSE =
  /\b(viz|kodansha|yen (press|on)|seven seas|dark horse|square enix|tokyopop|vertical|haikasoru|j-novel)\b/i;

// the publisher's name when it's a novel house, for the row to say
export function novelPublisherOf(title: string, publisher: string) {
  const name = publisher.trim();
  if (!NOVEL_HOUSE.test(name) || MANGA_HOUSE.test(name)) return null;
  if (/\bmanga\b/i.test(title)) return null;
  return name;
}

// a book's field, when it has one
export const novelPublisherField = (title: string, publisher: string) => {
  const name = novelPublisherOf(title, publisher);
  return name ? { novelPublisher: name } : {};
};
