import Header from "./layouts/header/Header";
import "./App.css";
import { Outlet, ScrollRestoration } from "react-router";
import Footer from "./layouts/Footer/Footer";
import { useState, useEffect } from "react";
import { apiFetch } from "./lib/api";

function App() {
  // null while we're still asking the server, so pages don't flash the guest view
  const [isSignedIn, setIsSignedIn] = useState(null);
  useEffect(() => {
    const checkIfSignedIn = async () => {
      try {
        const response = await apiFetch("/api/me");
        setIsSignedIn(response.ok);
      } catch {
        setIsSignedIn(false);
      }
    };
    checkIfSignedIn();
  }, []);
  return (
    <>
      <Header setIsSignedIn={setIsSignedIn} isSignedIn={isSignedIn} />
      <main>
        <Outlet context={[isSignedIn, setIsSignedIn]} />
      </main>
      <Footer />
      <ScrollRestoration />
    </>
  );
}

export default App;
