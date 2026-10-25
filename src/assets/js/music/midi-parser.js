const DEFAULT_TEMPO = 500000;

export const GM_INSTRUMENTS = [
  "Acoustic Grand Piano",
  "Bright Acoustic Piano",
  "Electric Grand Piano",
  "Honky-tonk Piano",
  "Electric Piano 1",
  "Electric Piano 2",
  "Harpsichord",
  "Clavinet",
  "Celesta",
  "Glockenspiel",
  "Music Box",
  "Vibraphone",
  "Marimba",
  "Xylophone",
  "Tubular Bells",
  "Dulcimer",
  "Drawbar Organ",
  "Percussive Organ",
  "Rock Organ",
  "Church Organ",
  "Reed Organ",
  "Accordion",
  "Harmonica",
  "Tango Accordion",
  "Acoustic Guitar (nylon)",
  "Acoustic Guitar (steel)",
  "Electric Guitar (jazz)",
  "Electric Guitar (clean)",
  "Electric Guitar (muted)",
  "Overdriven Guitar",
  "Distortion Guitar",
  "Guitar Harmonics",
  "Acoustic Bass",
  "Electric Bass (finger)",
  "Electric Bass (pick)",
  "Fretless Bass",
  "Slap Bass 1",
  "Slap Bass 2",
  "Synth Bass 1",
  "Synth Bass 2",
  "Violin",
  "Viola",
  "Cello",
  "Contrabass",
  "Tremolo Strings",
  "Pizzicato Strings",
  "Orchestral Harp",
  "Timpani",
  "String Ensemble 1",
  "String Ensemble 2",
  "Synth Strings 1",
  "Synth Strings 2",
  "Choir Aahs",
  "Voice Oohs",
  "Synth Choir",
  "Orchestra Hit",
  "Trumpet",
  "Trombone",
  "Tuba",
  "Muted Trumpet",
  "French Horn",
  "Brass Section",
  "Synth Brass 1",
  "Synth Brass 2",
  "Soprano Sax",
  "Alto Sax",
  "Tenor Sax",
  "Baritone Sax",
  "Oboe",
  "English Horn",
  "Bassoon",
  "Clarinet",
  "Piccolo",
  "Flute",
  "Recorder",
  "Pan Flute",
  "Blown Bottle",
  "Shakuhachi",
  "Whistle",
  "Ocarina",
  "Lead 1 (square)",
  "Lead 2 (sawtooth)",
  "Lead 3 (calliope)",
  "Lead 4 (chiff)",
  "Lead 5 (charang)",
  "Lead 6 (voice)",
  "Lead 7 (fifths)",
  "Lead 8 (bass + lead)",
  "Pad 1 (new age)",
  "Pad 2 (warm)",
  "Pad 3 (polysynth)",
  "Pad 4 (choir)",
  "Pad 5 (bowed)",
  "Pad 6 (metallic)",
  "Pad 7 (halo)",
  "Pad 8 (sweep)",
  "FX 1 (rain)",
  "FX 2 (soundtrack)",
  "FX 3 (crystal)",
  "FX 4 (atmosphere)",
  "FX 5 (brightness)",
  "FX 6 (goblins)",
  "FX 7 (echoes)",
  "FX 8 (sci-fi)",
  "Sitar",
  "Banjo",
  "Shamisen",
  "Koto",
  "Kalimba",
  "Bag Pipe",
  "Fiddle",
  "Shanai",
  "Tinkle Bell",
  "Agogo",
  "Steel Drums",
  "Woodblock",
  "Taiko Drum",
  "Melodic Tom",
  "Synth Drum",
  "Reverse Cymbal",
  "Guitar Fret Noise",
  "Breath Noise",
  "Seashore",
  "Bird Tweet",
  "Telephone Ring",
  "Helicopter",
  "Applause",
  "Gunshot",
];

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function noteName(midiNote) {
  const note = Math.max(0, Math.min(127, Math.round(Number(midiNote) || 0)));
  return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}

export function instrumentName(program, channel = 0) {
  if (channel === 9) {
    return "Drum Kit";
  }
  return GM_INSTRUMENTS[Math.max(0, Math.min(127, Math.round(Number(program) || 0)))];
}

