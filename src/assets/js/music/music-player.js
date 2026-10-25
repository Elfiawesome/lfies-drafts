import { parseMidi } from "./midi-parser.js";
import { PianoRoll, trackColor } from "./piano-roll.js";
import { MidiSynth } from "./synth.js";

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function offsetMidi(midi, offset) {
  if (!offset) {
    return midi;
  }
  const tracks = midi.tracks.map((track) => ({
    ...track,
    notes: track.notes
      .map((note) => {
        const end = note.start + note.duration + offset;
        if (end <= 0) {
          return null;
        }
        return {
          ...note,
          start: Math.max(0, note.start + offset),
          duration: Math.max(0.015, end - Math.max(0, note.start + offset)),
        };
      })
      .filter(Boolean),
  }));
  const notes = tracks.flatMap((track) => track.notes);
  if (!notes.length) {
    return midi;
  }
  return {
    ...midi,
    tracks,
    notes,
    noteCount: notes.length,
    minNote: Math.min(...notes.map((note) => note.note)),
    maxNote: Math.max(...notes.map((note) => note.note)),
    duration: Math.max(...notes.map((note) => note.start + note.duration)) + 0.35,
  };
}

class MusicPlayer {
  constructor(root) {
    this.root = root;
    this.hasMidi = root.dataset.hasMidi === "true";
    this.hasAudio = root.dataset.hasAudio === "true";
    this.midiUrl = root.dataset.midiUrl || "";
    this.audioUrl = root.dataset.audioUrl || "";
    this.midiOffset = Number(root.dataset.midiOffset) || 0;
    this.midi = null;
    this.roll = null;
    this.audio = null;
    this.audioFailed = false;
    this.audioReady = false;
    this.context = null;
    this.synth = null;
    this.duration = 0;
    this.position = 0;
    this.startContextTime = 0;
    this.startOffset = 0;
    this.lastScheduled = 0;
    this.scheduler = null;
    this.frame = null;
    this.pendingSeek = null;
    this.lastSeekAt = 0;
    this.mutedTracks = new Set();
    this.notes = [];
    this.playing = false;
    this.midiEnabled = false;
    this.scrubbing = false;

    this.playButton = root.querySelector('[data-action="toggle"]');
    this.restartButton = root.querySelector('[data-action="restart"]');
    this.seek = root.querySelector("[data-seek]");
    this.seekFill = root.querySelector("[data-seek-fill]");
    this.seekThumb = root.querySelector("[data-seek-thumb]");
    this.currentLabels = [...root.querySelectorAll("[data-current]")];
    this.durationLabels = [...root.querySelectorAll("[data-duration]")];
    this.midiMeta = root.querySelector("[data-midi-meta]");
    this.trackList = root.querySelector("[data-track-list]");
    this.trackCount = root.querySelector("[data-track-count]");
    this.loading = root.querySelector("[data-player-loading]");
    this.error = root.querySelector("[data-player-error]");
    this.audioToggle = root.querySelector("[data-audio-toggle]");
    this.midiToggle = root.querySelector("[data-midi-toggle]");
    this.audioVolume = root.querySelector("[data-audio-volume]");
    this.midiVolume = root.querySelector("[data-midi-volume]");
    this.playHint = root.querySelector("[data-play-hint]");
    this.playStatus = root.querySelector("[data-play-status]");
    this.audioMeta = root.querySelector("[data-audio-meta]");
    this.canvas = root.querySelector("[data-pianoroll-canvas]");

    if (this.midiToggle) {
      this.midiEnabled = this.midiToggle.checked;
    }
    this.bindControls();
  }

  async init() {
    if (this.hasAudio) {
      this.setupAudio();
    }
    if (this.hasMidi) {
      await this.loadMidi();
    } else {
      this.updateDuration();
    }
    this.updateUI(this.getPosition());
  }

  setupAudio() {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = this.audioUrl;
    audio.volume = this.audioVolume ? Number(this.audioVolume.value) : 0.85;
    audio.muted = this.audioToggle ? !this.audioToggle.checked : false;
    audio.addEventListener("loadedmetadata", () => {
      this.audioReady = true;
      if (this.pendingSeek !== null) {
        try {
          audio.currentTime = this.pendingSeek;
        } catch {
          this.pendingSeek = null;
        }
        this.pendingSeek = null;
      }
      this.updateDuration();
      this.updateUI(this.getPosition());
    });
    audio.addEventListener("ended", () => this.finish());
    audio.addEventListener("error", () => {
      if (!this.audioFailed) {
        this.audioFailed = true;
        this.showAudioError("The recording could not be loaded.");
        this.updateDuration();
      }
    });
    this.audio = audio;
  }

