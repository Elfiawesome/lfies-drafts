import { escapeAttr, hrefFor } from "../utils.mjs";

export function renderNotFound({ root }) {
  return `<section class="not-found">
    <p class="not-found__code">404</p>
    <h1>Page not found.</h1>
    <p class="button-row" style="justify-content: center; margin-top: 1.5rem">
      <a class="button button--red" href="${escapeAttr(root)}">Home</a>
      <a class="button" href="${escapeAttr(hrefFor(root, "music/"))}">Music</a>
    </p>
  </section>`;
}
