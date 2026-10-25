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

function buildMeasureGrid(midi, durationTicks) {
  const signatures = midi.timeSignatures.length
    ? midi.timeSignatures
    : [{ tick: 0, numerator: 4, denominator: 4 }];
  const initialMeasureTicks = Math.max(
    1,
    signatures[0].numerator * (4 / signatures[0].denominator) * midi.ppq,
  );
  const measures = [];
  let tick = 0;
  let bar = 1;
  let signatureIndex = 0;
  const limit = Math.max(durationTicks, initialMeasureTicks * 4) + initialMeasureTicks * 2;

  while (tick < limit && measures.length < 10000) {
    while (
      signatureIndex + 1 < signatures.length &&
      signatures[signatureIndex + 1].tick <= tick
    ) {
      signatureIndex += 1;
    }
    const signature = signatures[signatureIndex];
    const measureTicks = Math.max(
      1,
      signature.numerator * (4 / signature.denominator) * midi.ppq,
    );
    const beatTicks = measureTicks / signature.numerator;
    const nextSignatureTick = signatures[signatureIndex + 1]?.tick;
    let endTick = tick + measureTicks;
    if (nextSignatureTick && nextSignatureTick > tick && nextSignatureTick < endTick) {
      endTick = nextSignatureTick;
    }

    const measure = {
      tick,
      endTick,
      bar,
      numerator: signature.numerator,
      denominator: signature.denominator,
      beatTicks,
      beats: [],
    };

    for (let beat = 1; beat <= signature.numerator; beat += 1) {
      const beatTick = tick + (beat - 1) * beatTicks;
      if (beatTick >= endTick) {
        break;
      }
      measure.beats.push({ tick: beatTick, beat });
    }

    measures.push(measure);
    tick = endTick;
    bar += 1;
  }

  return { measures, initialMeasureTicks };
}

function lastAtOrBefore(items, value, key) {
  let low = 0;
  let high = items.length - 1;
  let found = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (items[middle][key] <= value) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return items[found];
}

export class PianoRoll {
  constructor(canvas, midi, options = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.midi = midi;
    this.time = 0;
    this.onSeek = options.onSeek || null;

    for (const track of midi.tracks) {
      for (const note of track.notes) {
        note.rollStartTick = midi.timeToTick(note.start);
        note.rollEndTick = midi.timeToTick(note.start + note.duration);
      }
    }

    const grid = buildMeasureGrid(midi, midi.endTick);
    this.measures = grid.measures;
    this.initialMeasureTicks = grid.initialMeasureTicks;
    this.durationTicks = Math.max(
      midi.endTick,
      ...midi.tracks.flatMap((track) =>
        track.notes.map((note) => note.rollEndTick),
      ),
      this.initialMeasureTicks * 4,
    );

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
    const tick = this.viewStart + ratio * this.visibleTicks;
    const time = this.midi.tickToTime(
      Math.max(0, Math.min(this.durationTicks, tick)),
    );
    this.onSeek(Math.max(0, Math.min(this.midi.duration, time)));
  }

  setTime(time) {
    this.time = Math.max(0, Math.min(this.midi.duration, time));
    this.render();
  }

  keyWidth() {
    return this.width < 520 ? 38 : 54;
  }

  viewWindow(visibleTicks) {
    const currentTick = this.midi.timeToTick(this.time);
    const maxStart = Math.max(0, this.durationTicks - visibleTicks * 0.92);
    const lead = Math.min(this.initialMeasureTicks * 0.25, visibleTicks * 0.08);
    const target = currentTick - visibleTicks * 0.3;
    const viewStart = Math.min(Math.max(target, -lead), maxStart);
    return { viewStart, viewEnd: viewStart + visibleTicks, currentTick };
  }

  currentPosition(tick) {
    const measure = lastAtOrBefore(this.measures, tick, "tick");
    const beat = Math.max(
      1,
      Math.min(
        measure.numerator,
        Math.floor((tick - measure.tick) / measure.beatTicks) + 1,
      ),
    );
    return { measure, beat };
  }

