import {
  escapeHtml,
  formatFullDate,
  formatYear,
} from "../utils.mjs";
import { sideCard } from "./partials.mjs";

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

export function renderAbout({
  site,
  entries,
  collections,
  root,
  markdown,
  buildDate,
}) {
  const colophon = sideCard(
    "Colophon",
    `<ul class="colophon">
      <li><span>Drafts</span><strong>${entries.length}</strong></li>
      <li><span>Drawers</span><strong>${collections.map((collection) => escapeHtml(collection.type.label)).join(", ") || "—"}</strong></li>
      <li><span>Years</span><strong>${escapeHtml(yearSpan(entries))}</strong></li>
      <li><span>Built with</span><strong>Node + marked</strong></li>
      <li><span>Type</span><strong>Fraunces, Lora, Courier Prime</strong></li>
      <li><span>Generated assets</span><strong>None</strong></li>
      <li><span>Rebuilt</span><strong>${escapeHtml(formatFullDate(buildDate.toISOString()))}</strong></li>
    </ul>`,
  );

  return `<section class="about-head">
    <div>
      <p class="kicker">${escapeHtml(site.about.kicker)}</p>
      <h1>${escapeHtml(site.about.title)}</h1>
      <p class="lede">${escapeHtml(site.about.lede)}</p>
    </div>
    <div class="button-row">
      <a class="button button--red" href="${escapeHtml(root)}">Back to the drawer</a>
    </div>
  </section>

  <div class="about-layout">
    <div class="prose">${markdown.render(site.about.markdown)}</div>
    <aside class="about-side">
      <div class="about-stamp-card">
        <span class="tape" aria-hidden="true"></span>
        <span class="stamp" style="font-size: 0.8rem">100% human / no prompts</span>
        <p>Every file in this archive was made by a person, with time, taste, and at least one questionable decision.</p>
      </div>
      ${colophon}
      <div class="badge-row">
        <span class="badge-88x31 badge-88x31--red">made by<br>a human</span>
        <span class="badge-88x31 badge-88x31--ink">no generated<br>filler</span>
        <span class="badge-88x31 badge-88x31--gold">old files<br>still alive</span>
      </div>
    </aside>
  </div>`;
}
