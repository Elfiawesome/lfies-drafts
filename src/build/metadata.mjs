import { readFile, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { earliestTimestamp, safeIsoDate } from "./utils.mjs";

export const METADATA_FILENAME = ".metadata.json";
export const METADATA_VERSION = 1;

function validTime(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeRecord(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = {
    birthtimeMs: validTime(value.birthtimeMs),
    mtimeMs: validTime(value.mtimeMs),
    atimeMs: validTime(value.atimeMs),
  };
  if (
    record.birthtimeMs === null &&
    record.mtimeMs === null &&
    record.atimeMs === null
  ) {
    return null;
  }
  return record;
}

export function metadataPath(contentDirectory) {
  return path.join(contentDirectory, METADATA_FILENAME);
}

export function recordFromStats(stats) {
  return {
    birthtimeMs: validTime(stats.birthtimeMs) ?? 0,
    mtimeMs: validTime(stats.mtimeMs) ?? 0,
    atimeMs: validTime(stats.atimeMs) ?? 0,
  };
}

export function recordFromFile(file) {
  return {
    birthtimeMs: validTime(file.birthtimeMs) ?? 0,
    mtimeMs: validTime(file.mtimeMs) ?? 0,
    atimeMs: validTime(file.atimeMs) ?? 0,
  };
}

export function applyMetadata(file, saved) {
  if (!saved) {
    return false;
  }
  if (saved.birthtimeMs !== null) {
    file.birthtimeMs = saved.birthtimeMs;
  }
  if (saved.mtimeMs !== null) {
    file.mtimeMs = saved.mtimeMs;
  }
  if (saved.atimeMs !== null) {
    file.atimeMs = saved.atimeMs;
  }
  const filedAtMs = earliestTimestamp(
    file.birthtimeMs,
    file.mtimeMs,
    file.atimeMs,
  );
  file.filedAtMs = filedAtMs;
  file.filedAt = safeIsoDate(filedAtMs);
  file.createdAt = safeIsoDate(file.birthtimeMs);
  file.modifiedAt = safeIsoDate(file.mtimeMs);
  file.accessedAt = safeIsoDate(file.atimeMs);
  return true;
}

export async function loadMetadata(filePath) {
  const empty = { version: METADATA_VERSION, files: {}, exists: false };
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || typeof parsed.files !== "object") {
      return empty;
    }
    const files = {};
    for (const [key, value] of Object.entries(parsed.files)) {
      const record = normalizeRecord(value);
      if (record) {
        files[key] = record;
      }
    }
    return { version: METADATA_VERSION, files, exists: true };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Could not read ${filePath}: ${error.message}`);
    }
    return empty;
  }
}

export async function saveMetadata(filePath, metadata) {
  const files = {};
  for (const key of Object.keys(metadata.files).sort()) {
    files[key] = metadata.files[key];
  }
  const output = `${JSON.stringify(
    { version: METADATA_VERSION, files },
    null,
    2,
  )}\n`;
  await writeFile(filePath, output, "utf8");
}

export async function restoreFileTimes(contentDirectory, metadata) {
  let restored = 0;
  let missing = 0;
  for (const [key, record] of Object.entries(metadata.files)) {
    const filePath = path.join(contentDirectory, ...key.split("/"));
    try {
      await stat(filePath);
    } catch {
      missing += 1;
      continue;
    }
    const atime =
      record.atimeMs !== null && record.atimeMs > 0
        ? new Date(record.atimeMs)
        : new Date();
    const mtime =
      record.mtimeMs !== null && record.mtimeMs > 0
        ? new Date(record.mtimeMs)
        : new Date();
    await utimes(filePath, atime, mtime);
    restored += 1;
  }
  return { restored, missing };
}
