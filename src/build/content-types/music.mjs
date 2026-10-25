import { findAsset } from "../files.mjs";
import {
  escapeAttr,
  escapeHtml,
  fileExtensionLabel,
  formatBytes,
  relativeAssetHref,
} from "../utils.mjs";

const MIDI_EXTENSIONS = ["mid", "midi"];
const AUDIO_EXTENSIONS = ["wav", "mp3", "flac", "ogg", "oga", "m4a", "aac", "opus"];

function sourceLabel(entry) {
  const parts = [];
  if (entry.media.midi) {
    parts.push("MIDI");
  }
  if (entry.media.audio) {
    parts.push("AUDIO");
  }
  return parts.join(" + ");
}

function audioName(entry) {
  return entry.media.audio
    ? fileExtensionLabel(entry.media.audio.extension)
    : "AUDIO";
}

function playerAsset(file) {
  return escapeAttr(relativeAssetHref(file.path));
}

function transport() {
  return `<div class="transport">
    <button class="transport__play" type="button" data-action="toggle" aria-label="Play">
      <svg data-icon-play viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5L7 4.5Z"/></svg>
      <svg data-icon-pause viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6V4Zm8 0h4v16h-4V4Z"/></svg>
    </button>
    <button class="transport__skip" type="button" data-action="restart" aria-label="Back to the start">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h2v16H6V4Zm11.5 0-8 8 8 8V4Z"/></svg>
    </button>
    <div class="seek" data-seek role="slider" tabindex="0" aria-label="Seek through the draft" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <span class="seek__rail"><span class="seek__fill" data-seek-fill></span><span class="seek__thumb" data-seek-thumb></span></span>
    </div>
    <span class="transport__time"><span data-current>0:00</span> / <span data-duration>--:--</span></span>
  </div>`;
}

function sourceSwitch(kind, checked) {
  const label = kind === "audio" ? "Audio" : "MIDI";
  return `<label class="switch">
    <input type="checkbox" data-${kind}-toggle ${checked ? "checked" : ""}>
    <span class="switch__box" aria-hidden="true"></span>
    <span>${label}</span>
  </label>
  <input class="mix-slider" type="range" min="0" max="1" step="0.01" value="${kind === "audio" ? "0.85" : "0.7"}" data-${kind}-volume aria-label="${label} volume">`;
}

function mixer(entry) {
  const switches = [];
  if (entry.media.audio) {
    switches.push(sourceSwitch("audio", true));
  }
  if (entry.media.midi) {
    switches.push(sourceSwitch("midi", !entry.media.audio));
  }

  const downloads = [];
  if (entry.media.audio) {
    downloads.push(
      `<a class="mixer__download" href="${playerAsset(entry.media.audio)}" download>Audio · ${escapeHtml(audioName(entry))} · ${formatBytes(entry.media.audio.bytes)}</a>`,
    );
  }
  if (entry.media.midi) {
    downloads.push(
      `<a class="mixer__download" href="${playerAsset(entry.media.midi)}" download>MIDI · ${formatBytes(entry.media.midi.bytes)}</a>`,
    );
  }

  return `<div class="mixer">
    <div class="mixer__group">${switches.join("")}</div>
    <div class="mixer__downloads">${downloads.join("")}</div>
  </div>`;
}

function trackPanel() {
  return `<div class="track-panel">
    <div class="track-panel__head">
      <h3>Parts</h3>
      <span class="track-panel__hint" data-track-count>reading...</span>
    </div>
    <ul class="track-list" data-track-list></ul>
  </div>`;
}

function cassette(entry) {
  return `<div class="cassette-stage">
    <div class="cassette" aria-hidden="true">
      <span class="cassette__screw cassette__screw--tl"></span>
      <span class="cassette__screw cassette__screw--tr"></span>
      <span class="cassette__screw cassette__screw--bl"></span>
      <span class="cassette__screw cassette__screw--br"></span>
      <div class="cassette__label">
        <span>Draft recording / ${escapeHtml(audioName(entry))}</span>
        <strong>${escapeHtml(entry.title)}</strong>
      </div>
      <div class="cassette__window">
        <span class="cassette__reel"></span>
        <span class="cassette__reel"></span>
      </div>
    </div>
    <p class="cassette-stage__hint" data-play-hint>Press play to run the tape</p>
  </div>`;
}

function midiPlayer(entry) {
  const hasAudio = Boolean(entry.media.audio);
  return `<div class="player" data-player-mode="midi">
    <div class="pianoroll" data-pianoroll>
      <canvas class="pianoroll__canvas" data-pianoroll-canvas aria-label="Animated piano roll for ${escapeAttr(entry.title)}"></canvas>
      <div class="pianoroll__overlay" data-player-loading>Reading the piano roll...</div>
      <div class="pianoroll__overlay pianoroll__overlay--error" data-player-error hidden>This MIDI file could not be read.</div>
    </div>
    <div class="player__strip">
      <div class="player__meta">
        <span data-midi-meta>Reading MIDI...</span>
        <span>${hasAudio ? "Audio drives the roll" : "Live MIDI preview"}</span>
      </div>
      ${transport()}
    </div>
    <div class="player__lower">
      ${mixer(entry)}
      ${trackPanel()}
    </div>
    <div class="player__status">
      <span>MIDI is synthesized in your browser</span>
      <span>${hasAudio ? "Audio plays by default; flip MIDI on to hear the synth" : "Click the roll or scrub to move around"}</span>
    </div>
  </div>`;
}

