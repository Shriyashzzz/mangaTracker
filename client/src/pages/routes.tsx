import { createBrowserRouter } from "react-router";
import App from "../App";
import ErrorPage from "./Error/Error";
import Home from "./Home/Home";
import Details from "./Details/Details";
import { UpdateManga } from "./UpdateManga/UpdateManga";
import { AddManga } from "./AddManga/AddManga";
import { AboutPage } from "./About/About";
import SignInPage from "./SignIn/SignIn";
import SignUp from "./SignUp/SignUp";
import PriceSearch from "./Prices/PriceSearch";
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
      // the price checker is the front door; the shelf is one click away
      { index: true, element: <PriceSearch /> },
      { path: "/shelf", element: <Home /> },
      { path: "/signin", element: <SignInPage /> },
      { path: "/details/:id", element: <Details /> },
      { path: "/update/:id", element: <UpdateManga /> },
      { path: "/add", element: <AddManga /> },
      { path: "/about", element: <AboutPage /> },
      { path: "/signup", element: <SignUp /> },
      { path: "/series", element: <SeriesIndex /> },
      { path: "/prices", element: <ToPriceHome /> },
      { path: "/prices/series/:slug", element: <PriceSeries /> },
      // the title part is optional, so ISBN-only links keep working
      { path: "/prices/:isbn/:slug?", element: <PriceVolume /> },
    ],
  },
];

const router = createBrowserRouter(routes);
export default router;