function readVarLength(view, state, end) {
  let value = 0;
  let count = 0;
  while (state.offset < end) {
    const byte = view.getUint8(state.offset++);
    value = (value << 7) | (byte & 0x7f);
    count += 1;
    if ((byte & 0x80) === 0) {
      break;
    }
    if (count > 4) {
      throw new Error("Invalid MIDI variable-length value.");
    }
  }
  return value;
}

function readText(view, start, length) {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + start, length);
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/\0/g, "").trim();
  } catch {
    return "";
  }
}

function parseTrack(view, start, end, trackIndex, trackNames) {
  const state = { offset: start };
  let absoluteTick = 0;
  let runningStatus = 0;
  let trackName = "";
  let instrumentLabel = "";
  let lastTick = 0;
  const notes = [];
  const openNotes = new Map();
  const programs = new Map();
  const channels = new Set();
  let primaryProgram = 0;
  let primaryProgramCount = 0;
  const programCounts = new Map();

  const closeNote = (channel, noteNumber, tick) => {
    const key = channel * 128 + noteNumber;
    const stack = openNotes.get(key);
    if (!stack || !stack.length) {
      return;
    }
    const open = stack.shift();
    notes.push({
      startTick: open.startTick,
      endTick: Math.max(tick, open.startTick + 1),
      note: noteNumber,
      velocity: open.velocity,
      channel,
      track: trackIndex,
      program: open.program,
    });
  };

  while (state.offset < end) {
    absoluteTick += readVarLength(view, state, end);
    lastTick = absoluteTick;
    if (state.offset >= end) {
      break;
    }

    let status = view.getUint8(state.offset);
    let needsStatusByte = false;

    if (status & 0x80) {
      state.offset += 1;
      if (status < 0xf0) {
        runningStatus = status;
      } else {
        runningStatus = 0;
      }
    } else {
      status = runningStatus;
      needsStatusByte = true;
      if (!status) {
        throw new Error("MIDI running status without a previous status byte.");
      }
    }

    if (needsStatusByte && status >= 0xf0) {
      throw new Error("MIDI system message used with running status.");
    }

    const messageType = status >> 4;
    const channel = status & 0x0f;

    if (messageType === 0x08) {
      if (state.offset + 2 > end) {
        break;
      }
      const note = view.getUint8(state.offset++);
      state.offset += 1;
      closeNote(channel, note, absoluteTick);
      continue;
    }

    if (messageType === 0x09) {
      if (state.offset + 2 > end) {
        break;
      }
      const note = view.getUint8(state.offset++);
      const velocity = view.getUint8(state.offset++);
      if (velocity === 0) {
        closeNote(channel, note, absoluteTick);
        continue;
      }
      channels.add(channel);
      const key = channel * 128 + note;
      if (!openNotes.has(key)) {
        openNotes.set(key, []);
      }
      const program = programs.get(channel) ?? 0;
      openNotes.get(key).push({
        startTick: absoluteTick,
        velocity,
        program,
      });
      continue;
    }

    if (messageType === 0x0a) {
      state.offset += 2;
      continue;
    }

    if (messageType === 0x0b) {
      state.offset += 2;
      continue;
    }

    if (messageType === 0x0c) {
      if (state.offset >= end) {
        break;
      }
      const program = view.getUint8(state.offset++);
      programs.set(channel, program);
      programCounts.set(program, (programCounts.get(program) || 0) + 1);
      if ((programCounts.get(program) || 0) > primaryProgramCount) {
        primaryProgram = program;
        primaryProgramCount = programCounts.get(program);
      }
      continue;
    }

    if (messageType === 0x0d) {
      state.offset += 1;
      continue;
    }

    if (messageType === 0x0e) {
      state.offset += 2;
      continue;
    }

    if (status === 0xff) {
      if (state.offset >= end) {
        break;
      }
      const metaType = view.getUint8(state.offset++);
      const length = readVarLength(view, state, end);
      const payloadStart = state.offset;
      const payloadEnd = Math.min(end, payloadStart + length);

      if (metaType === 0x03) {
        trackName = readText(view, payloadStart, payloadEnd - payloadStart) || trackName;
      } else if (metaType === 0x04) {
        instrumentLabel =
          readText(view, payloadStart, payloadEnd - payloadStart) || instrumentLabel;
      } else if (metaType === 0x51 && length === 3) {
        const tempo =
          (view.getUint8(payloadStart) << 16) |
          (view.getUint8(payloadStart + 1) << 8) |
          view.getUint8(payloadStart + 2);
        trackNames.tempos.push({ tick: absoluteTick, usPerQuarter: tempo });
      } else if (metaType === 0x58 && length >= 2) {
        trackNames.timeSignatures.push({
          tick: absoluteTick,
          numerator: view.getUint8(payloadStart),
          denominator: 2 ** view.getUint8(payloadStart + 1),
        });
      } else if (metaType === 0x2f) {
        state.offset = payloadEnd;
        break;
      }

      state.offset = payloadEnd;
      runningStatus = 0;
      continue;
    }

    if (status === 0xf0 || status === 0xf7) {
      const length = readVarLength(view, state, end);
      state.offset = Math.min(end, state.offset + length);
      runningStatus = 0;
      continue;
    }

    if (status === 0xf1 || status === 0xf3) {
      state.offset += 1;
      continue;
    }

    if (status === 0xf2) {
      state.offset += 2;
      continue;
    }

    if (status === 0xf6 || status === 0xf8 || status === 0xf9 || status === 0xfa || status === 0xfb || status === 0xfc || status === 0xfe) {
      continue;
    }

    throw new Error(`Unsupported MIDI status byte 0x${status.toString(16)}.`);
  }

  for (const [key, stack] of openNotes) {
    if (!stack.length) {
      continue;
    }
    const note = key % 128;
    const channel = Math.floor(key / 128);
    for (const open of stack) {
      notes.push({
        startTick: open.startTick,
        endTick: Math.max(lastTick, open.startTick + 1),
        note,
        velocity: open.velocity,
        channel,
        track: trackIndex,
        program: open.program,
      });
    }
  }

  notes.sort((a, b) => a.startTick - b.startTick || a.note - b.note);
  trackNames.tracks.push({
    index: trackIndex,
    name: trackName,
    instrumentLabel,
    primaryProgram,
    hasProgramChanges: programCounts.size > 0,
    channels: [...channels].sort((a, b) => a - b),
    notes,
  });
}

