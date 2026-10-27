// The masthead: logo, the two halves of the app (Prices, My shelf), and the
// settings menu. Sits on a newspaper-style double rule.
import { NavLink, useLocation, useNavigate } from "react-router";
import clsx from "clsx";
// same mark as the favicon: a manga volume in an inked panel
import logo from "../../assets/logo.svg";
import SettingsMenu from "../../components/settingsMenu/SettingsMenu";
import { useAuth } from "../../store/auth";

const linkClass = (active: boolean) =>
  clsx(
    "relative py-1 text-[0.95rem] transition-colors duration-150 hover:text-ink",
    active ? "squiggle text-ink" : "text-ink-soft",
  );

export default function Header() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isSignedIn, logOut } = useAuth();
  // the price checker lives at "/" and under /prices
  const onPrices = pathname === "/" || pathname.startsWith("/prices");

  const handleLogOut = async () => {
    if (await logOut()) navigate("/", { viewTransition: true });
  };

  return (
    <header className="relative z-10 border-b-[3px] border-double border-line bg-paper">
      <div className="px-gutter mx-auto flex h-[62px] max-w-page items-center gap-4">
        <NavLink
          to="/"
          viewTransition
          className="group mr-auto flex items-center gap-[0.55rem] font-brand text-[1.6rem] leading-none tracking-[1px]"
        >
          <img
            src={logo}
            alt=""
            className="size-[30px] transition-transform duration-250 ease-ink group-hover:-rotate-10"
          />
          {/* the logo alone on small phones */}
          <span className="upto-560:sr-only">Manga Tracker</span>
        </NavLink>

        <nav className="flex items-center gap-[1.4rem] upto-560:gap-4" aria-label="Main">
          <NavLink to="/" className={() => linkClass(onPrices)} viewTransition>
            Prices
          </NavLink>
          <NavLink
            to="/shelf"
            className={({ isActive }) => linkClass(isActive)}
            viewTransition
          >
            My shelf
          </NavLink>
          {isSignedIn === false && (
            <NavLink
              to="/signin"
              className={({ isActive }) => linkClass(isActive)}
              viewTransition
            >
              Sign in
            </NavLink>
          )}
        </nav>

        <SettingsMenu isSignedIn={isSignedIn} onLogOut={handleLogOut} />
      </div>
    </header>
  );
}
