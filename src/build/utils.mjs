import path from "node:path";

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

export function escapeAttr(value) {
  return escapeHtml(value);
}

export function encodePath(value) {
  return String(value ?? "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function hrefFor(root, target = "") {
  const clean = String(target).replace(/^\/+/, "");
  if (!clean) {
    return root || "./";
  }
  return `${root}${encodePath(clean)}`;
}

export function entryHref(root, entry) {
  return hrefFor(root, `${entry.type}/${entry.slug}/`);
}

export function rootForOutput(outputPath) {
  const directory = path.posix.dirname(outputPath);
  if (directory === "." || directory === "") {
    return "./";
  }
  return "../".repeat(directory.split("/").length);
}

export function assetHref(root, assetPath) {
  return `${root}assets/${encodePath(assetPath)}`;
}

export function relativeAssetHref(assetPath) {
  return `./${encodePath(assetPath)}`;
}

export function earliestTimestamp(...values) {
  const valid = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  return valid.length ? Math.min(...valid) : 0;
}

export function safeIsoDate(milliseconds) {
  if (!milliseconds || !Number.isFinite(milliseconds)) {
    return null;
  }
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const MONTH_YEAR_LONG = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const FULL_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const YEAR = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  timeZone: "UTC",
});

function toDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMonthYear(value) {
  const date = toDate(value);
  return date ? MONTH_YEAR.format(date) : "Undated";
}

export function formatMonthYearLong(value) {
  const date = toDate(value);
  return date ? MONTH_YEAR_LONG.format(date) : "Undated";
}

export function formatFullDate(value) {
  const date = toDate(value);
  return date ? FULL_DATE.format(date) : "Undated";
}

export function formatMonthDay(value) {
  const date = toDate(value);
  return date ? MONTH_DAY.format(date) : "Undated";
}

export function formatYear(value) {
  const date = toDate(value);
  return date ? YEAR.format(date) : null;
}

export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const scaled = value / 1024 ** exponent;
  const digits = scaled >= 10 || exponent === 0 ? 0 : 1;
  return `${scaled.toFixed(digits)} ${units[exponent]}`;
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const mm = hours ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(rest).padStart(2, "0");
  return hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return Number(count) === 1 ? singular : pluralForm;
}

export function plainText(markdown) {
  return String(markdown ?? "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => label || target)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[>*_~`]/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(value, limit = 150) {
  const text = String(value ?? "").trim();
  if (text.length <= limit) {
    return text;
  }
  const cut = text.slice(0, limit + 1);
  const boundary = cut.lastIndexOf(" ");
  return `${cut.slice(0, boundary > limit * 0.6 ? boundary : limit).trimEnd()}…`;
}

export function renderStars(rating) {
  const value = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  const starPath =
    "M8 1.4l1.9 4 4.4.6-3.2 3.1.8 4.4L8 11.4l-3.9 2.1.8-4.4L1.7 6l4.4-.6L8 1.4z";
  const stars = Array.from({ length: 5 }, (_, index) => {
    const filled = index < value;
    return `<svg viewBox="0 0 16 16" aria-hidden="true" class="${filled ? "is-filled" : "is-empty"}"><path d="${starPath}" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
  }).join("");
  return `<span class="rating" role="img" aria-label="${value} out of 5 stars"><span class="rating__stars">${stars}</span><span class="rating__text">${value ? `${value}/5` : "Unrated"}</span></span>`;
}

export function fileExtensionLabel(extension) {
  const value = String(extension ?? "").replace(/^\./, "").toUpperCase();
  return value || "FILE";
}

export function compareTitles(a, b) {
  return a.title.localeCompare(b.title, "en", { sensitivity: "base", numeric: true });
}

export function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

