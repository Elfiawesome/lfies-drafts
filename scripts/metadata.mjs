import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  METADATA_FILENAME,
  loadMetadata,
  metadataPath,
  recordFromStats,
  restoreFileTimes,
  saveMetadata as writeMetadata,
} from "../src/build/metadata.mjs";
import { toPosix } from "../src/build/files.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const contentDirectory = path.join(root, "content");
const metadataFile = metadataPath(contentDirectory);

async function walk(directory, relative = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (
      entry.name === METADATA_FILENAME ||
      entry.name.startsWith(".")
    ) {
      continue;
    }
    const entryRelative = relative
      ? `${relative}/${entry.name}`
      : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await walk(path.join(directory, entry.name), entryRelative)));
    } else if (entry.isFile()) {
      files.push(entryRelative);
    }
  }
  return files.sort();
}

async function captureMetadata(options) {
  const metadata = await loadMetadata(metadataFile);
  const records = {};
  const files = await walk(contentDirectory);
  let added = 0;
  let refreshed = 0;

  for (const relativePath of files) {
    const key = toPosix(relativePath);
    const fileStats = await stat(path.join(contentDirectory, ...key.split("/")));
    const existing = metadata.files[key];
    if (existing && !options.refresh) {
      records[key] = existing;
      continue;
    }
    records[key] = recordFromStats(fileStats);
    if (existing) {
      refreshed += 1;
    } else {
      added += 1;
    }
  }

  for (const [key, record] of Object.entries(metadata.files)) {
    if (!(key in records)) {
      records[key] = record;
    }
  }

  await writeMetadata(metadataFile, { version: 1, files: records });
  console.log(
    `Saved ${Object.keys(records).length} file timestamp records (${added} new, ${refreshed} refreshed).`,
  );
  console.log("Commit content/.metadata.json so remote builds keep these dates.");
}

async function restoreMetadata() {
  const metadata = await loadMetadata(metadataFile);
  if (!metadata.exists) {
    console.error("No content/.metadata.json found. Run `npm run metadata:save` first.");
    process.exitCode = 1;
    return;
  }
  const result = await restoreFileTimes(contentDirectory, metadata);
  console.log(
    `Restored modified/accessed times for ${result.restored} files${result.missing ? `; ${result.missing} missing` : ""}.`,
  );
  console.log(
    "Creation times cannot be changed by Node; builds read the saved birthtime from the manifest.",
  );
}

const command = process.argv[2];
const refresh = process.argv.includes("--refresh");

if (command === "save") {
  await captureMetadata({ refresh });
} else if (command === "restore") {
  await restoreMetadata();
} else {
  console.error("Usage: node scripts/metadata.mjs save [--refresh] | restore");
  process.exitCode = 1;
}