export function parseMidi(arrayBuffer) {
  const view = arrayBuffer instanceof DataView ? arrayBuffer : new DataView(arrayBuffer);
  if (view.byteLength < 14) {
    throw new Error("This file is too small to be a MIDI file.");
  }

  const headerId = readText(view, 0, 4);
  if (headerId !== "MThd") {
    throw new Error("Missing MIDI header.");
  }

  const headerLength = view.getUint32(4);
  const format = view.getUint16(8);
  const declaredTracks = view.getUint16(10);
  const division = view.getUint16(12);
  let offset = 8 + headerLength;
  const smpte = (division & 0x8000) !== 0;
  let ticksPerQuarter = division & 0x7fff;
  let ticksPerSecond = 0;

  if (smpte) {
    const frames = 0x100 - (division >> 8);
    const ticksPerFrame = division & 0xff;
    const fps = frames === 29 ? 29.97 : frames;
    ticksPerSecond = fps * ticksPerFrame;
  }

  if (!smpte && ticksPerQuarter === 0) {
    throw new Error("MIDI time division is invalid.");
  }

  const aggregate = { tempos: [], timeSignatures: [], tracks: [] };
  let trackIndex = 0;

  while (offset + 8 <= view.byteLength) {
    const chunkId = readText(view, offset, 4);
    const chunkLength = view.getUint32(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;

    if (chunkEnd > view.byteLength) {
      break;
    }

    if (chunkId === "MTrk") {
      parseTrack(view, chunkStart, chunkEnd, trackIndex, aggregate);
      trackIndex += 1;
    }
    offset = chunkEnd;
  }

  if (!aggregate.tracks.length) {
    throw new Error("No MIDI tracks were found.");
  }

  const tempoEvents = aggregate.tempos
    .filter((event) => Number.isFinite(event.usPerQuarter) && event.usPerQuarter > 0)
    .sort((a, b) => a.tick - b.tick);
  const segments = [{ tick: 0, usPerQuarter: DEFAULT_TEMPO, time: 0 }];

  if (!smpte) {
    for (const event of tempoEvents) {
      const previous = segments[segments.length - 1];
      if (event.tick === previous.tick) {
        previous.usPerQuarter = event.usPerQuarter;
        continue;
      }
      const elapsed =
        ((event.tick - previous.tick) * previous.usPerQuarter) /
        (ticksPerQuarter * 1_000_000);
      segments.push({
        tick: event.tick,
        usPerQuarter: event.usPerQuarter,
        time: previous.time + elapsed,
      });
    }
  }

  const tickToTime = (tick) => {
    if (smpte) {
      return tick / ticksPerSecond;
    }
    let low = 0;
    let high = segments.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (segments[middle].tick <= tick) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    const segment = segments[low];
    return (
      segment.time +
      ((tick - segment.tick) * segment.usPerQuarter) /
        (ticksPerQuarter * 1_000_000)
    );
  };

  const timeToTick = (time) => {
    if (smpte) {
      return Math.max(0, time) * ticksPerSecond;
    }
    if (segments.length === 1) {
      return (Math.max(0, time) * ticksPerQuarter * 1_000_000) / segments[0].usPerQuarter;
    }
    let low = 0;
    let high = segments.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (segments[middle].time <= time) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    const segment = segments[low];
    return (
      segment.tick +
      ((time - segment.time) * ticksPerQuarter * 1_000_000) /
        segment.usPerQuarter
    );
  };

  const tracks = aggregate.tracks
    .filter((track) => track.notes.length)
    .map((track) => {
      const notes = track.notes.map((note) => ({
        note: note.note,
        velocity: note.velocity,
        channel: note.channel,
        program: note.program,
        startTick: note.startTick,
        endTick: note.endTick,
        durationTicks: note.endTick - note.startTick,
        start: tickToTime(note.startTick),
        duration: Math.max(0.015, tickToTime(note.endTick) - tickToTime(note.startTick)),
      }));
      const channel = track.channels[0] ?? 0;
      const program = track.primaryProgram || notes[0]?.program || 0;
      const name =
        track.name ||
        track.instrumentLabel ||
        instrumentName(program, channel) ||
        `Track ${track.index + 1}`;
      return {
        index: track.index,
        name,
        channel,
        program,
        hasProgramChanges: track.hasProgramChanges,
        notes,
      };
    });

  const notes = tracks.flatMap((track) => track.notes);
  if (!notes.length) {
    throw new Error("This MIDI file does not contain any notes.");
  }

  let minNote = 127;
  let maxNote = 0;
  let endTime = 0;
  let endTick = 0;
  for (const note of notes) {
    minNote = Math.min(minNote, note.note);
    maxNote = Math.max(maxNote, note.note);
    endTime = Math.max(endTime, note.start + note.duration);
    endTick = Math.max(endTick, note.startTick + note.durationTicks);
  }

  const duration = endTime + 0.35;
  const initialTempo = tempoEvents.length
    ? tempoEvents.filter((event) => event.tick === 0).at(-1)?.usPerQuarter ??
      tempoEvents[0].usPerQuarter
    : DEFAULT_TEMPO;

  const timeSignatures = aggregate.timeSignatures
    .filter(
      (event) =>
        Number.isFinite(event.tick) &&
        event.numerator > 0 &&
        event.denominator > 0,
    )
    .sort((a, b) => a.tick - b.tick)
    .filter((event, index, all) => index === 0 || event.tick !== all[index - 1].tick);
  if (!timeSignatures.length || timeSignatures[0].tick > 0) {
    timeSignatures.unshift({ tick: 0, numerator: 4, denominator: 4 });
  }
  const initialTimeSignature = timeSignatures[0];

  const tempoMap = segments.map((segment) => ({
    tick: segment.tick,
    time: segment.time,
    usPerQuarter: segment.usPerQuarter,
    bpm: Math.round(60_000_000 / segment.usPerQuarter),
  }));

  return {
    format,
    declaredTracks,
    ppq: ticksPerQuarter,
    smpte,
    duration,
    endTick,
    bpm: Math.round(60_000_000 / initialTempo),
    timeSignature: {
      numerator: initialTimeSignature.numerator,
      denominator: initialTimeSignature.denominator,
    },
    timeSignatures,
    tempoMap,
    tickToTime,
    timeToTick,
    tracks,
    notes,
    noteCount: notes.length,
    minNote,
    maxNote,
  };
}
