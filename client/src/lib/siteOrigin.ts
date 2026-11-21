// The website's own address, for links that leave the page (a shared shelf's
// link). On its own so code that runs outside a browser (the Android app's
// copy of lib/) can give its own
export const siteOrigin = () => window.location.origin;
