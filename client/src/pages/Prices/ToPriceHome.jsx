import { Navigate, useLocation } from "react-router";

// old /prices?q=... links land on the price home with their search intact
export default function ToPriceHome() {
  const { search } = useLocation();
  return <Navigate to={`/${search}`} replace />;
}
