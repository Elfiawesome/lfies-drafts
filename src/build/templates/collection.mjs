import {
  escapeAttr,
  escapeHtml,
  formatYear,
  hrefFor,
} from "../utils.mjs";
import { entryCard } from "./partials.mjs";

function tagSet(entries) {
  const tags = new Map();
  for (const entry of entries) {
    for (const tag of entry.tags) {
      const key = tag.toLowerCase();
      if (!tags.has(key)) {
        tags.set(key, tag);
      }
    }
  }
  return [...tags.values()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

export function renderCollection({
  type,
  entries,
  root,
}) {
  const tags = tagSet(entries);
  const inventory = type.inventory(entries);
  const dated = entries.filter((entry) => entry.filedAtMs);
  const oldest = dated.length
    ? [...dated].sort((a, b) => a.filedAtMs - b.filedAtMs)[0]
    : null;
  const filters = type.filters || [];

  return `<section class="collection-head">
    <div>
      <h1>${escapeHtml(type.drawerTitle)}</h1>
      <p class="lede">${escapeHtml(type.drawerDescription)}</p>
      <div class="button-row" style="margin-top: 1.2rem">
        <a class="button button--small" href="${escapeAttr(hrefFor(root, "timeline/"))}">Timeline</a>
      </div>
    </div>
    <aside class="collection-head__aside">
      <span class="tape" aria-hidden="true"></span>
      <div class="collection-head__stat"><span>Oldest draft</span><strong>${escapeHtml(oldest ? formatYear(oldest.filedAt) : "N/A")}</strong></div>
      ${inventory
        .map(
          (item) =>
            `<div class="collection-head__stat"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`,
        )
        .join("")}
      <p class="side-note">Date = oldest file timestamp.</p>
    </aside>
  </section>

  <div class="gallery" data-gallery>
    <div class="gallery-toolbar">
      <div class="gallery-controls">
        <div class="field field--search">
          <label for="gallery-search">Search</label>
          <input id="gallery-search" type="search" placeholder="Title, tag, or filename" autocomplete="off" data-gallery-search>
        </div>
        <div class="field">
          <label for="gallery-format">Format</label>
          <select id="gallery-format" data-gallery-format>
            <option value="all">All formats</option>
            ${filters
              .map(
                (filter) =>
                  `<option value="${escapeAttr(filter.value)}">${escapeHtml(filter.label)}</option>`,
              )
              .join("")}
          </select>
        </div>
        <div class="field">
          <label for="gallery-sort">Sort</label>
          <select id="gallery-sort" data-gallery-sort>
            <option value="az">A to Z</option>
            <option value="za">Z to A</option>
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
            <option value="rating">My rating</option>
          </select>
        </div>
      </div>
      ${
        tags.length
          ? `<div class="tag-filters">
            <span class="tag-filters__label">Tags</span>
            <button class="tag is-active" type="button" data-gallery-tag="all" aria-pressed="true">All</button>
            ${tags
              .map(
                (tag) =>
                  `<button class="tag" type="button" data-gallery-tag="${escapeAttr(tag.toLowerCase())}" aria-pressed="false">${escapeHtml(tag)}</button>`,
              )
              .join("")}
          </div>`
          : ""
      }
    </div>

    <div class="gallery-status">
      <span aria-live="polite">Showing <strong data-gallery-count>${entries.length}</strong> of ${entries.length} drafts</span>
    </div>

    <div class="entry-grid" data-gallery-grid>
      ${entries
        .map((entry) => entryCard(entry, { type, root }))
        .join("")}
    </div>

    <div class="empty-state gallery-empty" data-gallery-empty>
      <h2>No drafts match.</h2>
      <p><button class="button button--small" type="button" data-gallery-reset>Clear filters</button></p>
    </div>
  </div>`;
}
