function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function mountGallery(root) {
  const grid = root.querySelector("[data-gallery-grid]");
  if (!grid) {
    return;
  }

  const cards = [...grid.querySelectorAll(".entry-card")];
  const search = root.querySelector("[data-gallery-search]");
  const format = root.querySelector("[data-gallery-format]");
  const sort = root.querySelector("[data-gallery-sort]");
  const count = root.querySelector("[data-gallery-count]");
  const empty = root.querySelector("[data-gallery-empty]");
  const reset = root.querySelector("[data-gallery-reset]");
  const tagButtons = [...root.querySelectorAll("[data-gallery-tag]")];

  for (const card of cards) {
    card.dataset.search = normalize(card.dataset.search);
    card.dataset.tags = normalize(card.dataset.tags);
  }

  for (const button of tagButtons) {
    button.dataset.galleryTag = normalize(button.dataset.galleryTag);
  }

  const state = {
    query: "",
    format: "all",
    tag: "all",
    sort: "az",
  };

  function setActiveTag(tag) {
    state.tag = tag;
    for (const button of tagButtons) {
      const active = button.dataset.galleryTag === tag;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    }
    const url = new URL(window.location.href);
    if (tag && tag !== "all") {
      url.searchParams.set("tag", tag);
    } else {
      url.searchParams.delete("tag");
    }
    window.history.replaceState({}, "", url);
  }

  function matches(card) {
    if (state.query && !card.dataset.search.includes(state.query)) {
      return false;
    }
    if (state.format !== "all") {
      const formats = (card.dataset.formats || "").split(/\s+/);
      if (!formats.includes(state.format)) {
        return false;
      }
    }
    if (state.tag !== "all") {
      const tags = (card.dataset.tags || "").split("|");
      if (!tags.includes(state.tag)) {
        return false;
      }
    }
    return true;
  }

  function sortCards() {
    const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
    const sorted = [...cards].sort((a, b) => {
      const aDate = Number(a.dataset.date) || 0;
      const bDate = Number(b.dataset.date) || 0;

      if (state.sort === "oldest" || state.sort === "newest") {
        if (!aDate && bDate) {
          return 1;
        }
        if (aDate && !bDate) {
          return -1;
        }
        const difference = state.sort === "oldest" ? aDate - bDate : bDate - aDate;
        return difference || collator.compare(a.dataset.title, b.dataset.title);
      }

      if (state.sort === "rating") {
        const difference = Number(b.dataset.rating) - Number(a.dataset.rating);
        return difference || collator.compare(a.dataset.title, b.dataset.title);
      }

      if (state.sort === "za") {
        return collator.compare(b.dataset.title, a.dataset.title);
      }

      return collator.compare(a.dataset.title, b.dataset.title);
    });

    for (const card of sorted) {
      grid.append(card);
    }
  }

  function apply() {
    let visible = 0;
    for (const card of cards) {
      const show = matches(card);
      card.hidden = !show;
      if (show) {
        visible += 1;
      }
    }
    sortCards();
    if (count) {
      count.textContent = String(visible);
    }
    if (empty) {
      empty.classList.toggle("is-visible", visible === 0);
    }
  }

  search?.addEventListener("input", () => {
    state.query = normalize(search.value);
    apply();
  });

  format?.addEventListener("change", () => {
    state.format = format.value;
    apply();
  });

  sort?.addEventListener("change", () => {
    state.sort = sort.value;
    apply();
  });

  for (const button of tagButtons) {
    button.addEventListener("click", () => {
      setActiveTag(button.dataset.galleryTag || "all");
      apply();
    });
  }

  reset?.addEventListener("click", () => {
    state.query = "";
    state.format = "all";
    state.sort = "az";
    if (search) {
      search.value = "";
    }
    if (format) {
      format.value = "all";
    }
    if (sort) {
      sort.value = "az";
    }
    setActiveTag("all");
    apply();
    search?.focus();
  });

  const requestedTag = new URLSearchParams(window.location.search).get("tag");
  if (requestedTag) {
    const normalizedTag = normalize(requestedTag);
    const hasTag = tagButtons.some(
      (button) => button.dataset.galleryTag === normalizedTag,
    );
    if (hasTag) {
      setActiveTag(normalizedTag);
    }
  }

  apply();
}
