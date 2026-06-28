import { useRef } from "react";
import styles from "./SignUp.module.css";
import { useNavigate, useOutletContext } from "react-router";
import { useState } from "react";
export default function SignUp() {
  const navigater = useNavigate();
  const userNameRef = useRef(null);
  const passRef = useRef(null);
  const [error, setError] = useState();
  const [isSignedIn, setIsSignedIn] = useOutletContext();
  console.log(isSignedIn);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const result = await fetch(`${import.meta.env.VITE_API_URL}/signup`, {
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

    if (result.ok) {
      navigater("/home", { viewTransition: true });
      setIsSignedIn(true);
    } else {
      const data = await result.json();
      console.log(data.errors);
    }
  };
  return (
    <div className={styles.container}>
      <form method="POST" onSubmit={(e) => handleFormSubmit(e)}>
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
        <button type="submit">Sign Up </button>
      </form>
    </div>
  );
}
