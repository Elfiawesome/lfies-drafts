import {
  compareTitles,
  entryHref,
  escapeAttr,
  escapeHtml,
  formatMonthDay,
  formatYear,
  plural,
} from "../utils.mjs";
import { formatBadges } from "./partials.mjs";

function span(entries) {
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

export function renderTimeline({ entries, types, root }) {
  const typeMap = new Map(types.map((type) => [type.id, type]));
  const dated = entries
    .filter((entry) => entry.filedAtMs)
    .sort((a, b) => a.filedAtMs - b.filedAtMs || compareTitles(a, b));
  const undated = entries
    .filter((entry) => !entry.filedAtMs)
    .sort(compareTitles);

  const groups = new Map();
  for (const entry of dated) {
    const year = formatYear(entry.filedAt);
    if (!groups.has(year)) {
      groups.set(year, []);
    }
    groups.get(year).push(entry);
  }

  const yearLinks = [...groups.keys()]
    .map(
      (year) => `<a href="#year-${escapeAttr(year)}">${escapeHtml(year)}</a>`,
    )
    .join("");
  const yearSections = [...groups.entries()]
    .map(([year, yearEntries]) => {
      const items = yearEntries
        .map((entry) => {
          const type = typeMap.get(entry.type);
          return `<li class="timeline-item">
            <span class="timeline-item__date">${escapeHtml(formatMonthDay(entry.filedAt))}</span>
            <a class="timeline-item__title" href="${escapeAttr(entryHref(root, entry))}">${escapeHtml(entry.title)}</a>
            <span class="timeline-item__meta">
              <span>${escapeHtml(type.label)}</span>
              ${formatBadges(type.formats(entry))}
            </span>
          </li>`;
        })
        .join("");
      return `<section class="timeline-year" id="year-${escapeAttr(year)}" aria-labelledby="year-${escapeAttr(year)}-title">
        <div class="timeline-year__head">
          <h2 id="year-${escapeAttr(year)}-title">${escapeHtml(year)}</h2>
          <span>${yearEntries.length} ${plural(yearEntries.length, "draft")}</span>
        </div>
        <ol class="timeline-list">${items}</ol>
      </section>`;
    })
    .join("");

  const undatedMarkup = undated.length
    ? `<section class="timeline-year" id="undated" aria-labelledby="undated-title">
      <div class="timeline-year__head">
        <h2 id="undated-title">Undated</h2>
        <span>${undated.length} ${plural(undated.length, "draft")} with no readable timestamps</span>
      </div>
      <ol class="timeline-list">${undated
        .map((entry) => {
          const type = typeMap.get(entry.type);
          return `<li class="timeline-item">
            <span class="timeline-item__date">Unknown</span>
            <a class="timeline-item__title" href="${escapeAttr(entryHref(root, entry))}">${escapeHtml(entry.title)}</a>
            <span class="timeline-item__meta">
              <span>${escapeHtml(type.label)}</span>
              ${formatBadges(type.formats(entry))}
            </span>
          </li>`;
        })
        .join("")}</ol>
    </section>`
    : "";

  return `<section class="timeline-page-head">
    <div>
      <p class="kicker">Archive chronology / file by file</p>
      <h1>Timeline</h1>
      <p class="lede">Read from the top: the oldest draft first, the newest last. The dates are not remembered, guessed, or typed in by hand. They are read from the files themselves.</p>
      <div class="timeline-year-nav">
        ${yearLinks}
        ${undated.length ? '<a href="#undated">Undated</a>' : ""}
      </div>
    </div>
    <aside class="collection-head__aside">
      <span class="tape" aria-hidden="true"></span>
      <div class="collection-head__stat"><span>Drafts dated</span><strong>${dated.length}</strong></div>
      <div class="collection-head__stat"><span>Years covered</span><strong>${escapeHtml(span(entries))}</strong></div>
      <div class="collection-head__stat"><span>Undated</span><strong>${undated.length}</strong></div>
      <p class="side-note">Each date is the earliest of a file's created, modified, or accessed timestamp. For entries with several files, the oldest file wins.</p>
    </aside>
  </section>

  ${
    entries.length
      ? `<div class="timeline">${yearSections}${undatedMarkup}</div>`
      : `<div class="empty-state" style="margin-top: 2rem">
          <h2>The drawer is empty.</h2>
          <p>There are no dated entries to arrange yet.</p>
        </div>`
  }`;
}
