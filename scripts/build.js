#!/usr/bin/env node
/*
 * Webbi site build. No dependencies: needs only Node.js.
 *
 *   node scripts/build.js              -> writes fr/…, en/…, index.html (+ sitemap.xml, robots.txt) into the repo
 *   node scripts/build.js --out DIR --explicit-index
 *                                       -> same pages into DIR, with links ending in index.html (for local previews)
 *
 * Text lives in js/i18n.js, the page layout in src/template.html, the site address in site.config.json.
 * Run this after changing any of them, then upload the result.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const OUT = args.includes("--out") ? path.resolve(args[args.indexOf("--out") + 1]) : ROOT;
const EXPLICIT = args.includes("--explicit-index");

const config = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
const SITE_URL = (config.siteUrl || "").replace(/\/+$/, "");
const DEFAULT_LANG = config.defaultLang || "fr";

// load the shared dictionary exactly as the browser does
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js/i18n.js"), "utf8"), sandbox);
const DICT = sandbox.window.WEBBI_I18N;

const LANGS = ["fr", "en"];
const PAGES = [
  { id: "home",     slug: { fr: "",         en: "" } },
  { id: "services", slug: { fr: "services", en: "services" } },
  { id: "pricing",  slug: { fr: "tarifs",   en: "pricing" } },
  { id: "about",    slug: { fr: "a-propos", en: "about" } },
  { id: "contact",  slug: { fr: "contact",  en: "contact" } },
  { id: "privacy",  slug: { fr: "confidentialite", en: "privacy" }, menu: false },
];
const MENU = PAGES.filter((p) => p.menu !== false);
const NAV_KEY = { home: "nav.home", services: "nav.services", pricing: "nav.pricing", about: "nav.about", contact: "nav.contact", privacy: "nav.privacy" };
const TITLE_KEY = { privacy: "privacy.title" };

// cache-busting version from the CSS/JS contents
const version = crypto.createHash("sha1")
  .update(["css/styles.css", "js/i18n.js", "js/main.js"].map((f) => fs.readFileSync(path.join(ROOT, f))).join(""))
  .digest("hex").slice(0, 8);

const template = fs.readFileSync(path.join(ROOT, "src/template.html"), "utf8");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pageDir = (lang, page) => (page.slug[lang] ? `${lang}/${page.slug[lang]}` : lang);
const pathFor = (lang, page) => `/${pageDir(lang, page)}/`;
const absUrl = (lang, page) => SITE_URL + pathFor(lang, page);

function relLink(fromDir, toDir) {
  let r = path.posix.relative(fromDir, toDir);
  r = r ? r + "/" : "./";
  return EXPLICIT ? r + "index.html" : r;
}

function money(lang, n) {
  const s = Number(n).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA").replace(/ /g, " ");
  return lang === "fr" ? `${s} $` : `$${s}`;
}

function build(lang, page) {
  const d = DICT[lang];
  const t = (k) => {
    if (!(k in d)) throw new Error(`Missing ${lang} text for "${k}"`);
    return d[k];
  };
  const here = pageDir(lang, page);
  const byId = (id) => PAGES.find((p) => p.id === id);
  const url = (spec) => {
    const [id, hash] = spec.split("#");
    if (!byId(id)) throw new Error(`Unknown page "${id}"`);
    return relLink(here, pageDir(lang, byId(id))) + (hash ? "#" + hash : "");
  };

  // keep only this page's content block
  let html = template.replace(/<!-- page:(\w+) -->([\s\S]*?)<!-- \/page:\1 -->\n?/g, (_, id, body) => (id === page.id ? body : ""));

  const navLinks = (list) => list.map((p) => {
    const cur = p.id === page.id ? ' aria-current="page"' : "";
    return `      <a href="${url(p.id)}"${cur}>${esc(t(NAV_KEY[p.id]))}</a>`;
  }).join("\n");

  const langSwitch = LANGS.map((l) => {
    const cur = l === lang ? ' aria-current="true"' : "";
    const label = l === "fr" ? "Français" : "English";
    return `        <a href="${relLink(here, pageDir(l, page))}" hreflang="${l}" lang="${l}" data-lang="${l}" title="${label}"${cur}>${l.toUpperCase()}</a>`;
  }).join("\n");

  const idx = MENU.indexOf(page);
  const prev = idx > 0 ? MENU[idx - 1] : null, next = idx >= 0 ? MENU[idx + 1] : null;
  const pagerLink = (p, dir) => {
    if (!p) return "    <span></span>";
    const arrowL = dir === "prev" ? "← " : "", arrowR = dir === "next" ? " →" : "";
    return `    <a class="pager-link pager-${dir}" rel="${dir}" href="${url(p.id)}"><small>${arrowL}${esc(t("pager." + dir))}${arrowR}</small><b>${esc(t(NAV_KEY[p.id]))}</b></a>`;
  };
  const pager = idx < 0 ? "" : `<nav class="wrap" aria-label="${esc(t("pager.prev"))} / ${esc(t("pager.next"))}">\n  <div class="pager">\n${pagerLink(prev, "prev")}\n${pagerLink(next, "next")}\n  </div>\n  </nav>`;

  const title = page.id === "home" ? t("meta.title") : `${t(TITLE_KEY[page.id] || NAV_KEY[page.id])} · ${t("meta.suffix")}`;
  const description = page.id === "home" ? t("meta.desc") : t("meta.desc." + page.id);

  let seo = "";
  if (SITE_URL) {
    seo += `<link rel="canonical" href="${absUrl(lang, page)}">\n`;
    seo += `<meta property="og:url" content="${absUrl(lang, page)}">\n`;
    for (const l of LANGS) seo += `<link rel="alternate" hreflang="${l}-CA" href="${absUrl(l, page)}">\n`;
    seo += `<link rel="alternate" hreflang="x-default" href="${absUrl(DEFAULT_LANG, page)}">\n`;
    seo += `<meta property="og:image" content="${SITE_URL}/assets/og-${lang}.png">\n`;
    seo += `<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n`;
    seo += `<meta name="twitter:card" content="summary_large_image">`;
  } else {
    seo = "<!-- set siteUrl in site.config.json to add canonical and hreflang links -->";
  }
  if (page.id === "home") {
    seo += `\n<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      name: "Webbi",
      description: t("meta.desc"),
      url: SITE_URL ? absUrl(lang, page) : undefined,
      email: "webbicontacts@gmail.com",
      telephone: ["+1-514-559-1276", "+1-514-808-5966"],
      areaServed: "Montréal, QC",
      address: { "@type": "PostalAddress", addressLocality: "Montréal", addressRegion: "QC", addressCountry: "CA" },
      priceRange: "$200–$948",
    })}</script>`;
  }

  const vars = {
    htmllang: lang === "fr" ? "fr-CA" : "en-CA",
    oglocale: lang === "fr" ? "fr_CA" : "en_CA",
    page: page.id, title: esc(title), description: esc(description), version, langcode: lang,
  };
  const raw = { seo, nav: navLinks(MENU), footnav: navLinks(PAGES), langswitch: langSwitch, pager };

  html = html.replace(/\{\{langcode\}\}/g, lang); // first, so it can sit inside other placeholders
  html = html.replace(/\{\{([^}]+)\}\}/g, (_, tok) => {
    tok = tok.trim();
    if (tok in raw) return raw[tok];
    if (tok in vars) return vars[tok];
    if (tok.startsWith("url:")) return url(tok.slice(4));
    if (tok.startsWith("asset:")) return path.posix.relative(here, tok.slice(6));
    if (tok.startsWith("price:")) return money(lang, tok.slice(6));
    return esc(t(tok));
  });
  return html;
}

function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

let count = 0;
for (const lang of LANGS) {
  PAGES.forEach((page) => {
    write(path.join(pageDir(lang, page), "index.html"), build(lang, page));
    count++;
  });
}

// root: sends visitors to their saved language, French otherwise
const rootTarget = (l) => (EXPLICIT ? `${l}/index.html` : `${l}/`);
write("index.html", `<!doctype html>
<html lang="fr-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Webbi · Conception Web à Montréal</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="${esc(DICT.fr["meta.desc"])}">
${SITE_URL ? `<link rel="canonical" href="${absUrl(DEFAULT_LANG, PAGES[0])}">\n` : ""}<link rel="alternate" hreflang="fr" href="${rootTarget("fr")}">
<link rel="alternate" hreflang="en" href="${rootTarget("en")}">
<noscript><meta http-equiv="refresh" content="0; url=${rootTarget(DEFAULT_LANG)}"></noscript>
<script>
  (function () {
    var l = "${DEFAULT_LANG}";
    try { var s = localStorage.getItem("webbi-lang"); if (s === "fr" || s === "en") l = s; } catch (e) {}
    location.replace(l === "en" ? "${rootTarget("en")}" : "${rootTarget("fr")}");
  })();
</script>
<style>
  :root { --bg: #ffffff; --ink: #0e0d16; --brand: #612bfd; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0c0b12; --ink: #f2f0fa; --brand: #7c52ff; color-scheme: dark; } }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--ink);
    font: 500 17px/1.5 system-ui, sans-serif; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
  div { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
  a { color: #fff; background: var(--brand); padding: 12px 22px; border-radius: 999px; text-decoration: none; font-weight: 600; }
</style>
</head>
<body>
  <div><a href="${rootTarget("fr")}" hreflang="fr">Français</a><a href="${rootTarget("en")}" hreflang="en">English</a></div>
</body>
</html>
`);

// branded "page not found", served by .htaccess for any address, so it uses root-relative paths
write("404.html", `<!doctype html>
<html lang="fr-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>404 · ${esc(DICT.fr["nf.title"])} · Webbi</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/styles.css?v=${version}">
<script>try{var w=localStorage.getItem("webbi-theme");if(w==="dark"||w==="light")document.documentElement.setAttribute("data-theme",w)}catch(e){}</script>
</head>
<body data-page="notfound">
<main class="nf wrap">
  <a href="/" aria-label="Webbi"><img class="logo logo-on-light" src="/assets/webbi-logo.png" alt="Webbi" width="120" height="42"><img class="logo logo-on-dark" src="/assets/webbi-logo-dark.png" alt="" width="120" height="42"></a>
  <p class="nf-code" aria-hidden="true">404</p>
  <div class="nf-cols">
    <div lang="fr"><h1 class="h2">${esc(DICT.fr["nf.title"])}</h1><p class="sub">${esc(DICT.fr["nf.text"])}</p><a class="btn btn-brand" href="/fr/">${esc(DICT.fr["nf.home"])}</a></div>
    <div lang="en"><h2 class="h2">${esc(DICT.en["nf.title"])}</h2><p class="sub">${esc(DICT.en["nf.text"])}</p><a class="btn btn-ghost" href="/en/">${esc(DICT.en["nf.home"])}</a></div>
  </div>
</main>
</body>
</html>
`);

if (SITE_URL && !EXPLICIT) {
  const urls = [];
  for (const page of PAGES) {
    for (const lang of LANGS) {
      const alts = LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}-CA" href="${absUrl(l, page)}"/>`).join("\n");
      urls.push(`  <url>\n    <loc>${absUrl(lang, page)}</loc>\n${alts}\n  </url>`);
    }
  }
  write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`);
  write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
} else if (!EXPLICIT) {
  write("robots.txt", "User-agent: *\nAllow: /\n");
}

console.log(`Built ${count} pages + index.html into ${OUT}${SITE_URL ? "" : " (no siteUrl set: sitemap and canonical links skipped)"}`);
