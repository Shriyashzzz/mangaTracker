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

export const routes = [
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Home /> },
      { path: "/signin", element: <SignInPage /> },
      { path: "/details/:id", element: <Details /> },
      { path: "/update/:id", element: <UpdateManga /> },
      { path: "/add", element: <AddManga /> },
      { path: "/about", element: <AboutPage /> },
      { path: "/signup", element: <SignUp /> },
    ],
  },
];

const router = createBrowserRouter(routes);
export default router;
