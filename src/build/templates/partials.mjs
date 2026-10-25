import {
  encodePath,
  entryHref,
  escapeAttr,
  escapeHtml,
  fileExtensionLabel,
  formatBytes,
  formatMonthYear,
  formatYear,
  hrefFor,
  plainText,
  renderStars,
  truncate,
} from "../utils.mjs";

export function starDoodle(className = "") {
  return `<svg class="doodle doodle--fill ${className}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 14.8 9.2 22.5 12 14.8 14.8 12 22.5 9.2 14.8 1.5 12 9.2 9.2Z"/></svg>`;
}

export function squiggleDoodle(className = "") {
  return `<svg class="doodle ${className}" viewBox="0 0 90 28" aria-hidden="true"><path d="M2 17c10-14 15 10 25-2s15 11 25-1 15 8 36-6"/></svg>`;
}

export function noteDoodle(className = "") {
  return `<svg class="doodle ${className}" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17V5l10-2v12"/><ellipse cx="6" cy="18" rx="3" ry="2.2"/><ellipse cx="16" cy="16" rx="3" ry="2.2"/></svg>`;
}

export function formatBadges(formats) {
  if (!formats.length) {
    return "";
  }
  return `<span class="format-list">${formats
    .map(
      (format) =>
        `<span class="format-badge format-badge--${escapeAttr(format.tone || "midi")}">${escapeHtml(format.label)}</span>`,
    )
    .join("")}</span>`;
}

export function ratingHtml(rating) {
  return renderStars(rating);
}

export function tagItems(entry, root, options = {}) {
  const { limit = 0, links = false } = options;
  const tags = limit ? entry.tags.slice(0, limit) : entry.tags;
  return tags
    .map((tag) => {
      const label = escapeHtml(tag);
      if (!links) {
        return `<li>${label}</li>`;
      }
      const collection = hrefFor(root, `${entry.type}/`);
      const href = `${collection}?tag=${encodeURIComponent(tag)}`;
      return `<li><a class="tag" href="${escapeAttr(href)}">${label}</a></li>`;
    })
    .join("");
}

function toneFor(entry) {
  let hash = 0;
  for (const character of entry.id) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % 6;
}

export function entryCard(entry, { type, root }) {
  const tone = toneFor(entry);
  const year = formatYear(entry.filedAt);
  const date = formatMonthYear(entry.filedAt);
  const description = truncate(plainText(entry.description || ""), 176);
  const primaryFile = entry.files[0];
  const fileNote = primaryFile
    ? `${primaryFile.name}${entry.files.length > 1 ? ` +${entry.files.length - 1}` : ""}`
    : "";
  const searchText = [
    entry.title,
    entry.tags.join(" "),
    plainText(entry.description || ""),
    type.label,
    entry.files.map((file) => file.name).join(" "),
  ]
    .join(" ")
    .toLowerCase();
  const remainingTags = entry.tags.length > 3 ? entry.tags.length - 3 : 0;
  const tagMarkup = tagItems(entry, root, { limit: 3 });

  return `<a class="entry-card entry-card--tone-${tone}" href="${escapeAttr(entryHref(root, entry))}" data-title="${escapeAttr(entry.title.toLowerCase())}" data-search="${escapeAttr(searchText)}" data-tags="${escapeAttr(entry.tags.join("|").toLowerCase())}" data-formats="${escapeAttr(entry.formatKeys.join(" "))}" data-rating="${entry.rating}" data-date="${entry.filedAtMs || 0}" data-ghost="${escapeAttr(year || "?")}">
    <span class="entry-card__top">
      <span class="entry-card__kind">${escapeHtml(type.label)} / draft</span>
      <span class="entry-card__date">${escapeHtml(date)}</span>
    </span>
    <h3 class="entry-card__title">${escapeHtml(entry.title)}</h3>
    ${
      description
        ? `<span class="entry-card__desc">${escapeHtml(description)}</span>`
        : `<span class="entry-card__file" title="${escapeAttr(fileNote)}">${escapeHtml(fileNote || "No file attached")}</span>`
    }
    <span class="entry-card__formats">${formatBadges(type.formats(entry))}</span>
    ${
      entry.tags.length
        ? `<ul class="entry-card__tags">${tagMarkup}${remainingTags ? `<li>+${remainingTags}</li>` : ""}</ul>`
        : ""
    }
    <span class="entry-card__bottom">
      ${entry.rating ? ratingHtml(entry.rating) : ""}
      <span class="entry-card__open">Open draft</span>
    </span>
  </a>`;
}

export function fileList(entry) {
  if (!entry.files.length) {
    return `<p class="side-note">No downloadable files are filed with this entry.</p>`;
  }

  const priority = (file) => {
    if (["mid", "midi"].includes(file.extension)) {
      return 0;
    }
    if (["wav", "mp3", "flac", "ogg", "oga", "m4a", "aac", "opus"].includes(file.extension)) {
      return 1;
    }
    if (["png", "jpg", "jpeg", "webp", "gif", "avif"].includes(file.extension)) {
      return 2;
    }
    return 3;
  };

  const files = [...entry.files].sort(
    (a, b) => priority(a) - priority(b) || a.name.localeCompare(b.name, "en"),
  );

  return `<ul class="file-list">${files
    .map((file) => {
      const href = `./${encodePath(file.path)}`;
      return `<li>
        <a class="file-link" href="${escapeAttr(href)}" download title="Download ${escapeAttr(file.name)}">
          <span class="file-link__ext">${escapeHtml(fileExtensionLabel(file.extension))}</span>
          <span class="file-link__name">${escapeHtml(file.name)}</span>
          <span class="file-link__size">${formatBytes(file.bytes)}</span>
        </a>
      </li>`;
    })
    .join("")}</ul>`;
}

export function sideCard(title, body) {
  return `<aside class="side-card">
    <div class="side-card__bar">${escapeHtml(title)}</div>
    <div class="side-card__body">${body}</div>
  </aside>`;
}
