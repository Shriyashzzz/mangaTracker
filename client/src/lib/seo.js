import { useEffect } from "react";

// Per-page title, description, canonical link, social preview and
// structured data. The site is rendered in the browser, so these are set
// once a page knows what it shows; Google reads them after running the
// page's JavaScript. index.html carries the defaults for the home page.
const SITE_NAME = "Manga Tracker";
const DEFAULT_TITLE = "Manga Tracker: compare US manga prices";
const DEFAULT_DESCRIPTION =
  "Compare US manga prices across stores for every volume, and track the chapter you're on in every series you read.";

// finds a <meta>/<link> in <head>, making it when the page has none
const headTag = (tag, key, value) => {
  let el = document.head.querySelector(`${tag}[${key}="${value}"]`);
  if (!el) {
    el = document.createElement(tag);
    el.setAttribute(key, value);
    document.head.appendChild(el);
  }
  return el;
};

const setMeta = (key, value, content) =>
  headTag("meta", key, value).setAttribute("content", content);

// long descriptions get cut off in search results anyway; end on a word
export const clip = (text, max = 155) => {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
};

function apply({ title, description, path, image, noindex, jsonLd }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const desc = description || DEFAULT_DESCRIPTION;
  const url = new URL(path ?? location.pathname, location.origin).href;

  document.title = fullTitle;
  setMeta("name", "description", desc);
  headTag("link", "rel", "canonical").setAttribute("href", url);
  setMeta("property", "og:title", fullTitle);
  setMeta("property", "og:description", desc);
  setMeta("property", "og:url", url);
  setMeta("property", "og:type", "website");
  setMeta("property", "og:site_name", SITE_NAME);
  if (image) setMeta("property", "og:image", image);
  else document.head.querySelector('meta[property="og:image"]')?.remove();
  setMeta("name", "twitter:card", image ? "summary_large_image" : "summary");

  if (noindex) setMeta("name", "robots", "noindex");
  else document.head.querySelector('meta[name="robots"]')?.remove();

  const old = document.getElementById("page-jsonld");
  if (jsonLd) {
    const script = old ?? document.createElement("script");
    script.id = "page-jsonld";
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    if (!old) document.head.appendChild(script);
  } else old?.remove();
}

// `meta` is null while a page is still loading what it shows. The tags are
// left as they are meanwhile: on a first visit they're the ones the site's
// server already wrote for this page (server.js), and they stay right even
// if loading fails
export function usePageMeta(meta) {
  const key = JSON.stringify(meta);
  useEffect(() => {
    if (meta) apply(meta);
    // the key stands for meta, which is a fresh object every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

// pages behind a sign-in, or with nothing worth finding in a search
export const usePrivatePage = (title) => usePageMeta({ title, noindex: true });

export const breadcrumbs = (items) => ({
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({
    "@type": "ListItem",
    position: i + 1,
    name,
    item: new URL(path, location.origin).href,
  })),
});
