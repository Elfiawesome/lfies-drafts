const TRACK_COLORS = [
  "#e58b6f",
  "#e0b04d",
  "#72a7c7",
  "#95b56f",
  "#b28cc9",
  "#d986a9",
  "#62b3a4",
  "#c7b57d",
  "#e07b57",
  "#8f9fd6",
];

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

export function trackColor(index) {
  return TRACK_COLORS[index % TRACK_COLORS.length];
}

function formatClock(seconds) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function roundedRect(context, x, y, width, height, radius) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const safeRadius = Math.min(radius, safeHeight / 2, safeWidth / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + safeWidth - safeRadius, y);
  context.quadraticCurveTo(x + safeWidth, y, x + safeWidth, y + safeRadius);
  context.lineTo(x + safeWidth, y + safeHeight - safeRadius);
  context.quadraticCurveTo(
    x + safeWidth,
    y + safeHeight,
    x + safeWidth - safeRadius,
    y + safeHeight,
  );
  context.lineTo(x + safeRadius, y + safeHeight);
  context.quadraticCurveTo(x, y + safeHeight, x, y + safeHeight - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

export class PianoRoll {
  constructor(canvas, midi, options = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.midi = midi;
    this.time = 0;
    this.onSeek = options.onSeek || null;
    this.visibleSeconds = midi.duration <= 20 ? 8 : 10;
    this.lowNote = Math.max(0, Math.min(127, midi.minNote - 4));
    this.highNote = Math.max(0, Math.min(127, midi.maxNote + 4));
    if (this.highNote - this.lowNote < 24) {
      const center = (this.highNote + this.lowNote) / 2;
      this.lowNote = Math.max(0, Math.floor(center - 12));
      this.highNote = Math.min(127, Math.ceil(center + 12));
    }

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.onPointerDown = (event) => this.handlePointer(event);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    this.resize();
    document.fonts?.ready.then(() => this.render()).catch(() => {});
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.render();
  }

  handlePointer(event) {
    if (!this.onSeek) {
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const keyWidth = this.keyWidth();
    if (x < keyWidth) {
      return;
    }
    const ratio = (x - keyWidth) / Math.max(1, this.width - keyWidth);
    const target = this.viewStart + ratio * this.visibleSeconds;
    this.onSeek(Math.max(0, Math.min(this.midi.duration - 0.05, target)));
  }

  setTime(time) {
    this.time = Math.max(0, Math.min(this.midi.duration, time));
    this.render();
  }

  keyWidth() {
    return this.width < 520 ? 38 : 54;
  }

  viewWindow() {
    const maxStart = Math.max(0, this.midi.duration - this.visibleSeconds * 0.92);
    const target = this.time - this.visibleSeconds * 0.3;
    const viewStart = Math.min(Math.max(target, -0.5), maxStart);
    return { viewStart, viewEnd: viewStart + this.visibleSeconds };
  }

  render() {
    if (!this.width || !this.height) {
      return;
    }

    const context = this.context;
    const width = this.width;
    const height = this.height;
    const rulerHeight = 24;
    const keyWidth = this.keyWidth();
    const rollTop = rulerHeight;
    const rollHeight = Math.max(1, height - rulerHeight);
    const semitones = Math.max(1, this.highNote - this.lowNote);
    const rowHeight = rollHeight / semitones;
    const pxPerSecond = (width - keyWidth) / this.visibleSeconds;
    const { viewStart, viewEnd } = this.viewWindow();
    this.viewStart = viewStart;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#211c16";
    context.fillRect(0, 0, width, height);

    context.fillStyle = "#2a231b";
    context.fillRect(keyWidth, 0, width - keyWidth, rulerHeight);
    context.strokeStyle = "#4a4033";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(keyWidth, rulerHeight - 0.5);
    context.lineTo(width, rulerHeight - 0.5);
    context.stroke();

    for (let pitch = this.lowNote; pitch <= this.highNote; pitch += 1) {
      const y = rollTop + (this.highNote - pitch) * rowHeight;
      if (BLACK_KEYS.has(pitch % 12)) {
        context.fillStyle = "rgba(0, 0, 0, 0.16)";
        context.fillRect(keyWidth, y, width - keyWidth, rowHeight);
      }
      if (pitch % 12 === 0) {
        context.strokeStyle = "rgba(216, 161, 58, 0.16)";
        context.beginPath();
        context.moveTo(keyWidth, y + rollHeight);
        context.lineTo(width, y + rollHeight);
        context.stroke();
      }
    }

    const step = this.visibleSeconds <= 9 ? 1 : 2;
    const firstTick = Math.ceil(viewStart / step) * step;
    context.textBaseline = "middle";
    context.font = '10px "Courier Prime", "Courier New", monospace';
    for (let tick = firstTick; tick <= viewEnd; tick += step) {
      if (tick < 0) {
        continue;
      }
      const x = keyWidth + (tick - viewStart) * pxPerSecond;
      context.strokeStyle = tick % (step * 4) === 0 ? "rgba(216, 161, 58, 0.22)" : "rgba(216, 161, 58, 0.1)";
      context.beginPath();
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, height);
      context.stroke();
      context.fillStyle = "#a8987b";
      context.fillText(formatClock(tick), x + 4, rulerHeight / 2);
    }

    context.save();
    context.beginPath();
    context.rect(keyWidth, rollTop, width - keyWidth, rollHeight);
    context.clip();

    this.midi.tracks.forEach((track, trackIndex) => {
      const color = trackColor(trackIndex);
      context.fillStyle = color;
      for (const note of track.notes) {
        if (note.start + note.duration < viewStart || note.start > viewEnd) {
          continue;
        }
        const x = keyWidth + (note.start - viewStart) * pxPerSecond;
        const noteWidth = Math.max(2, note.duration * pxPerSecond - 1);
        const y = rollTop + (this.highNote - note.note) * rowHeight + 1;
        const noteHeight = Math.max(2.5, rowHeight - 1.5);
        const active = this.time >= note.start && this.time <= note.start + note.duration;
        context.globalAlpha = active ? 1 : 0.62 + (note.velocity / 127) * 0.28;
        if (active) {
          context.shadowColor = color;
          context.shadowBlur = 8;
        }
        roundedRect(context, x, y, noteWidth, noteHeight, Math.min(2.5, noteHeight / 2));
        context.fill();
        context.shadowBlur = 0;
        if (active) {
          context.strokeStyle = "#fbf4e4";
          context.lineWidth = 1;
          context.stroke();
        }
        context.globalAlpha = 1;
      }
    });

    context.restore();

    const keyboardGradient = context.createLinearGradient(0, 0, keyWidth, 0);
    keyboardGradient.addColorStop(0, "#c8b28b");
    keyboardGradient.addColorStop(1, "#efe1c8");
    context.fillStyle = keyboardGradient;
    context.fillRect(0, rollTop, keyWidth, rollHeight);

    for (let pitch = this.lowNote; pitch <= this.highNote; pitch += 1) {
      const y = rollTop + (this.highNote - pitch) * rowHeight;
      if (BLACK_KEYS.has(pitch % 12)) {
        context.fillStyle = "#2a231b";
        context.fillRect(0, y + 0.5, keyWidth * 0.66, Math.max(1, rowHeight - 1));
      }
      if (rowHeight >= 7 && pitch % 12 === 0) {
        context.fillStyle = "#5f5343";
        context.font = '8px "Courier Prime", "Courier New", monospace';
        context.textAlign = "left";
        context.textBaseline = "middle";
        context.fillText(`C${Math.floor(pitch / 12) - 1}`, 4, y + rowHeight / 2);
      }
    }

    context.strokeStyle = "#4a4033";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(keyWidth - 0.5, rollTop);
    context.lineTo(keyWidth - 0.5, height);
    context.stroke();

    const playheadX = keyWidth + (this.time - viewStart) * pxPerSecond;
    if (playheadX >= keyWidth && playheadX <= width) {
      context.strokeStyle = "#e35a3f";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(playheadX, rulerHeight);
      context.lineTo(playheadX, height);
      context.stroke();
      context.fillStyle = "#e35a3f";
      context.beginPath();
      context.moveTo(playheadX - 4, rulerHeight);
      context.lineTo(playheadX + 4, rulerHeight);
      context.lineTo(playheadX, rulerHeight + 6);
      context.closePath();
      context.fill();
    }
  }

  destroy() {
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
  }
}
