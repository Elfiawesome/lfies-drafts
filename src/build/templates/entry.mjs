import {
  entryHref,
  escapeAttr,
  escapeHtml,
  formatFullDate,
  formatMonthYearLong,
  formatYear,
  hrefFor,
} from "../utils.mjs";
import {
  fileList,
  formatBadges,
  ratingHtml,
  sideCard,
  tagItems,
} from "./partials.mjs";

export function renderEntry({
  entry,
  type,
  root,
  markdown,
  prev,
  next,
  related = [],
}) {
  const description = entry.description
    ? markdown.render(entry.description)
    : `<p>${escapeHtml(type.descriptionFallback || "No notes were filed with this one.")}</p>`;
  const collectionHref = hrefFor(root, `${entry.type}/`);
  const year = formatYear(entry.filedAt);
  const metaRows = type.metaRows(entry, { root });
  const tags = tagItems(entry, root, { links: true });
  const relatedMarkup = related.length
    ? sideCard(
        "See also",
        `<ul class="related-list">${related
          .map(
            (item) =>
              `<li><a href="${escapeAttr(entryHref(root, item))}">${escapeHtml(item.title)}</a></li>`,
          )
          .join("")}</ul>`,
      )
    : "";
  const nearbyMarkup =
    prev || next
      ? sideCard(
          "Nearby drafts",
          `<div class="prev-next">
            ${
              prev
                ? `<a href="${escapeAttr(entryHref(root, prev))}"><span>Previous</span>${escapeHtml(prev.title)}</a>`
                : ""
            }
            ${
              next
                ? `<a href="${escapeAttr(entryHref(root, next))}"><span>Next</span>${escapeHtml(next.title)}</a>`
                : ""
            }
          </div>`,
        )
      : "";

  return `<nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="${escapeAttr(root)}">Home</a>
    <span aria-hidden="true">/</span>
    <a href="${escapeAttr(collectionHref)}">${escapeHtml(type.pluralLabel)}</a>
    <span aria-hidden="true">/</span>
    <span aria-current="page">${escapeHtml(entry.title)}</span>
  </nav>

  <article class="entry" aria-labelledby="entry-title">
    <header class="entry-head">
      <div>
        <div class="entry-head__kicker">
          <span class="mono">${escapeHtml(type.label)} / ${escapeHtml(entry.slug)}</span>
          ${formatBadges(type.formats(entry))}
        </div>
        <h1 id="entry-title">${escapeHtml(entry.title)}</h1>
        <div class="entry-head__desc prose">${description}</div>
        ${tags ? `<ul class="tag-list entry-head__tags">${tags}</ul>` : ""}
      </div>
      <div class="entry-head__side">
        <span class="entry-head__date">Dated ${escapeHtml(formatMonthYearLong(entry.filedAt))}</span>
        <span class="stamp entry-head__stamp">${escapeHtml(year || "Undated")}</span>
        ${ratingHtml(entry.rating)}
      </div>
    </header>

    <div class="entry-layout">
      <div class="entry-main">
        ${type.player(entry, { root })}
        ${
          entry.about
            ? `<section class="entry-notes" aria-labelledby="entry-about">
              <h2 class="entry-section-title" id="entry-about">About this draft</h2>
              <div class="prose">${markdown.render(entry.about)}</div>
            </section>`
            : ""
        }
      </div>

      <aside class="entry-side" aria-label="Draft details">
        ${sideCard(
          "File details",
          `<dl class="meta-list">
            <div class="meta-row"><dt>Dated</dt><dd>${escapeHtml(formatFullDate(entry.filedAt))}</dd></div>
            <div class="meta-row"><dt>Drawer</dt><dd><a href="${escapeAttr(collectionHref)}">${escapeHtml(type.pluralLabel)}</a></dd></div>
            <div class="meta-row"><dt>Rating</dt><dd>${ratingHtml(entry.rating)}</dd></div>
            ${metaRows
              .map(
                (row) =>
                  `<div class="meta-row"><dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd></div>`,
              )
              .join("")}
          </dl>
          ${tags ? `<div class="side-tags"><ul class="tag-list">${tags}</ul></div>` : ""}
          <p class="side-note">Entry date comes from the earliest timestamp across ${entry.files.length} ${entry.files.length === 1 ? "file" : "files"} in this entry.</p>`,
        )}
        ${sideCard(`Files / ${entry.files.length}`, fileList(entry))}
        ${nearbyMarkup}
        ${relatedMarkup}
      </aside>
    </div>
  </article>`;
}
