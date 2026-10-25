import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "../src/build/build.mjs";
import { createStaticServer, listen } from "./serve.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const contentDirectory = path.join(root, "content");
const sourceDirectory = path.join(root, "src");
const configPath = path.join(root, "site.config.mjs");
const distDirectory = path.join(root, "dist");

let building = false;
let pending = false;
let debounceTimer = null;

async function loadSite() {
  const module = await import(`../site.config.mjs?update=${Date.now()}`);
  return module.default;
}

async function rebuild() {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  const started = performance.now();
  try {
    const site = await loadSite();
    const result = await buildSite({ root, site });
    const elapsed = ((performance.now() - started) / 1000).toFixed(2);
    for (const warning of result.warnings) {
      console.warn(`warning: ${warning}`);
    }
    console.log(
      `rebuilt ${result.pages.length} pages / ${result.entries.length} entries in ${elapsed}s`,
    );
  } catch (error) {
    console.error(error.stack || error.message);
  } finally {
    building = false;
    if (pending) {
      pending = false;
      schedule();
    }
  }
}

function schedule(label = "") {
  if (label) {
    console.log(`changed: ${label}`);
  }
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(rebuild, 260);
}

function watchDirectory(directory) {
  const watcher = watch(directory, { recursive: true }, (_event, filename) => {
    if (!filename) {
      return;
    }
    const relative = path.relative(root, path.join(directory, filename));
    if (relative.startsWith("dist")) {
      return;
    }
    schedule(relative);
  });
  watcher.on("error", (error) => console.warn(`watch error: ${error.message}`));
  return watcher;
}

await rebuild();

const watchers = [
  watchDirectory(contentDirectory),
  watchDirectory(sourceDirectory),
];
const configWatcher = watch(configPath, () => schedule("site.config.mjs"));
watchers.push(configWatcher);

const server = createStaticServer({ rootDirectory: distDirectory, cacheControl: "no-store" });
const port = await listen(server, Number(process.env.PORT) || 4173);
console.log(`Dev archive running at http://localhost:${port}/`);
console.log("Watching content/, src/, and site.config.mjs. Refresh to see changes.");

const close = () => {
  for (const watcher of watchers) {
    watcher.close();
  }
  server.close(() => process.exit(0));
};

process.on("SIGINT", close);
process.on("SIGTERM", close);
