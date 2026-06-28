import Header from "./layouts/header/Header";
import "./App.css";
import { Outlet } from "react-router";
import Footer from "./layouts/Footer/Footer";
import { useState, useEffect } from "react";

function App() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  useEffect(() => {
    const checkIfSignedIn = async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/me`, {
        credentials: "include",
        method: "GET",
      });
      if (response.ok) {
        setIsSignedIn(true);
      } else {
        setIsSignedIn(false);
      }
    };
    checkIfSignedIn();
  }, []);
  return (
    <>
      <Header setIsSignedIn={setIsSignedIn} isSignedIn={isSignedIn} />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

export default App;
