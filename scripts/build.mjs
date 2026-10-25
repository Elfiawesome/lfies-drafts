import { fileURLToPath } from "node:url";
import site from "../site.config.mjs";
import { buildSite } from "../src/build/build.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

try {
  const started = performance.now();
  const result = await buildSite({ root, site });
  const elapsed = ((performance.now() - started) / 1000).toFixed(2);

  for (const warning of result.warnings) {
    console.warn(`warning: ${warning}`);
  }

  console.log(
    `Built ${result.pages.length} pages for ${result.entries.length} entries in ${elapsed}s.`,
  );
  console.log("Output: dist/");
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