  render() {
    if (!this.width || !this.height) {
      return;
    }

    const context = this.context;
    const width = this.width;
    const height = this.height;
    const rulerHeight = 26;
    const keyWidth = this.keyWidth();
    const rollTop = rulerHeight;
    const rollHeight = Math.max(1, height - rulerHeight);
    const semitones = Math.max(1, this.highNote - this.lowNote);
    const rowHeight = rollHeight / semitones;

    const barsVisible = width < 520 ? 2 : 4;
    const visibleTicks = this.initialMeasureTicks * barsVisible;
    this.visibleTicks = visibleTicks;
    const pxPerTick = (width - keyWidth) / visibleTicks;
    const { viewStart, viewEnd, currentTick } = this.viewWindow(visibleTicks);
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

    const beatPixelWidth = (this.measures[0]?.beatTicks || this.midi.ppq) * pxPerTick;
    const showBeatLabels = beatPixelWidth >= 34;
    context.textBaseline = "middle";
    context.font = '9px "Courier Prime", "Courier New", monospace';

    for (const measure of this.measures) {
      if (measure.tick > viewEnd) {
        break;
      }
      if (measure.endTick < viewStart) {
        continue;
      }
      const x = keyWidth + (measure.tick - viewStart) * pxPerTick;
      context.strokeStyle = "rgba(216, 161, 58, 0.28)";
      context.beginPath();
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, height);
      context.stroke();

      if (x >= keyWidth - 1 && x <= width) {
        context.fillStyle = "#e0cba0";
        context.font = 'bold 10px "Courier Prime", "Courier New", monospace';
        context.textAlign = "left";
        context.fillText(String(measure.bar), x + 3, rulerHeight / 2);
      }

      for (const beat of measure.beats) {
        if (!beat.beat) {
          continue;
        }
        const beatX = keyWidth + (beat.tick - viewStart) * pxPerTick;
        if (beatX < keyWidth || beatX > width) {
          continue;
        }
        if (beat.beat > 1) {
          context.strokeStyle = "rgba(216, 161, 58, 0.11)";
          context.beginPath();
          context.moveTo(beatX + 0.5, 0);
          context.lineTo(beatX + 0.5, height);
          context.stroke();
        }
        if (showBeatLabels && beat.beat > 1 && beatX >= keyWidth) {
          context.fillStyle = "#8c7d66";
          context.font = '9px "Courier Prime", "Courier New", monospace';
          context.textAlign = "left";
          context.fillText(
            `${measure.bar}.${beat.beat}`,
            beatX + 3,
            rulerHeight - 7,
          );
        }
      }
    }

    context.save();
    context.beginPath();
    context.rect(keyWidth, rollTop, width - keyWidth, rollHeight);
    context.clip();

    this.midi.tracks.forEach((track, trackIndex) => {
      const color = trackColor(trackIndex);
      context.fillStyle = color;
      for (const note of track.notes) {
        if (
          note.rollEndTick < viewStart ||
          note.rollStartTick > viewEnd
        ) {
          continue;
        }
        const x = keyWidth + (note.rollStartTick - viewStart) * pxPerTick;
        const noteWidth = Math.max(
          2,
          (note.rollEndTick - note.rollStartTick) * pxPerTick - 1,
        );
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

    const playheadX = keyWidth + (currentTick - viewStart) * pxPerTick;
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

    const { measure, beat } = this.currentPosition(currentTick);
    const signature = lastAtOrBefore(
      this.midi.timeSignatures,
      currentTick,
      "tick",
    );
    const tempo = lastAtOrBefore(this.midi.tempoMap, currentTick, "tick");
    const info = `${measure.bar}.${beat}  ${tempo.bpm} BPM  ${signature.numerator}/${signature.denominator}`;
    context.font = '9px "Courier Prime", "Courier New", monospace';
    context.textAlign = "right";
    context.textBaseline = "middle";
    const textWidth = context.measureText(info).width;
    context.fillStyle = "rgba(33, 28, 22, 0.92)";
    context.fillRect(width - textWidth - 13, 3, textWidth + 11, rulerHeight - 6);
    context.fillStyle = "#d8a13a";
    context.fillText(info, width - 7, rulerHeight / 2);

    for (const tempoEvent of this.midi.tempoMap) {
      if (tempoEvent.tick <= 0 || tempoEvent.tick < viewStart || tempoEvent.tick > viewEnd) {
        continue;
      }
      const x = keyWidth + (tempoEvent.tick - viewStart) * pxPerTick;
      context.fillStyle = "#d8a13a";
      context.beginPath();
      context.moveTo(x - 3, rulerHeight - 5);
      context.lineTo(x + 3, rulerHeight - 5);
      context.lineTo(x, rulerHeight - 1);
      context.closePath();
      context.fill();
    }
  }

  destroy() {
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
  }
}

