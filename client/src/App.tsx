// The page frame every route shares: backdrop, header, the page, footer.
// Asks the server once whether someone is signed in (store/auth.ts).
import { useEffect } from "react";
import { Outlet, ScrollRestoration } from "react-router";
import "./index.css";
import Backdrop from "./components/backdrop/Backdrop";
import Header from "./layouts/header/Header";
import Footer from "./layouts/Footer/Footer";
import { useAuth } from "./store/auth";

export default function App() {
  const check = useAuth((s) => s.check);
  useEffect(() => {
    check();
  }, [check]);

  return (
    <>
      <Backdrop />
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </>
  );
}
