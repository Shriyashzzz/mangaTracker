// Whether the prices this browser asks for are Canadian. Canada picked (in
// settings, the menu or a price page's switch), and not the practice demo,
// whose prices are fixed US ones. One answer for the whole site: every price
// request says it (withCountry), and every price shown is formatted by it
// (formatCents), so a Canadian sees Canadian dollars or no price, never a US
// price that reads like a Canadian one
import { isDemo } from "./demo";

export const inCanada = () => {
  if (isDemo()) return false;
  try {
    return localStorage.getItem("country") === "ca";
  } catch {
    return false;
  }
};

// an API address, asking for Canadian prices when that's where they shop.
// Routes with no prices just ignore it
export const withCountry = (path: string) =>
  inCanada() ? `${path}${path.includes("?") ? "&" : "?"}country=ca` : path;

// a big amount in whole dollars, in the currency of the prices shown: "$1,560",
// "CA$1,560"
export const wholeMoney = (cents: number) =>
  `${inCanada() ? "CA$" : "$"}${Math.round(cents / 100).toLocaleString("en-US")}`;
