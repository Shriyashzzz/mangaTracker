// Adding to the shelf from the shelf: the phone's round + asks "type a title
// or scan barcodes" (choosing), and the scanner is a sheet over the page
// (scanning). /shelf?scan=978… opens the scanner on that ISBN: the add form
// sends an ISBN typed into it here.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

const ISBN = /^(97[89]\d{10}|\d{9}[\dXx])$/;

export function useAddFlow() {
  const [searchParams, setSearchParams] = useSearchParams();
  // read once, on arrival
  const [scanIsbn] = useState(() => {
    const isbn = searchParams.get("scan");
    return isbn && ISBN.test(isbn) ? isbn : undefined;
  });
  const [adding, setAdding] = useState<null | "choosing" | "scanning">(() =>
    scanIsbn ? "scanning" : null,
  );
  // the ISBN is taken off the address, so a refresh doesn't scan it again
  useEffect(() => {
    if (!scanIsbn) return;
    setSearchParams(
      (params) => {
        params.delete("scan");
        return params;
      },
      { replace: true },
    );
  }, [scanIsbn, setSearchParams]);

  return {
    adding,
    scanIsbn,
    choose: () => setAdding("choosing"),
    scan: () => setAdding("scanning"),
    close: () => setAdding(null),
    // picking one closes the choice too; only a plain close clears it
    closeChoice: () => setAdding((now) => (now === "choosing" ? null : now)),
  };
}
