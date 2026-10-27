// Every price source we know about. Each one switches itself on when its
// keys are present in server/.env, so adding a store = one file + one line
import type { Provider } from "../types.js";
import serpapi from "./serpapi.js";
import ebay from "./ebay.js";
import walmart from "./walmart.js";
import keepa from "./keepa.js";
import googleBooks from "./googleBooks.js";

export const PROVIDERS: Provider[] = [serpapi, ebay, walmart, keepa, googleBooks];

export const enabledProviders = () => PROVIDERS.filter((p) => p.enabled());
