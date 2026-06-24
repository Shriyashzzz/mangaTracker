import Header from "./layouts/header/Header";
import "./App.css";
import { Outlet } from "react-router";
import Footer from "./layouts/Footer/Footer";

function App() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

export default App;
