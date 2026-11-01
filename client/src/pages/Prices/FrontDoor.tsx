// "/" is the price search, but someone signed in who has just opened the site
// came for their shelf. Only on arrival: the Prices link and the logo also lead
// here, and those still have to reach the search.
import { Navigate, useLocation, useSearchParams } from "react-router";
import SlowLoadQuote from "../../components/slowLoadQuote/SlowLoadQuote";
import { probablySignedIn, useAuth } from "../../store/auth";
import PriceSearch from "./PriceSearch";

export default function FrontDoor() {
  const isSignedIn = useAuth((s) => s.isSignedIn);
  const { key } = useLocation();
  const [params] = useSearchParams();
  // the router calls the entry a visit starts on "default"; a shared search
  // link still gets its search
  const justArrived = key === "default" && !params.has("q");

  if (justArrived && isSignedIn) return <Navigate to="/shelf" replace />;
  if (justArrived && isSignedIn === null && probablySignedIn()) {
    return (
      <div aria-busy="true" aria-label="Loading">
        <SlowLoadQuote />
      </div>
    );
  }
  return <PriceSearch />;
}
