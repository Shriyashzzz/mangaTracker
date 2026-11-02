// A card on the New tab opens a price page. Moving around prices from there stays
// one step away from New: each move replaces the last, so one back (the Android
// gesture too) returns to New instead of walking back through every volume.
import { useLocation } from "react-router";

export const useFromShelf = () => {
  const { state } = useLocation();
  return Boolean((state as { fromShelf?: boolean } | null)?.fromShelf);
};

// for a link that stays within that trip; nothing changes for anyone else
export const stayInTrip = (fromShelf: boolean) =>
  fromShelf ? { replace: true, state: { fromShelf: true } } : {};