function audioPlayer(entry) {
  return `<div class="player player--audio" data-player-mode="audio">
    <div class="audio-only-meta">
      <span>Cassette deck / <strong data-audio-meta>${escapeHtml(audioName(entry))}</strong></span>
      <span>${formatBytes(entry.media.audio.bytes)}</span>
    </div>
    ${cassette(entry)}
    <div class="player__strip">
      ${transport()}
    </div>
    <div class="player__lower">
      ${mixer(entry)}
    </div>
    <div class="player__status">
      <span data-play-status>Ready to play</span>
      <span>No MIDI file filed with this one</span>
    </div>
  </div>`;
}

function bar(entry) {
  return `<div class="window__bar window__bar--ink">
    <span class="window__dots" aria-hidden="true"><span class="window__dot"></span><span class="window__dot"></span><span class="window__dot"></span></span>
    <span class="window__title">Draft player / ${escapeHtml(entry.title)}</span>
    <span class="window__meta">${escapeHtml(sourceLabel(entry) || "EMPTY")}</span>
  </div>`;
}

export default {
  id: "music",
  order: 10,
  label: "Music",
  pluralLabel: "Music",
  drawerTitle: "The music drawer",
  drawerDescription:
    "Songs, sketches, transcriptions, and soundtrack experiments. Some are finished. Most are not. All of them were made by a person.",
  descriptionFallback: "No notes were filed with this one. The file speaks for itself.",
  styles: ["css/music-player.css"],
  filters: [
    { value: "midi", label: "Has MIDI" },
    { value: "audio", label: "Has recording" },
    { value: "both", label: "Both" },
  ],
  normalize(raw, { files, warn }) {
    const midi = findAsset(raw.midi, files, MIDI_EXTENSIONS);
    const audio = findAsset(raw.audio, files, AUDIO_EXTENSIONS);

    if (raw.midi && !midi) {
      warn(`MIDI file "${raw.midi}" was not found.`);
    }
    if (raw.audio && !audio) {
      warn(`Audio file "${raw.audio}" was not found.`);
    }

    return {
      media: { midi, audio },
      cover: null,
    };
  },
  formatKeys(entry) {
    const keys = [];
    if (entry.media.midi) {
      keys.push("midi");
    }
    if (entry.media.audio) {
      keys.push("audio");
    }
    if (entry.media.midi && entry.media.audio) {
      keys.push("both");
    }
    return keys;
  },
  formats(entry) {
    const formats = [];
    if (entry.media.midi) {
      formats.push({ label: "MIDI", tone: "midi" });
    }
    if (entry.media.audio) {
      formats.push({
        label: fileExtensionLabel(entry.media.audio.extension),
        tone: "audio",
      });
    }
    return formats;
  },
  inventory(entries) {
    return [
      { label: "Drafts", value: entries.length },
      { label: "With MIDI", value: entries.filter((entry) => entry.media.midi).length },
      { label: "Recordings", value: entries.filter((entry) => entry.media.audio).length },
    ];
  },
  metaRows(entry) {
    const rows = [];
    const formats = [];
    if (entry.media.midi) {
      formats.push("MIDI");
    }
    if (entry.media.audio) {
      formats.push(audioName(entry));
    }
    if (formats.length) {
      rows.push({ label: "Formats", value: formats.join(" + ") });
    }
    if (entry.files.length) {
      rows.push({ label: "Files", value: String(entry.files.length) });
    }
    return rows;
  },
  player(entry) {
    const hasMidi = Boolean(entry.media.midi);
    const hasAudio = Boolean(entry.media.audio);

    if (!hasMidi && !hasAudio) {
      return `<section class="window player-window">
        ${bar(entry)}
        <div class="window__body">
          <div class="no-player">
            <div>
              <strong>Nothing to play.</strong>
              <p>The file survived, but there is no MIDI or audio recording attached to this draft.</p>
            </div>
          </div>
        </div>
      </section>`;
    }

    return `<section class="window player-window" data-music-player data-player-type="music" data-player-title="${escapeAttr(entry.title)}" data-has-midi="${hasMidi}" data-has-audio="${hasAudio}" data-midi-url="${hasMidi ? playerAsset(entry.media.midi) : ""}" data-audio-url="${hasAudio ? playerAsset(entry.media.audio) : ""}" data-midi-offset="${Number(entry.data["midi-offset"] ?? entry.data.midiOffset) || 0}">
      ${bar(entry)}
      ${hasMidi ? midiPlayer(entry) : audioPlayer(entry)}
    </section>`;
  },
};

