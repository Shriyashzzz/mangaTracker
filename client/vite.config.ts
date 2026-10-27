import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// robots.txt for the site. The sitemap is made by the API (it knows every
// series and volume), so the address depends on where the API lives.
// server.ts swaps the Sitemap line for the site's own copy in production
const robots = (apiUrl?: string): Plugin => ({
  name: "robots-txt",
  generateBundle() {
    const lines = [
      "User-agent: *",
      // signed-in pages: nothing on them for a search engine
      "Disallow: /shelf",
      "Disallow: /add",
      "Disallow: /update/",
      "Disallow: /details/",
      "Disallow: /signin",
      "Disallow: /signup",
      "",
    ];
    if (apiUrl) lines.push(`Sitemap: ${apiUrl.replace(/\/+$/, "")}/sitemap.xml`);
    this.emitFile({
      type: "asset",
      fileName: "robots.txt",
      source: `${lines.join("\n")}\n`,
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "./", "VITE_");
  return {
    plugins: [react(), tailwindcss(), robots(env.VITE_API_URL)],
    envDir: "./",
  };
});