  async loadMidi() {
    try {
      const response = await fetch(this.midiUrl);
      if (!response.ok) {
        throw new Error(`MIDI request failed with status ${response.status}.`);
      }
      const buffer = await response.arrayBuffer();
      const parsed = offsetMidi(parseMidi(buffer), this.midiOffset);
      this.midi = parsed;
      this.notes = parsed.tracks
        .flatMap((track, trackIndex) => {
          const pan =
            parsed.tracks.length > 1
              ? (trackIndex / (parsed.tracks.length - 1) - 0.5) * 0.55
              : 0;
          return track.notes.map((note) => ({
            ...note,
            trackIndex,
            pan,
          }));
        })
        .sort((a, b) => a.start - b.start);

      this.roll = new PianoRoll(this.canvas, parsed, {
        onSeek: (time) => this.seekTo(time),
      });
      if (this.context) {
        this.ensureSynth();
      }
      this.renderTracks();
      this.loading.hidden = true;
      this.error.hidden = true;
      const timeSignature = `${parsed.timeSignature.numerator}/${parsed.timeSignature.denominator}`;
      if (this.midiMeta) {
        this.midiMeta.textContent = `${parsed.noteCount} notes · ${parsed.tracks.length} ${parsed.tracks.length === 1 ? "part" : "parts"} · ${parsed.bpm} BPM · ${timeSignature}`;
      }
      this.updateDuration();
      this.roll.setTime(this.getPosition());
    } catch (error) {
      console.warn("MIDI player error:", error);
      if (this.loading) {
        this.loading.hidden = true;
      }
      if (this.error) {
        this.error.hidden = false;
        this.error.textContent = this.hasAudio
          ? "This piano roll could not be read. The recording still plays."
          : "This MIDI file could not be read.";
      }
      if (this.midiMeta) {
        this.midiMeta.textContent = "Piano roll unavailable";
      }
      if (this.trackCount) {
        this.trackCount.textContent = "unavailable";
      }
      if (this.trackList) {
        this.trackList.innerHTML = "";
      }
      if (this.midiToggle) {
        this.midiToggle.checked = false;
        this.midiToggle.disabled = true;
        this.midiEnabled = false;
      }
      this.updateDuration();
      if (!this.hasAudio && this.playButton) {
        this.playButton.disabled = true;
      }
    }
  }

