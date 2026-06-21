import { createBrowserRouter } from "react-router";
import App from "../App";
import ErrorPage from "./Error/Error";
import Home from "./Home/Home";
import Details from "./Details/Details";
import { UpdateManga } from "./UpdateManga/UpdateManga";
export const routes = [
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Home /> },
      { path: "/details/:id", element: <Details /> },
      { path: "/update/:id", element: <UpdateManga /> },
    ],
  },
];

const router = createBrowserRouter(routes);
export default router;
