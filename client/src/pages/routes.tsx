import { createBrowserRouter, Navigate } from "react-router";
import App from "../App";
import ErrorPage from "./Error/Error";
import Home from "./Home/Home";
import Details from "./Details/Details";
import SignInPage from "./SignIn/SignIn";
import SignUp from "./SignUp/SignUp";
import FrontDoor from "./Prices/FrontDoor";
import ToPriceHome from "./Prices/ToPriceHome";
import { AboutPage } from "./About/About";
import { UpdatesPage } from "./Updates/Updates";
import { AcknowledgementsPage } from "./Acknowledgements/Acknowledgements";
import NewReleasesPage from "./NewReleases/NewReleases";
import SharedShelfPage from "./SharedShelf/SharedShelf";
import SeriesIndex from "./Prices/SeriesIndex";
import PriceSeries from "./Prices/PriceSeries";
import PriceVolume from "./Prices/PriceVolume";

// The signed-in tools (Add, Edit, Import, Settings) load when first opened:
// the router fetches the page's code, then shows it, so moving around the app
// has no loading flash. Opened straight from the address bar, HydrateFallback
// holds the page meanwhile. Pages people arrive on from outside (search,
// shared links: prices, series, shared shelves, about) are in the first
// download, so they show at once.
const page =
  <T,>(load: () => Promise<T>, pick: (module: T) => React.ComponentType) =>
  async () => ({ Component: pick(await load()) });

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
      { path: "/shelf", element: <Home /> },
      { path: "/signin", element: <SignInPage /> },
      { path: "/details/:id", element: <Details /> },
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
      { path: "/acknowledgements", element: <AcknowledgementsPage /> },
      { path: "/new-releases", element: <NewReleasesPage /> },
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
