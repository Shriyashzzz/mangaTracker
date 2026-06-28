import styles from "./Header.module.css";
import appIcon from "../../assets/appIcon.png";
import { NavLink, useNavigate } from "react-router";
import { useEffect } from "react";

export default function Header({ isSignedIn, setIsSignedIn }) {
  const navigator = useNavigate();

  const sendLogOutSignal = async () => {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/logout`, {
      credentials: "include",
      method: "GET",
    });
    if (response.status == 200) {
      setIsSignedIn(false);
      navigator("/");
    } else {
      setIsSignedIn(true);
    }
  };

  return (
    <>
      <header className={styles.head}>
        <NavLink className={styles.appName} to="/home" viewTransition>
          <img src={appIcon} alt="" /> <h2>Manga Tracker</h2>
        </NavLink>
        <ul>
          <li>
            {" "}
            <NavLink to="/home" viewTransition>
              <button>Home</button>
            </NavLink>
          </li>
          <li>
            <NavLink to="/about" viewTransition>
              <button>About</button>
            </NavLink>
          </li>

          <li>
            {isSignedIn ? (
              <button onClick={sendLogOutSignal}>Log out</button>
            ) : (
              <NavLink to="/" viewTransition>
                <button>Sign in</button>
              </NavLink>
            )}
          </li>
        </ul>
      </header>
    </>
  );
}
