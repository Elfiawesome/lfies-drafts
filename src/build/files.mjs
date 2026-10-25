import {
  copyFile,
  link,
  mkdir,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { earliestTimestamp, safeIsoDate } from "./utils.mjs";

export function toPosix(value) {
  return value.split(path.sep).join("/");
}

export async function walkFiles(directory, relativeDirectory = "") {
  const current = path.join(directory, relativeDirectory);
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relative = relativeDirectory
      ? path.posix.join(toPosix(relativeDirectory), entry.name)
      : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(directory, relative)));
      continue;
    }
    if (!entry.isFile() || entry.name.startsWith(".") || relative === "entry.json") {
      continue;
    }
    files.push(relative);
  }

  return files.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

export async function describeFiles(entryDirectory, relativePaths) {
  const files = await Promise.all(
    relativePaths.map(async (relativePath) => {
      const stats = await stat(path.join(entryDirectory, relativePath));
      const filedAtMs = earliestTimestamp(
        stats.birthtimeMs,
        stats.mtimeMs,
        stats.atimeMs,
      );
      const extension = path.posix.extname(relativePath).slice(1).toLowerCase();
      return {
        path: relativePath,
        name: path.posix.basename(relativePath),
        extension,
        bytes: stats.size,
        filedAtMs,
        filedAt: safeIsoDate(filedAtMs),
        createdAt: safeIsoDate(stats.birthtimeMs),
        modifiedAt: safeIsoDate(stats.mtimeMs),
        accessedAt: safeIsoDate(stats.atimeMs),
      };
    }),
  );

  return files;
}

export function findAsset(rawPath, files, extensions) {
  if (typeof rawPath !== "string" || !rawPath.trim()) {
    return null;
  }

  const wanted = rawPath.trim().replaceAll("\\", "/").replace(/^\.\//, "");
  const allowed = new Set(extensions.map((extension) => extension.toLowerCase()));
  const exact = files.find((file) => file.path === wanted);
  const fallback = files.find(
    (file) => file.path.toLowerCase() === wanted.toLowerCase(),
  );
  const file = exact || fallback;
  if (!file || (allowed.size && !allowed.has(file.extension))) {
    return null;
  }
  return file;
}

const COVER_NAMES = new Set(["cover", "artwork", "folder", "thumb", "thumbnail"]);
const COVER_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif"]);

export function findCover(files) {
  return (
    files.find((file) => {
      if (file.path.includes("/")) {
        return false;
      }
      const base = file.name.slice(0, -(file.extension.length + 1)).toLowerCase();
      return COVER_NAMES.has(base) && COVER_EXTENSIONS.has(file.extension);
    }) || null
  );
}

export async function resetDirectory(directory) {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
}

export async function ensureDirectory(directory) {
  await mkdir(directory, { recursive: true });
}

async function placeFile(source, destination, mode) {
  if (mode === "link") {
    try {
      await link(source, destination);
      return;
    } catch {
      await copyFile(source, destination);
      return;
    }
  }
  await copyFile(source, destination);
}

export async function mirrorTree(sourceDirectory, destinationDirectory, options = {}) {
  const { filter = () => true, mode = "copy" } = options;
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  await mkdir(destinationDirectory, { recursive: true });

  for (const entry of entries) {
    const source = path.join(sourceDirectory, entry.name);
    const destination = path.join(destinationDirectory, entry.name);
    if (!filter(entry)) {
      continue;
    }
    if (entry.isDirectory()) {
      await mirrorTree(source, destination, { filter, mode });
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    await placeFile(source, destination, mode);
  }
}

export async function writeOutputFile(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}