  bindControls() {
    this.playButton?.addEventListener("click", () => {
      if (this.playing) {
        this.pause();
      } else {
        void this.play();
      }
    });
    this.restartButton?.addEventListener("click", () => {
      this.seekTo(0);
      if (this.playHint) {
        this.playHint.textContent = "Back at the start";
      }
    });

    if (this.seek) {
      this.seek.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.scrubbing = true;
        this.seek.setPointerCapture(event.pointerId);
        this.seekFromPointer(event);
      });
      this.seek.addEventListener("pointermove", (event) => {
        if (this.scrubbing) {
          this.seekFromPointer(event);
        }
      });
      const stopScrubbing = (event) => {
        this.scrubbing = false;
        try {
          this.seek.releasePointerCapture(event.pointerId);
        } catch {
          return;
        }
      };
      this.seek.addEventListener("pointerup", stopScrubbing);
      this.seek.addEventListener("pointercancel", stopScrubbing);
      this.seek.addEventListener("keydown", (event) => {
        const current = this.getPosition();
        let target = null;
        if (event.key === "ArrowLeft") {
          target = current - 5;
        } else if (event.key === "ArrowRight") {
          target = current + 5;
        } else if (event.key === "Home") {
          target = 0;
        } else if (event.key === "End") {
          target = this.duration;
        }
        if (target !== null) {
          event.preventDefault();
          this.seekTo(target);
        }
      });
    }

    this.audioToggle?.addEventListener("change", () => {
      if (this.audio) {
        this.audio.muted = !this.audioToggle.checked;
      }
    });

    this.midiToggle?.addEventListener("change", () => {
      this.midiEnabled = this.midiToggle.checked;
      this.stopScheduledNotes();
      if (this.midiEnabled) {
        this.ensureSynth();
        void this.context?.resume();
        this.lastScheduled = Math.max(0, this.getPosition() - 0.05);
      }
    });

    this.audioVolume?.addEventListener("input", () => {
      if (this.audio) {
        this.audio.volume = Number(this.audioVolume.value);
      }
    });

    this.midiVolume?.addEventListener("input", () => {
      if (this.synth) {
        this.synth.setVolume(Number(this.midiVolume.value));
      }
    });

    this.trackList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-track-index]");
      if (!button) {
        return;
      }
      const index = Number(button.dataset.trackIndex);
      if (this.mutedTracks.has(index)) {
        this.mutedTracks.delete(index);
      } else {
        this.mutedTracks.add(index);
      }
      button.setAttribute(
        "aria-pressed",
        this.mutedTracks.has(index) ? "true" : "false",
      );
      button.closest(".track-item")?.classList.toggle(
        "is-muted",
        this.mutedTracks.has(index),
      );
      this.stopScheduledNotes();
      this.lastScheduled = this.getPosition();
    });
  }

  seekFromPointer(event) {
    if (!this.duration) {
      return;
    }
    const now = performance.now();
    if (now - this.lastSeekAt < 12) {
      return;
    }
    this.lastSeekAt = now;
    const rect = this.seek.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    this.seekTo(ratio * this.duration);
  }

  ensureContext() {
    if (this.context) {
      return true;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return false;
    }
    this.context = new AudioContext();
    return true;
  }

  ensureSynth() {
    if (!this.midi || !this.ensureContext()) {
      return false;
    }
    if (!this.synth) {
      this.synth = new MidiSynth(this.context);
      this.synth.setVolume(this.midiVolume ? Number(this.midiVolume.value) : 0.7);
    }
    return true;
  }

  clockMode() {
    if (this.audio && !this.audioFailed) {
      return "audio";
    }
    if (this.midi) {
      return "midi";
    }
    return null;
  }

  getPosition() {
    if (this.clockMode() === "audio") {
      return clamp(this.audio.currentTime || 0, 0, this.duration || 0);
    }
    if (this.playing && this.context) {
      return clamp(
        this.startOffset + this.context.currentTime - this.startContextTime,
        0,
        this.duration || 0,
      );
    }
    return clamp(this.position, 0, this.duration || 0);
  }

  updateDuration() {
    let duration = 0;
    if (this.audio && this.audioReady && Number.isFinite(this.audio.duration)) {
      duration = this.audio.duration;
    } else if (this.midi) {
      duration = this.midi.duration;
    }
    if (!duration && this.audio && Number.isFinite(this.audio.duration)) {
      duration = this.audio.duration;
    }
    this.duration = duration;
    for (const label of this.durationLabels) {
      label.textContent = duration ? formatClock(duration) : "--:--";
    }
    this.updateUI(this.getPosition());
  }

  updateUI(time) {
    const position = clamp(time, 0, this.duration || 0);
    const progress = this.duration ? (position / this.duration) * 100 : 0;
    if (this.seek) {
      this.seek.style.setProperty("--progress", `${progress}%`);
      this.seek.setAttribute("aria-valuenow", String(Math.round(progress)));
    }
    if (this.seekFill) {
      this.seekFill.style.width = `${progress}%`;
    }
    if (this.seekThumb) {
      this.seekThumb.style.left = `${progress}%`;
    }
    for (const label of this.currentLabels) {
      label.textContent = formatClock(position);
    }
    if (this.roll) {
      this.roll.setTime(position);
    }
  }

  async play() {
    if (this.playing || !this.duration) {
      return;
    }
    if (this.getPosition() >= this.duration - 0.08) {
      this.seekTo(0);
    }
    const mode = this.clockMode();
    if (!mode) {
      return;
    }

    if (this.midi && !this.ensureSynth()) {
      this.showAudioError("Web Audio is not available in this browser.");
      return;
    }

    if (this.context) {
      await this.context.resume();
    }

    if (mode === "audio") {
      try {
        this.audio.muted = this.audioToggle ? !this.audioToggle.checked : false;
        await this.audio.play();
      } catch (error) {
        console.warn("Audio playback failed:", error);
        this.audioFailed = true;
        this.showAudioError("The recording could not start.");
        if (!this.midi) {
          return;
        }
      }
    }

    this.playing = true;
    this.root.classList.add("is-playing");
    this.playButton?.setAttribute("aria-label", "Pause");
    if (this.playHint) {
      this.playHint.textContent = "Tape running";
    }
    this.setPlayStatus("Playing");

    if (this.clockMode() === "midi") {
      this.startOffset = this.position;
      this.startContextTime = this.context.currentTime;
    }

    this.lastScheduled = this.getPosition();
    this.startScheduler();
    this.startFrameLoop();
  }

  pause() {
    if (!this.playing) {
      return;
    }
    const position = this.getPosition();
    this.playing = false;
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
    if (this.clockMode() === "midi") {
      this.position = position;
    }
    this.stopScheduler();
    this.stopScheduledNotes();
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    this.root.classList.remove("is-playing");
    this.playButton?.setAttribute("aria-label", "Play");
    if (this.playHint) {
      this.playHint.textContent = "Tape paused";
    }
    this.setPlayStatus("Paused");
    this.updateUI(position);
  }

  finish() {
    if (!this.playing) {
      return;
    }
    const position = this.duration;
    this.playing = false;
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
    if (this.clockMode() === "midi") {
      this.position = position;
    }
    this.stopScheduler();
    this.stopScheduledNotes();
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    this.root.classList.remove("is-playing");
    this.playButton?.setAttribute("aria-label", "Play");
    if (this.playHint) {
      this.playHint.textContent = "The tape reached the end";
    }
    this.setPlayStatus("Finished");
    this.updateUI(position);
  }

  seekTo(value) {
    if (!this.duration) {
      return;
    }
    const target = clamp(value, 0, this.duration);
    if (this.audio && !this.audioFailed) {
      if (this.audio.readyState >= 1) {
        try {
          this.audio.currentTime = target;
        } catch {
          this.pendingSeek = target;
        }
      } else {
        this.pendingSeek = target;
      }
    }
    if (this.clockMode() === "midi") {
      this.position = target;
      if (this.playing && this.context) {
        this.startOffset = target;
        this.startContextTime = this.context.currentTime;
      }
    }
    this.lastScheduled = target;
    this.stopScheduledNotes();
    this.updateUI(target);
    if (!this.playing && this.playHint) {
      this.playHint.textContent = "Ready to play";
    }
  }

  startScheduler() {
    this.stopScheduler();
    if (!this.midi) {
      return;
    }
    this.lastScheduled = Math.max(
      0,
      Math.min(this.lastScheduled, this.getPosition()) - 0.05,
    );
    this.scheduler = window.setInterval(() => this.schedule(), 45);
    this.schedule();
  }

  stopScheduler() {
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
  }

  schedule() {
    if (!this.playing || !this.midi || !this.midiEnabled || !this.synth) {
      return;
    }
    const context = this.context;
    const current = this.getPosition();
    if (current < this.lastScheduled - 0.5 || current > this.lastScheduled + 1.5) {
      this.lastScheduled = current;
    }
    if (this.lastScheduled < current - 0.05) {
      this.lastScheduled = current;
    }
    const horizon = current + 0.22;
    if (horizon <= this.lastScheduled) {
      return;
    }
    for (const note of this.notes) {
      if (note.start < this.lastScheduled) {
        continue;
      }
      if (note.start > horizon) {
        break;
      }
      if (!this.mutedTracks.has(note.trackIndex)) {
        const when = context.currentTime + Math.max(0, note.start - current);
        this.synth.scheduleNote(note, when, note.pan);
      }
    }
    this.lastScheduled = horizon;
  }

  stopScheduledNotes() {
    this.synth?.stopAll();
  }

  startFrameLoop() {
    if (this.frame) {
      cancelAnimationFrame(this.frame);
    }
    const tick = () => {
      if (!this.playing) {
        return;
      }
      const position = this.getPosition();
      if (position >= this.duration - 0.02) {
        this.finish();
        return;
      }
      this.updateUI(position);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  renderTracks() {
    if (!this.trackList || !this.midi) {
      return;
    }
    this.trackList.innerHTML = "";
    this.midi.tracks.forEach((track, index) => {
      const item = document.createElement("li");
      item.className = "track-item";

      const swatch = document.createElement("span");
      swatch.className = "track-item__swatch";
      swatch.style.setProperty("--track-color", trackColor(index));

      const name = document.createElement("span");
      name.className = "track-item__name";
      name.textContent = track.name;
      name.title = `${track.name} · channel ${track.channel + 1}`;

      const notes = document.createElement("span");
      notes.className = "track-item__notes";
      notes.textContent = `${track.notes.length}`;

      const button = document.createElement("button");
      button.className = "track-mute";
      button.type = "button";
      button.dataset.trackIndex = String(index);
      button.setAttribute("aria-label", `Mute ${track.name}`);
      button.setAttribute("aria-pressed", "false");
      button.textContent = "M";

      item.append(swatch, name, notes, button);
      this.trackList.append(item);
    });
    if (this.trackCount) {
      this.trackCount.textContent = `${this.midi.tracks.length} ${this.midi.tracks.length === 1 ? "part" : "parts"}`;
    }
  }

  setPlayStatus(text) {
    if (this.playStatus) {
      this.playStatus.textContent = text;
    }
  }

  showAudioError(message) {
    if (this.playStatus) {
      this.playStatus.textContent = message;
    }
    if (this.playHint) {
      this.playHint.textContent = message;
    }
    if (this.midi && this.midiToggle) {
      this.midiToggle.checked = true;
      this.midiEnabled = true;
    }
    if (!this.hasMidi) {
      this.playButton?.setAttribute("disabled", "disabled");
    }
  }
}

export async function mountMusicPlayer(root) {
  const player = new MusicPlayer(root);
  root.musicPlayer = player;
  await player.init();
  return player;
}
