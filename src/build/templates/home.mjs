import {
  compareTitles,
  entryHref,
  escapeAttr,
  escapeHtml,
  formatYear,
  hrefFor,
} from "../utils.mjs";
import {
  entryCard,
  squiggleDoodle,
  starDoodle,
} from "./partials.mjs";

function yearSpan(entries) {
  const years = entries
    .map((entry) => formatYear(entry.filedAt))
    .filter(Boolean)
    .sort();
  if (!years.length) {
    return "—";
  }
  return years[0] === years[years.length - 1]
    ? years[0]
    : `${years[0]}–${years[years.length - 1]}`;
}

export function renderHome({ site, entries, collections, root }) {
  const primaryCollection = collections[0] || null;
  const primaryType = primaryCollection?.type || null;
  const inventory = primaryType
    ? primaryType.inventory(primaryCollection.entries)
    : [{ label: "Drafts", value: entries.length }];
  const browseHref = primaryType ? `${primaryType.id}/` : "timeline/";
  const browseLabel = primaryType
    ? `All ${primaryCollection.entries.length}`
    : "Timeline";
  const latest = [...entries]
    .filter((entry) => entry.filedAtMs)
    .sort((a, b) => b.filedAtMs - a.filedAtMs || compareTitles(a, b))
    .slice(0, 6);
  const remaining = entries.filter((entry) => !latest.includes(entry));
  latest.push(...remaining.slice(0, Math.max(0, 6 - latest.length)));

  const randomPool = entries.map((entry) => ({
    title: entry.title,
    href: entryHref(root, entry),
  }));
  const [firstWord, secondWord] = site.wordmark;
  const cardType = (entry) =>
    collections.find((collection) => collection.type.id === entry.type).type;

  return `<section class="hero">
    <div class="hero__copy">
      <h1 class="hero__title">
        <span class="hero__word">${escapeHtml(firstWord)}</span>
        <span class="hero__word hero__word--accent">${escapeHtml(secondWord)}</span>
      </h1>
      <p class="lede hero__lede">${escapeHtml(site.home.lede)}</p>
      <div class="button-row hero__actions">
        <a class="button button--red" href="${escapeAttr(hrefFor(root, browseHref))}">Browse music</a>
        ${
          entries.length
            ? `<button class="button" type="button" data-random-entry data-entries="${escapeAttr(JSON.stringify(randomPool))}">Random draft</button>`
            : ""
        }
      </div>
    </div>
    <div class="hero__artifact">
      ${starDoodle("hero__doodle hero__doodle--star")}
      ${squiggleDoodle("hero__doodle hero__doodle--squiggle")}
      <div class="archive-folder">
        <div class="archive-folder__back"></div>
        <div class="archive-card">
          <span class="tape" aria-hidden="true"></span>
          <p class="archive-card__title">${escapeHtml(yearSpan(entries))}</p>
          <dl class="archive-stats">
            ${inventory
              .map(
                (item) =>
                  `<div class="archive-stat"><dt>${escapeHtml(item.label)}</dt><dd>${escapeHtml(item.value)}</dd></div>`,
              )
              .join("")}
          </dl>
        </div>
        <div class="archive-folder__front">
          <span class="folder-label">${escapeHtml(primaryType?.label || "Archive")}</span>
        </div>
      </div>
    </div>
  </section>

  ${
    latest.length
      ? `<section class="section">
        <div class="section-head">
          <h2>Recent drafts</h2>
          <a class="button button--small" href="${escapeAttr(hrefFor(root, browseHref))}">${escapeHtml(browseLabel)}</a>
        </div>
        <div class="entry-grid">
          ${latest.map((entry) => entryCard(entry, { type: cardType(entry), root, showType: collections.length > 1 })).join("")}
        </div>
      </section>`
      : `<div class="empty-state">
        <h2>No drafts yet.</h2>
        <p>Add an entry under <code>content/</code> and rebuild.</p>
      </div>`
  }`;
}
