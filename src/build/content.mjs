import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  describeFiles,
  findCover,
  toPosix,
  walkFiles,
} from "./files.mjs";
import {
  applyMetadata,
  recordFromFile,
  recordFromStats,
} from "./metadata.mjs";
import {
  compareTitles,
  earliestTimestamp,
  safeIsoDate,
  uniqueStrings,
} from "./utils.mjs";

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function tagsValue(value) {
  if (Array.isArray(value)) {
    return uniqueStrings(value.filter((tag) => typeof tag === "string"));
  }
  if (typeof value === "string") {
    return uniqueStrings(value.split(","));
  }
  return [];
}

function ratingValue(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating)) {
    return 0;
  }
  return Math.max(0, Math.min(5, rating));
}

function titleFromSlug(slug) {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export async function loadContent({
  contentDirectory,
  types,
  metadata,
  warn = () => {},
}) {
  const typeMap = new Map(types.map((type) => [type.id, type]));
  const entries = [];
  const collections = [];
  const fileMetadata = metadata?.files || {};
  let metadataChanged = false;
  const rootEntries = await readdir(contentDirectory, { withFileTypes: true });

  for (const typeDirectory of rootEntries) {
    if (!typeDirectory.isDirectory()) {
      continue;
    }

    const type = typeMap.get(typeDirectory.name);
    if (!type) {
      const contents = await readdir(path.join(contentDirectory, typeDirectory.name));
      if (contents.length) {
        warn(`Unknown content type folder "content/${typeDirectory.name}" was skipped.`);
      }
      continue;
    }

    const typePath = path.join(contentDirectory, typeDirectory.name);
    const entryDirectories = (await readdir(typePath, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

    const typeEntries = [];

    for (const entryDirectory of entryDirectories) {
      const slug = entryDirectory.name;
      const entryPath = path.join(typePath, slug);
      const entryJsonPath = path.join(entryPath, "entry.json");

      let raw;
      try {
        raw = JSON.parse(await readFile(entryJsonPath, "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT") {
          warn(`Could not read ${toPosix(path.relative(contentDirectory, entryJsonPath))}: ${error.message}`);
        }
        continue;
      }

      const relativeFiles = await walkFiles(entryPath);
      const files = await describeFiles(entryPath, relativeFiles);
      for (const file of files) {
        const key = `${type.id}/${slug}/${file.path}`;
        const saved = fileMetadata[key];
        if (saved) {
          applyMetadata(file, saved);
        } else {
          fileMetadata[key] = recordFromFile(file);
          metadataChanged = true;
        }
      }

      const entryStats = await stat(entryJsonPath).catch(() => null);
      const entryKey = `${type.id}/${slug}/entry.json`;
      let entryRecord = fileMetadata[entryKey];
      if (entryStats && !entryRecord) {
        entryRecord = recordFromStats(entryStats);
        fileMetadata[entryKey] = entryRecord;
        metadataChanged = true;
      }
      const metadataTimestamp = entryRecord
        ? earliestTimestamp(
            entryRecord.birthtimeMs ?? 0,
            entryRecord.mtimeMs ?? 0,
            entryRecord.atimeMs ?? 0,
          )
        : entryStats
          ? earliestTimestamp(
              entryStats.birthtimeMs,
              entryStats.mtimeMs,
              entryStats.atimeMs,
            )
          : 0;

      const normalized = type.normalize(raw, {
        slug,
        files,
        warn: (message) => warn(`[${type.id}/${slug}] ${message}`),
      }) || {};

      const fileTimestamps = files
        .map((file) => file.filedAtMs)
        .filter((timestamp) => timestamp > 0);
      const filedAtMs = fileTimestamps.length
        ? Math.min(...fileTimestamps)
        : metadataTimestamp;

      const entry = {
        id: `${type.id}/${slug}`,
        type: type.id,
        slug,
        title: stringValue(raw.name) || titleFromSlug(slug),
        description: stringValue(raw.description),
        about: stringValue(raw.about ?? raw.About),
        tags: tagsValue(raw.tags),
        rating: ratingValue(raw["my-rating"] ?? raw.myRating ?? raw.rating),
        featured: Boolean(raw.featured),
        filedAtMs,
        filedAt: safeIsoDate(filedAtMs),
        files,
        cover: normalized.cover || findCover(files),
        media: normalized.media || {},
        data: raw,
      };

      entry.formatKeys = type.formatKeys?.(entry) || [];
      typeEntries.push(entry);
      entries.push(entry);
    }

    typeEntries.sort(compareTitles);
    if (typeEntries.length) {
      collections.push({ type, entries: typeEntries });
    }
  }

  entries.sort(compareTitles);

  return {
    entries,
    collections,
    lookup: createLookup(entries),
    metadataChanged,
  };
}

export function createLookup(entries) {
  const lookup = new Map();
  const slugCounts = new Map();
  const titleCounts = new Map();

  for (const entry of entries) {
    lookup.set(entry.id.toLowerCase(), entry);
    slugCounts.set(entry.slug.toLowerCase(), (slugCounts.get(entry.slug.toLowerCase()) || 0) + 1);
    titleCounts.set(entry.title.toLowerCase(), (titleCounts.get(entry.title.toLowerCase()) || 0) + 1);
  }

  for (const entry of entries) {
    const slug = entry.slug.toLowerCase();
    if (slugCounts.get(slug) === 1) {
      lookup.set(slug, entry);
    }
    const title = entry.title.toLowerCase();
    if (titleCounts.get(title) === 1) {
      lookup.set(title, entry);
    }
  }

  return lookup;
}
