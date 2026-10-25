import http from "node:http";
import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mid": "audio/midi",
  ".midi": "audio/midi",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".opus": "audio/ogg",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function contentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function findFile(rootDirectory, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const relative = decoded.replace(/^\/+/, "");
  const requested = path.resolve(rootDirectory, relative);
  const rootResolved = path.resolve(rootDirectory);
  const relativeToRoot = path.relative(rootResolved, requested);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return null;
  }

  const candidates = [];
  if (decoded.endsWith("/")) {
    candidates.push(path.join(requested, "index.html"));
  } else {
    candidates.push(requested, `${requested}.html`, path.join(requested, "index.html"));
  }

  for (const candidate of candidates) {
    try {
      const stats = await stat(candidate);
      if (stats.isFile()) {
        return { filePath: candidate, stats };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function parseRange(rangeHeader, size) {
  if (!rangeHeader) {
    return null;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }
  let start = match[1] ? Number(match[1]) : null;
  let end = match[2] ? Number(match[2]) : null;
  if (start === null && end === null) {
    return null;
  }
  if (start === null) {
    start = Math.max(0, size - end);
    end = size - 1;
  } else {
    end = end === null ? size - 1 : Math.min(end, size - 1);
  }
  if (start < 0 || start >= size || end < start) {
    return { invalid: true };
  }
  return { start, end };
}

export function createStaticServer({ rootDirectory, cacheControl = "no-store" }) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://localhost");
    const found = await findFile(rootDirectory, url.pathname);

    if (!found) {
      const fallback = path.join(rootDirectory, "404.html");
      try {
        const fallbackStats = await stat(fallback);
        response.writeHead(404, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Length": fallbackStats.size,
          "Cache-Control": cacheControl,
        });
        createReadStream(fallback).pipe(response);
      } catch {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
      }
      return;
    }

    const { filePath, stats } = found;
    const range = parseRange(request.headers.range, stats.size);
    const headers = {
      "Content-Type": contentType(filePath),
      "Cache-Control": cacheControl,
      "Accept-Ranges": "bytes",
    };

    if (range?.invalid) {
      response.writeHead(416, {
        "Content-Range": `bytes */${stats.size}`,
        "Cache-Control": cacheControl,
      });
      response.end();
      return;
    }

    if (range) {
      headers["Content-Range"] = `bytes ${range.start}-${range.end}/${stats.size}`;
      headers["Content-Length"] = range.end - range.start + 1;
      response.writeHead(206, headers);
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      createReadStream(filePath, { start: range.start, end: range.end }).pipe(response);
      return;
    }

    headers["Content-Length"] = stats.size;
    response.writeHead(200, headers);
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  });
}

export function listen(server, preferredPort = 4173) {
  return new Promise((resolve, reject) => {
    const attempt = (port, isRetry = false) => {
      server.once("error", (error) => {
        if (!isRetry && error.code === "EADDRINUSE") {
          attempt(0, true);
          return;
        }
        reject(error);
      });
      server.listen(port, "127.0.0.1", () => {
        resolve(server.address().port);
      });
    };
    attempt(preferredPort);
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const distDirectory = path.join(projectRoot, "dist");
  try {
    await access(path.join(distDirectory, "index.html"));
  } catch {
    console.error("No built site found. Run `npm run build` first.");
    process.exit(1);
  }
  const server = createStaticServer({ rootDirectory: distDirectory, cacheControl: "no-cache" });
  const port = await listen(server, Number(process.env.PORT) || 4173);
  console.log(`Previewing the archive at http://localhost:${port}/`);
  const close = () => server.close(() => process.exit(0));
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}
