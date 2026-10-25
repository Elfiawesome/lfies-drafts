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
    return "N/A";
  }
  return years[0] === years[years.length - 1]
    ? years[0]
    : `${years[0]}-${years[years.length - 1]}`;
}

export function renderAbout({
  site,
  entries,
  root,
  markdown,
  buildDate,
}) {
  const colophon = sideCard(
    "Colophon",
    `<ul class="colophon">
      <li><span>Drafts</span><strong>${entries.length}</strong></li>
      <li><span>Years</span><strong>${escapeHtml(yearSpan(entries))}</strong></li>
      <li><span>Built with</span><strong>Node, marked, SpessaSynth</strong></li>
      <li><span>SoundFont</span><strong>GeneralUser GS</strong></li>
      <li><span>Rebuilt</span><strong>${escapeHtml(formatFullDate(buildDate.toISOString()))}</strong></li>
    </ul>`,
  );

  return `<section class="about-head">
    <div>
      <h1>${escapeHtml(site.about.title)}</h1>
      <p class="lede">${escapeHtml(site.about.lede)}</p>
    </div>
    <div class="button-row">
      <a class="button button--red" href="${escapeHtml(root)}">Back</a>
    </div>
  </section>

  <div class="about-layout">
    <div class="prose">${markdown.render(site.about.markdown)}</div>
    <aside class="about-side">
      ${colophon}
    </aside>
  </div>`;
}
