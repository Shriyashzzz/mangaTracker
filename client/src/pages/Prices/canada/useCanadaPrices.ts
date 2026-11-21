// A volume's Canadian prices, for the whole volume page: the price box, the
// headline under the title and the price history all read this one answer.
// What's saved shows at once, as the US prices do; then a live check (with
// its Turnstile token, which can take a few seconds) replaces it. A preorder
// is checked too, at eBay.ca only (the server's getCanadaPrices). Asks nothing
// while `isbn` is null (US picked, or the page still loading)
import { useEffect, useState } from "react";
import { getJson } from "../../../lib/api";
import { humanQuery } from "../../../lib/turnstile";
import type { Offer, PriceHistory } from "../../../lib/types";

export type CanadaAnswer = {
  links?: { store: string; url: string; affiliate: boolean }[];
  status: "ok" | "off" | "budget" | "unknown" | "error";
  offers: (Offer & { fetchedAt?: string })[];
  checkedAt: string | null;
  history?: PriceHistory | null;
  usualCents?: number | null;
};

export function useCanadaPrices(isbn: string | null) {
  const [answer, setAnswer] = useState<{
    isbn: string;
    data: CanadaAnswer;
  } | null>(null);

  useEffect(() => {
    if (!isbn) return;
    const controller = new AbortController();
    const ask = (human: string) =>
      getJson<CanadaAnswer>(
        `/api/prices/ca/${isbn}${human}`,
        controller.signal,
      );
    const failed = (e: Error) => {
      if (e.name !== "AbortError")
        setAnswer((had) =>
          // a live check failing after the saved prices showed keeps them
          had?.isbn === isbn
            ? had
            : { isbn, data: { status: "error", offers: [], checkedAt: null } },
        );
    };
    ask("")
      .then((data) => setAnswer({ isbn, data }))
      .catch(failed);
    humanQuery("?", controller.signal)
      .then((human) => (human ? ask(human) : null))
      .then((data) => data && setAnswer({ isbn, data }))
      .catch(failed);
    return () => controller.abort();
  }, [isbn]);

  return answer && answer.isbn === isbn ? answer.data : null;
}
