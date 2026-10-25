document.documentElement.classList.add("js");

const PLAYER_MOUNTERS = {
  music: () =>
    import("./music/music-player.js").then((module) => module.mountMusicPlayer),
};

function mountRandomButton(button) {
  let entries = [];
  try {
    entries = JSON.parse(button.dataset.entries || "[]");
  } catch {
    entries = [];
  }

  if (!entries.length) {
    button.hidden = true;
    return;
  }

  const currentPath = window.location.pathname;
  button.addEventListener("click", () => {
    const options = entries.filter((entry) => {
      try {
        return new URL(entry.href, window.location.href).pathname !== currentPath;
      } catch {
        return true;
      }
    });
    const pool = options.length ? options : entries;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick?.href) {
      window.location.assign(pick.href);
    }
  });
}

for (const button of document.querySelectorAll("[data-random-entry]")) {
  mountRandomButton(button);
}

const gallery = document.querySelector("[data-gallery]");
if (gallery) {
  import("./gallery.js")
    .then(({ mountGallery }) => mountGallery(gallery))
    .catch((error) => console.error("Gallery failed to start:", error));
}

const playerRoots = [...document.querySelectorAll("[data-player-type]")];
const loadedMounters = new Map();

for (const root of playerRoots) {
  const type = root.dataset.playerType;
  const getMounter = PLAYER_MOUNTERS[type];
  if (!getMounter) {
    console.warn(`No player module is registered for content type "${type}".`);
    continue;
  }
  if (!loadedMounters.has(type)) {
    loadedMounters.set(type, getMounter());
  }
  loadedMounters
    .get(type)
    .then((mount) => mount(root))
    .catch((error) => console.error(`Player for "${type}" failed to start:`, error));
}
