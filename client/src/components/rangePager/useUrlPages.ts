// A long list shown a page at a time, with the page in the address
// (?page=2) so a page can be shared, gone back to, and reached by a search
// engine. Gives back the page's items and everything a RangePager needs:
//
//   const { pageItems, pager } = useUrlPages(deals, "deals-list");
//   (20 to a page, or a third argument for another size)
//   <div id="deals-list" /> ...the list of pageItems... <RangePager {...pager} />
//
// Changing page scrolls to the element with `listId`, the top of the list.
// (All series has its own version: its pages also follow a sort and
// letters, pages/Prices/SeriesIndex.tsx.)
import { useEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router";

const PAGE_SIZE = 20;

export function useUrlPages<T>(
  items: T[],
  listId: string,
  pageSize = PAGE_SIZE,
) {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  // in the address pages count from 1; here from 0
  const asked = Math.floor(Number(params.get("page")) || 1);
  const page = Math.min(Math.max(asked, 1), pages) - 1;

  const paramsFor = (index: number) => {
    const next = new URLSearchParams(params);
    if (index) next.set("page", String(index + 1));
    else next.delete("page");
    return next;
  };

  // set by a click on the pager, so opening the page doesn't scroll
  const toListTop = useRef(false);
  useEffect(() => {
    if (!toListTop.current) return;
    toListTop.current = false;
    document
      .getElementById(listId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page, listId]);

  return {
    pageItems: items.slice(page * pageSize, (page + 1) * pageSize),
    pager: {
      total: items.length,
      pageSize,
      page,
      onChange: (index: number) => {
        toListTop.current = true;
        setParams(paramsFor(index), { replace: true });
      },
      hrefFor: (index: number) => {
        const query = paramsFor(index).toString();
        return query ? `${pathname}?${query}` : pathname;
      },
      // "1–20", "21–40"
      labelFor: (start: number, end: number) => `${start + 1}–${end + 1}`,
    },
  };
}
