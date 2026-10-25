import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const TYPES_DIRECTORY = fileURLToPath(new URL("./content-types/", import.meta.url));

export async function loadContentTypes() {
  const files = (await readdir(TYPES_DIRECTORY))
    .filter((file) => file.endsWith(".mjs"))
    .sort();

  const types = new Map();

  for (const file of files) {
    const module = await import(pathToFileURL(path.join(TYPES_DIRECTORY, file)).href);
    const definition = module.default;
    if (!definition?.id) {
      continue;
    }
    if (!definition.normalize || !definition.player) {
      throw new Error(`Content type "${file}" must export normalize() and player().`);
    }
    types.set(definition.id, {
      order: 100,
      label: definition.id,
      pluralLabel: definition.label,
      drawerDescription: "",
      styles: [],
      filters: [],
      inventory: () => [],
      formats: () => [],
      metaRows: () => [],
      ...definition,
    });
  }

  return [...types.values()].sort((a, b) => a.order - b.order);
}
