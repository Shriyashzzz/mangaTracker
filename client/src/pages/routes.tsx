import { createBrowserRouter, Navigate } from "react-router";
import App from "../App";
import ErrorPage from "./Error/Error";
import { probablySignedIn } from "../store/auth";
import SignInPage from "./SignIn/SignIn";
import SignUp from "./SignUp/SignUp";
import FrontDoor from "./Prices/FrontDoor";
import ToPriceHome from "./Prices/ToPriceHome";
import { AboutPage } from "./About/About";
import { UpdatesPage } from "./Updates/Updates";
import { FaqPage } from "./Faq/Faq";
import { AcknowledgementsPage } from "./Acknowledgements/Acknowledgements";
import SharedShelfPage from "./SharedShelf/SharedShelf";
import SeriesIndex from "./Prices/SeriesIndex";
import Deals from "./Prices/Deals";
import PriceSeries from "./Prices/PriceSeries";
import PriceVolume from "./Prices/PriceVolume";

// The signed-in pages (the shelf, a series, the calendar, Add, Edit, Import,
// Settings) load when first opened: the router fetches the page's code, then
// shows it, so moving around the app has no loading flash. Opened straight
// from the address bar, HydrateFallback holds the page meanwhile. Pages people
// arrive on from outside (search, shared links: prices, series, shared
// shelves, about) are in the first download, so they show at once, and aren't
// made to carry the shelf's code.
const page =
  <T,>(load: () => Promise<T>, pick: (module: T) => React.ComponentType) =>
  async () => ({ Component: pick(await load()) });

const loadShelf = () => import("./Home/Home");
// someone signed in came for their shelf: its code is asked for at once,
// beside the first download, not after it
if (probablySignedIn()) void loadShelf();

export const routes = [
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
    // while a lazy page loads on a first visit straight to it
    HydrateFallback: () => <div className="min-h-dvh" aria-busy="true" />,
    children: [
      // the price checker is the front door, except that someone signed in
      // arrives on their shelf
      { index: true, element: <FrontDoor /> },
      { path: "/shelf", lazy: page(loadShelf, (m) => m.default) },
      { path: "/signin", element: <SignInPage /> },
      {
        path: "/details/:id",
        lazy: page(
          () => import("./Details/Details"),
          (m) => m.default,
        ),
      },
      {
        path: "/update/:id",
        lazy: page(
          () => import("./UpdateManga/UpdateManga"),
          (m) => m.UpdateManga,
        ),
      },
      {
        path: "/add",
        lazy: page(
          () => import("./AddManga/AddManga"),
          (m) => m.AddManga,
        ),
      },
      {
        path: "/import",
        lazy: page(
          () => import("./Import/Import"),
          (m) => m.ImportPage,
        ),
      },
      { path: "/about", element: <AboutPage /> },
      { path: "/updates", element: <UpdatesPage /> },
      { path: "/faq", element: <FaqPage /> },
      { path: "/acknowledgements", element: <AcknowledgementsPage /> },
      {
        path: "/new-releases",
        lazy: page(
          () => import("./NewReleases/NewReleases"),
          (m) => m.default,
        ),
      },
      {
        path: "/calendar",
        lazy: page(
          () => import("./Calendar/Calendar"),
          (m) => m.default,
        ),
      },
      {
        path: "/settings/:tab?",
        lazy: page(
          () => import("./Settings/Settings"),
          (m) => m.default,
        ),
      },
      {
        path: "/profile",
        element: <Navigate to="/settings/profile" replace />,
      },
      { path: "/u/:code", element: <SharedShelfPage /> },
      { path: "/signup", element: <SignUp /> },
      { path: "/series", element: <SeriesIndex /> },
      { path: "/deals", element: <Deals /> },
      {
        path: "/after-the-anime",
        lazy: page(
          () => import("./AfterAnime/AfterAnimeIndex"),
          (m) => m.default,
        ),
      },
      {
        // for the site's owner; anyone else gets the not-found page
        path: "/reviews/reported",
        lazy: page(
          () => import("./Prices/reviews/ReportedReviews"),
          (m) => m.default,
        ),
      },
      {
        // for the site's owner; anyone else gets the not-found page
        path: "/after-the-anime/review",
        lazy: page(
          () => import("./AfterAnime/ReviewFixes"),
          (m) => m.default,
        ),
      },
      {
        path: "/after-the-anime/:slug",
        lazy: page(
          () => import("./AfterAnime/AfterAnimeShow"),
          (m) => m.default,
        ),
      },
      { path: "/prices", element: <ToPriceHome /> },
      { path: "/prices/series/:slug", element: <PriceSeries /> },
      // the title part is optional, so ISBN-only links keep working
      { path: "/prices/:isbn/:slug?", element: <PriceVolume /> },
      // an unknown address keeps the header and footer, so there's a way on
      { path: "*", element: <ErrorPage /> },
    ],
  },
];

const router = createBrowserRouter(routes);
export default router;
