import {
  assetHref,
  encodePath,
  escapeAttr,
  escapeHtml,
  hrefFor,
} from "../utils.mjs";

function navMarkup(site, root, activeHref) {
  return site.nav
    .map((item) => {
      const current = item.href === activeHref ? ' aria-current="page"' : "";
      return `<a href="${escapeAttr(hrefFor(root, item.href))}"${current}>${escapeHtml(item.label)}</a>`;
    })
    .join("");
}

function footerMarkup(site, root) {
  const nav = site.nav
    .map(
      (item) =>
        `<li><a href="${escapeAttr(hrefFor(root, item.href))}">${escapeHtml(item.label)}</a></li>`,
    )
    .join("");
  const year = new Date().getFullYear();
  const wordmark = Array.isArray(site.wordmark) ? site.wordmark : [site.siteName, ""];

  return `<footer class="site-footer">
    <div class="site-shell site-footer__inner">
      <div class="footer-grid">
        <p class="footer-title">${escapeHtml(wordmark[0])} <em>${escapeHtml(wordmark[1] || "")}</em></p>
        <ul class="footer-links">${nav}<li><a href="#top">Back to top</a></li></ul>
      </div>
      <div class="footer-bottom">
        <span>© ${year} ${escapeHtml(site.author)}</span>
      </div>
    </div>
  </footer>`;
}

export function renderLayout({
  site,
  page,
  root,
  content,
  extraStyles = [],
}) {
  const wordmark = Array.isArray(site.wordmark) ? site.wordmark : [site.siteName, ""];
  const pageTitle = page.title
    ? `${page.title} — ${site.siteName}`
    : `${site.siteName} — ${site.tagline}`;
  const description = page.description || site.description;
  const styles = [
    "css/fonts.css",
    "css/tokens.css",
    "css/base.css",
    "css/components.css",
    "css/pages.css",
    ...extraStyles,
  ];
  const styleLinks = styles
    .map((style) => `<link rel="stylesheet" href="${escapeAttr(assetHref(root, style))}">`)
    .join("");
  const canonical = site.siteUrl
    ? new URL(
        encodePath(page.path || ""),
        site.siteUrl.endsWith("/") ? site.siteUrl : `${site.siteUrl}/`,
      ).href
    : null;
  const bodyClass = ["site", page.bodyClass].filter(Boolean).join(" ");
  const noindex = page.noindex ? '<meta name="robots" content="noindex">' : "";
  const importMap = page.importMap
    ? `<script type="importmap">${JSON.stringify({
        imports: {
          spessasynth_core: assetHref(root, "vendor/spessasynth_core/index.js"),
          "stb-vorbis": assetHref(root, "vendor/stb-vorbis/index.js"),
        },
      })}</script>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeAttr(description)}">
  <meta name="author" content="${escapeAttr(site.author)}">
  <meta name="theme-color" content="${escapeAttr(site.themeColor || "#f4ead6")}">
  <meta property="og:site_name" content="${escapeAttr(site.siteName)}">
  <meta property="og:title" content="${escapeAttr(pageTitle)}">
  <meta property="og:description" content="${escapeAttr(description)}">
  <meta property="og:type" content="${escapeAttr(page.ogType || "website")}">
  ${canonical ? `<link rel="canonical" href="${escapeAttr(canonical)}">` : ""}
  ${noindex}
  <link rel="icon" href="${escapeAttr(assetHref(root, "img/favicon.svg"))}" type="image/svg+xml">
  <link rel="preload" href="${escapeAttr(assetHref(root, "fonts/lora-normal.woff2"))}" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="${escapeAttr(assetHref(root, "fonts/fraunces-normal.woff2"))}" as="font" type="font/woff2" crossorigin>
  ${styleLinks}
  ${importMap}
  <script type="module" src="${escapeAttr(assetHref(root, "js/main.js"))}"></script>
</head>
<body id="top" class="${escapeAttr(bodyClass)}">
  <a class="skip-link" href="#main">Skip to the drafts</a>
  <noscript><div class="noscript-note">JavaScript is off. The archive still reads, but players and filters need JavaScript.</div></noscript>
  <header class="site-header">
    <div class="site-shell site-header__inner">
      <a class="brand" href="${escapeAttr(root)}" aria-label="${escapeAttr(site.siteName)} home">
        <span class="brand__seal"><img src="${escapeAttr(assetHref(root, "img/sigil.svg"))}" width="34" height="34" alt=""></span>
        <span>
          <span class="brand__name">${escapeHtml(wordmark[0])} <em>${escapeHtml(wordmark[1] || "")}</em></span>
          <span class="brand__tag">${escapeHtml(site.tagline)}</span>
        </span>
      </a>
      <nav class="site-nav" aria-label="Main navigation">
        ${navMarkup(site, root, page.navHref)}
      </nav>
    </div>
  </header>
  <main id="main" class="site-main">
    <div class="site-shell">
      ${content}
    </div>
  </main>
  ${footerMarkup(site, root)}
</body>
</html>`;
}
