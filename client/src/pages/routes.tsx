import { createBrowserRouter, Navigate } from "react-router";
import App from "../App";
import ErrorPage from "./Error/Error";
import Home from "./Home/Home";
import Details from "./Details/Details";
import SignInPage from "./SignIn/SignIn";
import SignUp from "./SignUp/SignUp";
import FrontDoor from "./Prices/FrontDoor";
import ToPriceHome from "./Prices/ToPriceHome";

// pages most visits never open load when they're first opened: the router
// fetches the page's code, then shows it (no loading flash in between). The
// shelf, details, the front door and signing in are in the first download
const page =
  <T,>(load: () => Promise<T>, pick: (module: T) => React.ComponentType) =>
  async () => ({ Component: pick(await load()) });

export const routes = [
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
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
      {
        path: "/about",
        lazy: page(
          () => import("./About/About"),
          (m) => m.AboutPage,
        ),
      },
      {
        path: "/updates",
        lazy: page(
          () => import("./Updates/Updates"),
          (m) => m.UpdatesPage,
        ),
      },
      {
        path: "/acknowledgements",
        lazy: page(
          () => import("./Acknowledgements/Acknowledgements"),
          (m) => m.AcknowledgementsPage,
        ),
      },
      {
        path: "/new-releases",
        lazy: page(
          () => import("./NewReleases/NewReleases"),
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
      {
        path: "/u/:code",
        lazy: page(
          () => import("./SharedShelf/SharedShelf"),
          (m) => m.default,
        ),
      },
      { path: "/signup", element: <SignUp /> },
      {
        path: "/series",
        lazy: page(
          () => import("./Prices/SeriesIndex"),
          (m) => m.default,
        ),
      },
      { path: "/prices", element: <ToPriceHome /> },
      {
        path: "/prices/series/:slug",
        lazy: page(
          () => import("./Prices/PriceSeries"),
          (m) => m.default,
        ),
      },
      // the title part is optional, so ISBN-only links keep working
      {
        path: "/prices/:isbn/:slug?",
        lazy: page(
          () => import("./Prices/PriceVolume"),
          (m) => m.default,
        ),
      },
      // an unknown address keeps the header and footer, so there's a way on
      { path: "*", element: <ErrorPage /> },
    ],
  },
];

const router = createBrowserRouter(routes);
export default router;
