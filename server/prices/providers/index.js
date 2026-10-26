import googleBooks from "./googleBooks.js";
import ebay from "./ebay.js";
import walmart from "./walmart.js";
import keepa from "./keepa.js";
import serpapi from "./serpapi.js";

// every price source we know about. Each one switches itself on when its
// keys are present in server/.env
export const PROVIDERS = [serpapi, ebay, walmart, keepa, googleBooks];

export const enabledProviders = () => PROVIDERS.filter((p) => p.enabled());
