// Back to the shelf's New tab, exactly as they left it: the Hidden list if that's
// where they were, and at the same scroll. Only shown after coming from there, so
// there's always a step to go back to.
import { NavLink, useNavigate } from "react-router";
import { ChevronLeftIcon } from "../../components/icons/Icons";
import { pricesStyles as styles } from "./styles";

export default function BackToNew() {
  const navigate = useNavigate();
  return (
    <NavLink
      to="/shelf"
      className={styles.backToNew}
      onClick={(e) => {
        e.preventDefault();
        navigate(-1);
      }}
    >
      <ChevronLeftIcon aria-hidden />
      Back to New
    </NavLink>
  );
}
