import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { walkFiles } from "../src/build/files.mjs";
import { parseMidi } from "../src/assets/js/music/midi-parser.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const contentDirectory = path.join(root, "content");
const files = (await walkFiles(contentDirectory)).filter((file) =>
  /\.(mid|midi)$/i.test(file),
);

let failures = 0;
let skipped = 0;
let totalNotes = 0;
let totalDuration = 0;

for (const relativePath of files) {
  const fullPath = path.join(contentDirectory, relativePath);
  const buffer = await readFile(fullPath);
  try {
    const midi = parseMidi(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    );
    totalNotes += midi.noteCount;
    totalDuration += midi.duration;
    console.log(
      `${relativePath} | ${midi.tracks.length} parts | ${midi.noteCount} notes | ${midi.duration.toFixed(1)}s | ${midi.bpm} bpm`,
    );
  } catch (error) {
    if (buffer.length < 200 && /not contain any notes/i.test(error.message)) {
      skipped += 1;
      console.log(`${relativePath} | skipped (empty MIDI placeholder)`);
      continue;
    }
    failures += 1;
    console.error(`${relativePath} | FAILED: ${error.message}`);
  }
}

console.log(
  `\nParsed ${files.length - failures - skipped}/${files.length - skipped} playable MIDI files, ${totalNotes} notes, ${(totalDuration / 60).toFixed(1)} minutes total. ${skipped} empty placeholder(s) skipped.`,
);

if (failures) {
  process.exitCode = 1;
}

