// The masthead: logo, the two halves of the app (Prices, My shelf; a bar along
// the bottom on phones), and the settings menu. Sits on a newspaper-style double rule.
import { NavLink, useLocation, useNavigate } from "react-router";
import clsx from "clsx";
// same mark as the favicon: a manga volume in an inked panel
import logo from "../../assets/logo.svg";
import SettingsMenu from "../../components/settingsMenu/SettingsMenu";
import { useAuth } from "../../store/auth";

const linkClass = (active: boolean) =>
  clsx(
    "tap relative py-1 text-[0.95rem] transition-colors duration-150 hover:text-ink",
    active ? "squiggle text-ink" : "text-ink-soft",
  );

// one side of the phones' bottom bar: the whole width is the target
const barClass = (active: boolean) =>
  clsx(
    "grid min-h-14 flex-1 place-items-center font-brand text-[1.2rem] tracking-[1px] uppercase transition-colors duration-150",
    active ? "bg-accent text-on-accent" : "text-ink-soft",
  );

export default function Header() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isSignedIn, logOut } = useAuth();
  // the price checker lives at "/", under /prices and at /series
  const onPrices =
    pathname === "/" ||
    pathname.startsWith("/prices") ||
    pathname.startsWith("/series");

  const handleLogOut = async () => {
    if (await logOut()) navigate("/", { viewTransition: true });
  };

  return (
    <header className="relative z-10 border-b-[3px] border-double border-line bg-paper">
      <div className="px-gutter mx-auto flex h-[62px] max-w-page items-center gap-4">
        <NavLink
          to="/"
          viewTransition
          className="tap group mr-auto flex items-center gap-[0.55rem] font-brand text-[1.6rem] leading-none tracking-[1px]"
        >
          <img
            src={logo}
            alt=""
            className="size-[30px] transition-transform duration-250 ease-ink group-hover:-rotate-10"
          />
          <span>Manga Tracker</span>
        </NavLink>

        {/* phones have it at the bottom, within reach of a thumb */}
        <nav className="flex items-center gap-[1.4rem] upto-720:hidden" aria-label="Main">
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

      {/* out of the way while the keyboard is up */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 hidden border-t-[3px] border-double border-line bg-paper pb-[env(safe-area-inset-bottom)] upto-720:flex [body:has(input:focus,textarea:focus,select:focus)_&]:hidden!"
        aria-label="Main"
      >
        <NavLink to="/" className={() => barClass(onPrices)} viewTransition>
          Prices
        </NavLink>
        <NavLink
          to="/shelf"
          className={({ isActive }) => barClass(isActive)}
          viewTransition
        >
          My shelf
        </NavLink>
        {isSignedIn === false && (
          <NavLink
            to="/signin"
            className={({ isActive }) => barClass(isActive)}
            viewTransition
          >
            Sign in
          </NavLink>
        )}
      </nav>
    </header>
  );
}
