import { createBrowserRouter, Navigate } from "react-router";
import App from "../App";
import ErrorPage from "./Error/Error";
import Home from "./Home/Home";
import Details from "./Details/Details";
import { UpdateManga } from "./UpdateManga/UpdateManga";
import { AddManga } from "./AddManga/AddManga";
import { AboutPage } from "./About/About";
import { ImportPage } from "./Import/Import";
import { UpdatesPage } from "./Updates/Updates";
import NewReleasesPage from "./NewReleases/NewReleases";
import SettingsPage from "./Settings/Settings";
import SharedShelfPage from "./SharedShelf/SharedShelf";
import SignInPage from "./SignIn/SignIn";
import SignUp from "./SignUp/SignUp";
import FrontDoor from "./Prices/FrontDoor";
import PriceVolume from "./Prices/PriceVolume";
import PriceSeries from "./Prices/PriceSeries";
import ToPriceHome from "./Prices/ToPriceHome";
import SeriesIndex from "./Prices/SeriesIndex";

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
      { path: "/update/:id", element: <UpdateManga /> },
      { path: "/add", element: <AddManga /> },
      { path: "/import", element: <ImportPage /> },
      { path: "/about", element: <AboutPage /> },
      { path: "/updates", element: <UpdatesPage /> },
      { path: "/new-releases", element: <NewReleasesPage /> },
      { path: "/settings/:tab?", element: <SettingsPage /> },
      { path: "/profile", element: <Navigate to="/settings/profile" replace /> },
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
