import { copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { loadContent } from "./content.mjs";
import { loadContentTypes } from "./registry.mjs";
import { createMarkdownContext } from "./markdown.mjs";
import {
  metadataPath,
  loadMetadata,
  saveMetadata,
} from "./metadata.mjs";
import {
  ensureDirectory,
  mirrorTree,
  resetDirectory,
  writeOutputFile,
} from "./files.mjs";
import {
  compareTitles,
  encodePath,
  escapeHtml,
  formatBytes,
  plainText,
  rootForOutput,
  truncate,
} from "./utils.mjs";
import { renderLayout } from "./templates/layout.mjs";
import { renderHome } from "./templates/home.mjs";
import { renderCollection } from "./templates/collection.mjs";
import { renderEntry } from "./templates/entry.mjs";
import { renderTimeline } from "./templates/timeline.mjs";
import { renderAbout } from "./templates/about.mjs";
import { renderNotFound } from "./templates/not-found.mjs";

const require = createRequire(import.meta.url);

async function copyVendorAssets(destination) {
  const spessasynth = require.resolve("spessasynth_lib");
  const core = require.resolve("spessasynth_core");
  const vorbis = require.resolve("stb-vorbis");
  const vendor = path.join(destination, "assets", "vendor");

  const targets = [
    [spessasynth, path.join(vendor, "spessasynth", "index.js")],
    [
      path.join(path.dirname(spessasynth), "spessasynth_processor.min.js"),
      path.join(vendor, "spessasynth", "spessasynth_processor.min.js"),
    ],
    [core, path.join(vendor, "spessasynth_core", "index.js")],
    [vorbis, path.join(vendor, "stb-vorbis", "index.js")],
    [
      path.join(path.dirname(spessasynth), "..", "LICENSE"),
      path.join(vendor, "spessasynth", "LICENSE"),
    ],
    [
      path.join(path.dirname(core), "..", "LICENSE"),
      path.join(vendor, "spessasynth_core", "LICENSE"),
    ],
    [
      path.join(path.dirname(vorbis), "..", "LICENSE"),
      path.join(vendor, "stb-vorbis", "LICENSE"),
    ],
  ];

  for (const [source, target] of targets) {
    await ensureDirectory(path.dirname(target));
    await copyFile(source, target);
  }
}

function siteBase(site) {
  if (!site.siteUrl) {
    return null;
  }
  return site.siteUrl.endsWith("/") ? site.siteUrl : `${site.siteUrl}/`;
}

function absoluteUrl(site, pagePath = "") {
  const base = siteBase(site);
  if (!base) {
    return null;
  }
  return new URL(encodePath(pagePath), base).href;
}

function relatedEntries(entry, entries) {
  return entries
    .filter(
      (candidate) =>
        candidate.id !== entry.id &&
        candidate.type === entry.type &&
        candidate.tags.length &&
        entry.tags.length,
    )
    .map((candidate) => ({
      entry: candidate,
      score: candidate.tags.filter((tag) =>
        entry.tags.some((ownTag) => ownTag.toLowerCase() === tag.toLowerCase()),
      ).length,
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, 3)
    .map((candidate) => candidate.entry);
}

function sitemapMarkup(site, pagePaths) {
  const urls = pagePaths
    .filter((page) => page.path !== "404.html")
    .map((page) => {
      const url = absoluteUrl(site, page.path);
      const lastmod = page.lastmod ? `<lastmod>${escapeHtml(page.lastmod)}</lastmod>` : "";
      return `<url><loc>${escapeHtml(url)}</loc>${lastmod}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}

export async function buildSite({ root, site, onLog = () => {} }) {
  const warnings = [];
  const builtPages = [];
  const buildDate = new Date();
  const types = await loadContentTypes();
  const typeMap = new Map(types.map((type) => [type.id, type]));
  const contentDirectory = path.join(root, "content");
  const sourceAssets = path.join(root, "src", "assets");
  const distDirectory = path.join(root, "dist");

  await resetDirectory(distDirectory);
  await mirrorTree(sourceAssets, path.join(distDirectory, "assets"), { mode: "copy" });
  await copyVendorAssets(distDirectory);

  const savedMetadataPath = metadataPath(contentDirectory);
  const savedMetadata = await loadMetadata(savedMetadataPath);
  const { entries, collections, lookup, metadataChanged } = await loadContent({
    contentDirectory,
    types,
    metadata: savedMetadata,
    warn: (message) => warnings.push(message),
  });
  if (metadataChanged) {
    await saveMetadata(savedMetadataPath, savedMetadata);
    warnings.push(
      `${savedMetadata.exists ? "Updated" : "Created"} content/.metadata.json with file timestamps. Commit it so remote builds keep the same dates.`,
    );
  } else if (!savedMetadata.exists) {
    warnings.push(
      "content/.metadata.json is missing. Dates will come from the filesystem; run npm run metadata:save and commit the file.",
    );
  }

  const allMediaFiles = entries.flatMap((entry) => entry.files);
  const mediaBytes = allMediaFiles.reduce((total, file) => total + file.bytes, 0);
  if (mediaBytes > 1_000_000_000) {
    warnings.push(
      `Archive media totals ${formatBytes(mediaBytes)}. GitHub Pages has a 1 GB site limit, so the WAV files will need compressing or external hosting before deploying there.`,
    );
  }
  const oversizedFile = allMediaFiles.find((file) => file.bytes > 100_000_000);
  if (oversizedFile) {
    warnings.push(
      `${oversizedFile.path} is ${formatBytes(oversizedFile.bytes)}. Git and GitHub reject files larger than 100 MB without Git LFS.`,
    );
  }

  for (const entry of entries) {
    const source = path.join(contentDirectory, entry.type, entry.slug);
    const destination = path.join(distDirectory, entry.type, entry.slug);
    await mirrorTree(source, destination, {
      mode: "link",
      filter: (dirent) => dirent.name !== "entry.json" && !dirent.name.startsWith("."),
    });
  }

  const writePage = async (pagePath, html) => {
    await writeOutputFile(path.join(distDirectory, pagePath), html);
    builtPages.push(pagePath);
  };

  const allTypeStyles = types.flatMap((type) => type.styles || []);
  const homeRoot = rootForOutput("index.html");
  await writePage(
    "index.html",
    renderLayout({
      site,
      root: homeRoot,
      extraStyles: allTypeStyles,
      page: {
        title: "",
        description: site.description,
        navHref: "",
        path: "",
        bodyClass: "page-home",
      },
      content: renderHome({
        site,
        entries,
        collections,
        root: homeRoot,
      }),
    }),
  );

  types.forEach((type) => {
    const typeEntries = [
      ...(collections.find((collection) => collection.type.id === type.id)?.entries || []),
    ].sort(compareTitles);
    const pagePath = `${type.id}/index.html`;
    const pageRoot = rootForOutput(pagePath);
    writePage(
      pagePath,
      renderLayout({
        site,
        root: pageRoot,
        extraStyles: type.styles || [],
        page: {
          title: type.label,
          description: type.drawerDescription || site.description,
          navHref: `${type.id}/`,
          path: `${type.id}/`,
          bodyClass: `page-collection page-${type.id}`,
        },
        content: renderCollection({
          type,
          entries: typeEntries,
          root: pageRoot,
        }),
      }),
    );
  });

  for (const entry of entries) {
    const type = typeMap.get(entry.type);
    const collection = collections.find((item) => item.type.id === entry.type);
    const collectionEntries = collection?.entries || [];
    const index = collectionEntries.findIndex((item) => item.id === entry.id);
    const prev = index > 0 ? collectionEntries[index - 1] : null;
    const next =
      index >= 0 && index < collectionEntries.length - 1
        ? collectionEntries[index + 1]
        : null;
    const pagePath = `${entry.type}/${entry.slug}/index.html`;
    const pageRoot = rootForOutput(pagePath);
    const markdown = createMarkdownContext({
      entries,
      lookup,
      root: pageRoot,
      currentType: entry.type,
    });
    const description =
      truncate(plainText(entry.description), 165) ||
      truncate(plainText(entry.about), 165) ||
      site.description;

    await writePage(
      pagePath,
      renderLayout({
        site,
        root: pageRoot,
        extraStyles: type.styles || [],
        page: {
          title: entry.title,
          description,
          navHref: `${entry.type}/`,
          path: `${entry.type}/${entry.slug}/`,
          ogType: "article",
          importMap: true,
          bodyClass: `page-entry page-${entry.type}-entry`,
        },
        content: renderEntry({
          entry,
          type,
          root: pageRoot,
          markdown,
          prev,
          next,
          related: relatedEntries(entry, entries),
        }),
      }),
    );
  }

  const timelinePath = "timeline/index.html";
  const timelineRoot = rootForOutput(timelinePath);
  await writePage(
    timelinePath,
    renderLayout({
      site,
      root: timelineRoot,
      page: {
        title: "Timeline",
        description: "The whole archive, arranged by the timestamps inside the files.",
        navHref: "timeline/",
        path: "timeline/",
        bodyClass: "page-timeline",
      },
      content: renderTimeline({ entries, types, root: timelineRoot }),
    }),
  );

  if (site.about) {
    const aboutPath = "about/index.html";
    const aboutRoot = rootForOutput(aboutPath);
    const aboutMarkdown = createMarkdownContext({
      entries,
      lookup,
      root: aboutRoot,
      currentType: null,
    });
    await writePage(
      aboutPath,
      renderLayout({
        site,
        root: aboutRoot,
        page: {
          title: site.about.title,
          description: site.about.lede,
          navHref: "about/",
          path: "about/",
          bodyClass: "page-about",
        },
        content: renderAbout({
          site,
          entries,
          root: aboutRoot,
          markdown: aboutMarkdown,
          buildDate,
        }),
      }),
    );
  }

  const base = siteBase(site);
  const notFoundRoot = base ? new URL(base).pathname : "./";
  await writePage(
    "404.html",
    renderLayout({
      site,
      root: notFoundRoot,
      page: {
        title: "Page not found",
        description: "This draft is not in the drawer.",
        navHref: "",
        noindex: true,
        bodyClass: "page-not-found",
      },
      content: renderNotFound({ root: notFoundRoot }),
    }),
  );

  await writeOutputFile(path.join(distDirectory, ".nojekyll"), "");
  await writeOutputFile(
    path.join(distDirectory, "robots.txt"),
    `User-agent: *\nAllow: /\n${site.siteUrl ? `Sitemap: ${absoluteUrl(site, "sitemap.xml")}\n` : ""}`,
  );

  if (site.siteUrl) {
    const pagePaths = [
      { path: "", lastmod: buildDate.toISOString().slice(0, 10) },
      ...types.map((type) => ({
        path: `${type.id}/`,
        lastmod: entries
          .filter((entry) => entry.type === type.id)
          .map((entry) => entry.filedAt)
          .filter(Boolean)
          .sort()
          .at(-1)
          ?.slice(0, 10),
      })),
      ...entries.map((entry) => ({
        path: `${entry.type}/${entry.slug}/`,
        lastmod: entry.filedAt?.slice(0, 10),
      })),
      { path: "timeline/", lastmod: buildDate.toISOString().slice(0, 10) },
      ...(site.about
        ? [{ path: "about/", lastmod: buildDate.toISOString().slice(0, 10) }]
        : []),
    ];
    await writeOutputFile(
      path.join(distDirectory, "sitemap.xml"),
      sitemapMarkup(site, pagePaths),
    );
  }

  onLog(
    `Built ${builtPages.length} pages from ${entries.length} ${entries.length === 1 ? "draft" : "drafts"} in ${collections.length} ${collections.length === 1 ? "drawer" : "drawers"}.`,
  );

  return {
    entries,
    collections,
    types,
    pages: builtPages,
    warnings,
    buildDate,
  };
}
