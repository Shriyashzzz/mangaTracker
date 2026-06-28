import { useRef } from "react";
import styles from "./SignIn.module.css";
import { useNavigate, useOutletContext } from "react-router";

export default function SignInPage() {
  const navigater = useNavigate();
  const userNameRef = useRef(null);
  const passRef = useRef(null);
  const [isSignedIn, setIsSignedIn] = useOutletContext();
  console.log(isSignedIn);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const result = await fetch(`${import.meta.env.VITE_API_URL}/login`, {
      credentials: "include",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: userNameRef.current.value,
        password: passRef.current.value,
      }),
    });

    if (result.status == 200) {
      navigater("/home", { viewTransition: true });
      setIsSignedIn(true);
    }
  };
  return (
    <div className={styles.container}>
      <form method="POST" action="/login" onSubmit={(e) => handleFormSubmit(e)}>
        <input
          ref={userNameRef}
          type="text"
          placeholder="username "
          name="username"
        />
        <input
          ref={passRef}
          type="password"
          placeholder="password"
          name="password"
        />
        <button type="submit">Log In </button>
      </form>
    </div>
  );
}
