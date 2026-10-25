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
  formatBadges,
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

function uniqueFormats(type, entries) {
  const formats = new Map();
  for (const entry of entries) {
    for (const format of type.formats(entry)) {
      if (!formats.has(format.label)) {
        formats.set(format.label, format);
      }
    }
  }
  return [...formats.values()].slice(0, 6);
}

export function renderHome({ site, entries, collections, root }) {
  const primaryCollection = collections[0] || null;
  const browseHref =
    collections.length === 1 ? `${primaryCollection.type.id}/` : "timeline/";
  const browseLabel =
    collections.length === 1
      ? `Browse all ${primaryCollection.entries.length}`
      : "Browse the timeline";
  const latest = [...entries]
    .filter((entry) => entry.filedAtMs)
    .sort(
      (a, b) => b.filedAtMs - a.filedAtMs || compareTitles(a, b),
    )
    .slice(0, 6);
  const remaining = entries.filter((entry) => !latest.includes(entry));
  latest.push(...remaining.slice(0, Math.max(0, 6 - latest.length)));

  const randomPool = entries.map((entry) => ({
    title: entry.title,
    href: entryHref(root, entry),
  }));
  const [firstWord, secondWord] = site.wordmark;
  const drawerMarkup = collections
    .map(({ type, entries: typeEntries }, index) => {
      const formats = uniqueFormats(type, typeEntries);
      return `<a class="drawer-card" href="${escapeAttr(hrefFor(root, `${type.id}/`))}">
        <span class="drawer-card__top">
          <span class="kicker">Drawer ${String(index + 1).padStart(2, "0")} / ${escapeHtml(type.label)}</span>
          <span class="drawer-card__count">${typeEntries.length}</span>
        </span>
        <h2>${escapeHtml(type.drawerTitle)}</h2>
        <p>${escapeHtml(type.drawerDescription)}</p>
        <span class="drawer-card__footer">
          <span class="drawer-card__formats">${formatBadges(formats)}</span>
          <span class="button button--small">Open drawer</span>
        </span>
      </a>`;
    })
    .join("");

  return `<section class="hero">
    <div class="hero__copy">
      <p class="kicker">${escapeHtml(site.home.kicker)}</p>
      <h1 class="hero__title">
        <span class="hero__word">${escapeHtml(firstWord)}</span>
        <span class="hero__word hero__word--accent">${escapeHtml(secondWord)}</span>
      </h1>
      <p class="lede hero__lede">${escapeHtml(site.home.lede)}</p>
      <div class="button-row hero__actions">
        ${
          collections.length
            ? `<a class="button button--red" href="${escapeAttr(hrefFor(root, `${collections[0].type.id}/`))}">Open the ${escapeHtml(collections[0].type.pluralLabel.toLowerCase())} drawer</a>`
            : ""
        }
        ${
          entries.length
            ? `<button class="button" type="button" data-random-entry data-entries="${escapeAttr(JSON.stringify(randomPool))}">Pick a random draft</button>`
            : ""
        }
        <a class="button" href="${escapeAttr(hrefFor(root, "timeline/"))}">See the timeline</a>
      </div>
      <p class="hero__note">${escapeHtml(site.home.note)}</p>
    </div>
    <div class="hero__artifact">
      ${starDoodle("hero__doodle hero__doodle--star")}
      ${squiggleDoodle("hero__doodle hero__doodle--squiggle")}
      <div class="archive-folder">
        <div class="archive-folder__back"></div>
        <div class="archive-card">
          <span class="tape" aria-hidden="true"></span>
          <p class="archive-card__kicker">Archive inventory</p>
          <p class="archive-card__title">Proof that a person was here.</p>
          <dl class="archive-stats">
            <div class="archive-stat"><dt>Drafts</dt><dd>${entries.length}</dd></div>
            <div class="archive-stat"><dt>Drawers</dt><dd>${collections.length}</dd></div>
            <div class="archive-stat"><dt>Span</dt><dd>${escapeHtml(yearSpan(entries))}</dd></div>
            <div class="archive-stat"><dt>Generated</dt><dd>0</dd></div>
          </dl>
          <span class="archive-card__stamp">no generated filler</span>
        </div>
        <div class="archive-folder__front">
          <span class="folder-label">L'fies Drafts / drawer 01</span>
          <span class="folder-count">${entries.length} items</span>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>The drawers</h2>
      <p class="section-head__note">Everything is sorted by hand. Pull one open and stay a while.</p>
    </div>
    <div class="drawer-grid">
      ${drawerMarkup}
      <div class="drawer-future">
        <h3>More boxes in storage</h3>
        <p>Art, games, 3D experiments, and other oddities will get their own drawers when I finish digging through the old hard drives.</p>
      </div>
    </div>
  </section>

  ${
    latest.length
      ? `<section class="section">
        <div class="section-head">
          <div>
            <h2>${escapeHtml(site.home.latestTitle)}</h2>
            <p class="section-head__note">${escapeHtml(site.home.latestNote)}</p>
          </div>
          <a class="button button--small" href="${escapeAttr(hrefFor(root, browseHref))}">${escapeHtml(browseLabel)}</a>
        </div>
        <div class="entry-grid">
          ${latest.map((entry) => entryCard(entry, { type: collections.find((collection) => collection.type.id === entry.type).type, root })).join("")}
        </div>
      </section>`
      : ""
  }

  <section class="section">
    <div class="home-note">
      <span class="tape" aria-hidden="true"></span>
      <span class="home-note__mark" aria-hidden="true">“</span>
      <div class="home-note__body">
        <p class="kicker">The point of the drawer</p>
        <h2>Made by a person, on purpose.</h2>
        <p>${escapeHtml(site.about.lede)} Nothing here was generated to fill space. This is a paper trail of taste forming, one clumsy draft at a time.</p>
        <a class="button" href="${escapeAttr(hrefFor(root, "about/"))}">Read the note</a>
      </div>
    </div>
  </section>`;
}
