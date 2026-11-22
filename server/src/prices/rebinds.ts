// Library rebinds of a publisher's paperback, told by how their ISBNs start.
// The same pages in a hard library cover at three times the price, often
// with another edition's cover picture or none (One Piece 8, 10 and 17,
// Hunter x Hunter 14, Sgt. Frog 1 and 2 were all listed under these). The
// publisher's own edition of a volume always wins over one, and a volume
// only known as one is looked up again (seriesService gapVolumes).
//
//   Turtleback        978-1-417, 978-0-606
//   Tandem Library    978-0-613
//   San Val           978-1-4155
//   Paw Prints        978-1-4287, 978-1-4352, 978-1-4395, 978-1-4420,
//                     978-1-4517, 978-1-5182
//   FollettBound      978-0-329
//
// Gollancz's UK printing (978-0-575, Detective Conan 3, 6, 8 and 9) is
// treated the same: the US publisher's own wins when a catalog has it.
//
// On its own, with no imports: the catalog reader and the series list both
// need it
const REBIND =
  /^(9781417|9780606|9780613|9780575|9781415|9781428|9781435|9781439|9781442|9781451|9781518|9780329)/;
export const isRebind = (isbn13: string) => REBIND.test(isbn13.trim());
