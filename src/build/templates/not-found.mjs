import { escapeAttr, hrefFor } from "../utils.mjs";
import { noteDoodle, starDoodle } from "./partials.mjs";

export function renderNotFound({ root }) {
  return `<section class="not-found">
    ${starDoodle("hero__doodle hero__doodle--star")}
    <p class="not-found__code">404</p>
    <h1>This draft is not in the drawer.</h1>
    <p>Either the link is crooked, the file was moved, or this page never existed in the first place. It happens to the best archives.</p>
    <p class="button-row" style="justify-content: center; margin-top: 1.5rem">
      <a class="button button--red" href="${escapeAttr(root)}">Back home</a>
      <a class="button" href="${escapeAttr(hrefFor(root, "music/"))}">Rifle through the music</a>
    </p>
    ${noteDoodle("hero__doodle hero__doodle--squiggle")}
  </section>`;
}
