const SPECS = [
  { max: 7, waves: [["triangle", 1, 0.72, 0], ["sine", 2, 0.16, 0]], attack: 0.006, decay: 0.55, sustain: 0.18, release: 0.22, cutoff: 4800, send: 0.1, level: 1 },
  { max: 15, waves: [["triangle", 1, 0.7, 0], ["sine", 4, 0.1, 0]], attack: 0.005, decay: 0.4, sustain: 0.12, release: 0.2, cutoff: 6200, send: 0.08, level: 0.95 },
  { max: 23, waves: [["sine", 1, 0.6, 0], ["sine", 2, 0.24, 0], ["sine", 3, 0.1, 0]], attack: 0.03, decay: 0.2, sustain: 0.66, release: 0.12, cutoff: 5600, send: 0.08, level: 0.9 },
  { max: 31, waves: [["sawtooth", 1, 0.5, -3], ["triangle", 1, 0.35, 3]], attack: 0.004, decay: 0.35, sustain: 0.1, release: 0.14, cutoff: 3200, send: 0.09, level: 0.9 },
  { max: 39, waves: [["square", 1, 0.32, 0], ["sine", 0.5, 0.7, 0]], attack: 0.006, decay: 0.3, sustain: 0.22, release: 0.14, cutoff: 1000, send: 0.03, level: 1.15 },
  { max: 47, waves: [["sawtooth", 1, 0.4, -5], ["sawtooth", 1, 0.4, 5]], attack: 0.11, decay: 0.25, sustain: 0.52, release: 0.5, cutoff: 2700, send: 0.18, level: 0.72 },
  { max: 55, waves: [["sawtooth", 1, 0.36, -4], ["triangle", 1, 0.35, 4]], attack: 0.08, decay: 0.2, sustain: 0.5, release: 0.35, cutoff: 3200, send: 0.16, level: 0.75 },
  { max: 63, waves: [["sawtooth", 1, 0.42, 0], ["square", 1, 0.22, 0]], attack: 0.045, decay: 0.16, sustain: 0.48, release: 0.22, cutoff: 3400, send: 0.1, level: 0.82 },
  { max: 71, waves: [["square", 1, 0.34, 0], ["sine", 2, 0.26, 0]], attack: 0.03, decay: 0.18, sustain: 0.45, release: 0.2, cutoff: 3000, send: 0.1, level: 0.8 },
  { max: 79, waves: [["sine", 1, 0.65, 0], ["triangle", 2, 0.16, 4]], attack: 0.045, decay: 0.2, sustain: 0.5, release: 0.28, cutoff: 6000, send: 0.14, level: 0.8 },
  { max: 87, waves: [["square", 1, 0.36, -3], ["sawtooth", 1, 0.28, 3]], attack: 0.008, decay: 0.16, sustain: 0.4, release: 0.16, cutoff: 5200, send: 0.1, level: 0.8 },
  { max: 95, waves: [["sawtooth", 1, 0.32, -6], ["sawtooth", 1, 0.32, 6]], attack: 0.24, decay: 0.3, sustain: 0.62, release: 0.85, cutoff: 2100, send: 0.24, level: 0.62 },
  { max: 103, waves: [["sine", 1, 0.6, 0], ["triangle", 3, 0.18, 0]], attack: 0.06, decay: 0.3, sustain: 0.4, release: 0.4, cutoff: 4600, send: 0.2, level: 0.72 },
  { max: 111, waves: [["triangle", 1, 0.62, 0], ["sine", 2, 0.22, 0]], attack: 0.006, decay: 0.35, sustain: 0.14, release: 0.18, cutoff: 5000, send: 0.1, level: 0.85 },
  { max: 119, waves: [["triangle", 1, 0.7, 0]], attack: 0.003, decay: 0.22, sustain: 0.05, release: 0.12, cutoff: 4000, send: 0.06, level: 0.9 },
  { max: 127, waves: [["sine", 1, 0.5, 0], ["square", 3, 0.12, 0]], attack: 0.01, decay: 0.25, sustain: 0.2, release: 0.2, cutoff: 4200, send: 0.18, level: 0.7 },
];

function specFor(program) {
  return SPECS.find((spec) => program <= spec.max) || SPECS[SPECS.length - 1];
}

function midiToFrequency(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function makeNoiseBuffer(context) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

export class MidiSynth {
  constructor(context) {
    this.context = context;
    this.voices = new Set();
    this.noiseBuffer = makeNoiseBuffer(context);

    this.master = context.createGain();
    this.master.gain.value = 0.7;

    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 22;
    this.compressor.ratio.value = 7;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.24;

    this.dry = context.createGain();
    this.dry.gain.value = 0.92;
    this.dry.connect(this.compressor);

    this.send = context.createGain();
    this.send.gain.value = 1;
    this.delay = context.createDelay(1);
    this.delay.delayTime.value = 0.27;
    this.feedback = context.createGain();
    this.feedback.gain.value = 0.22;
    this.delayFilter = context.createBiquadFilter();
    this.delayFilter.type = "lowpass";
    this.delayFilter.frequency.value = 1900;
    this.wet = context.createGain();
    this.wet.gain.value = 0.55;

    this.send.connect(this.delay);
    this.delay.connect(this.delayFilter);
    this.delayFilter.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.delayFilter.connect(this.wet);
    this.wet.connect(this.compressor);

    this.compressor.connect(this.master);
    this.master.connect(context.destination);
  }

  setVolume(value) {
    const volume = Math.max(0, Math.min(1, Number(value)));
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(volume ** 1.3, now, 0.02);
  }

  register(nodes, output, endTime) {
    const voice = {
      nodes,
      output,
      stopped: false,
      stop: (fade = 0.035) => {
        if (voice.stopped) {
          return;
        }
        voice.stopped = true;
        const now = this.context.currentTime;
        try {
          if (output.gain.cancelAndHoldAtTime) {
            output.gain.cancelAndHoldAtTime(now);
          } else {
            output.gain.cancelScheduledValues(now);
          }
          output.gain.setTargetAtTime(0.0001, now, fade / 3);
        } catch {
          output.gain.value = 0;
        }
        for (const node of nodes) {
          try {
            node.stop(now + fade);
          } catch {
            continue;
          }
        }
        this.voices.delete(voice);
      },
    };
    this.voices.add(voice);
    const delay = Math.max(0, (endTime - this.context.currentTime + 0.3) * 1000);
    window.setTimeout(() => {
      this.voices.delete(voice);
    }, delay);
    return voice;
  }

  scheduleNote(note, when, trackPan = 0) {
    const context = this.context;
    const start = Math.max(when, context.currentTime + 0.006);
    const frequency = midiToFrequency(note.note);
    const peak = (0.115 * Math.max(0.08, note.velocity / 127)) ** 1.1;
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-0.8, Math.min(0.8, trackPan));

    if (note.channel === 9) {
      this.scheduleDrum(note, start, peak, panner);
      return;
    }

    const spec = specFor(note.program);
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = Math.min(18000, spec.cutoff * (0.75 + note.velocity / 220));
    filter.Q.value = spec.max >= 88 && spec.max <= 95 ? 0.8 : 0.35;

    const envelope = context.createGain();
    const noteEnd = start + Math.max(0.02, note.duration);
    const attackEnd = Math.min(start + spec.attack, noteEnd);
    const decayEnd = Math.min(attackEnd + spec.decay, noteEnd);
    const sustainLevel = Math.max(0.0001, peak * spec.sustain);
    const gain = envelope.gain;

    gain.setValueAtTime(0.0001, start);
    gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), attackEnd);
    gain.exponentialRampToValueAtTime(sustainLevel, decayEnd);
    if (noteEnd > decayEnd) {
      gain.setValueAtTime(sustainLevel, noteEnd);
    }
    gain.exponentialRampToValueAtTime(0.0001, noteEnd + spec.release);

    const sendGain = context.createGain();
    sendGain.gain.value = spec.send;
    filter.connect(envelope);
    envelope.connect(panner);
    panner.connect(this.dry);
    panner.connect(sendGain);
    sendGain.connect(this.send);

    const oscillators = [];
    const proportionalLevel = (spec.level || 1) / Math.sqrt(Math.max(1, spec.waves.length));

    for (const [type, ratio, waveGain, detune] of spec.waves) {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.frequency.value = frequency * ratio;
      oscillator.detune.value = detune + (Math.random() * 2 - 1) * 1.5;
      const level = context.createGain();
      level.gain.value = waveGain * proportionalLevel;
      oscillator.connect(level);
      level.connect(filter);
      oscillator.start(start);
      oscillator.stop(noteEnd + spec.release + 0.06);
      oscillators.push(oscillator);
    }

    this.register(oscillators, envelope, noteEnd + spec.release);
  }

  scheduleDrum(note, start, peak, panner) {
    const context = this.context;
    const noteNumber = note.note % 128;
    let source;
    let filter;
    let envelope;
    let end;

    if ([35, 36].includes(noteNumber)) {
      source = context.createOscillator();
      source.type = "sine";
      source.frequency.setValueAtTime(145, start);
      source.frequency.exponentialRampToValueAtTime(46, start + 0.13);
      envelope = context.createGain();
      envelope.gain.setValueAtTime(Math.max(0.0001, peak * 2.5), start);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      source.connect(envelope);
      envelope.connect(panner);
      end = start + 0.3;
    } else if ([38, 40, 39].includes(noteNumber)) {
      source = context.createBufferSource();
      source.buffer = this.noiseBuffer;
      filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = noteNumber === 39 ? 1500 : 2100;
      filter.Q.value = 0.8;
      envelope = context.createGain();
      envelope.gain.setValueAtTime(Math.max(0.0001, peak * 1.9), start);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + (noteNumber === 39 ? 0.17 : 0.23));
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(panner);
      end = start + 0.25;
    } else if ([42, 44, 46].includes(noteNumber)) {
      source = context.createBufferSource();
      source.buffer = this.noiseBuffer;
      filter = context.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = noteNumber === 46 ? 5200 : 7600;
      envelope = context.createGain();
      const decay = noteNumber === 46 ? 0.32 : noteNumber === 44 ? 0.12 : 0.055;
      envelope.gain.setValueAtTime(Math.max(0.0001, peak * 1.4), start);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + decay);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(panner);
      end = start + decay + 0.03;
    } else if ([49, 57, 55].includes(noteNumber)) {
      source = context.createBufferSource();
      source.buffer = this.noiseBuffer;
      filter = context.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 4300;
      envelope = context.createGain();
      envelope.gain.setValueAtTime(Math.max(0.0001, peak * 1.5), start);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(panner);
      end = start + 1;
    } else if ([51, 59].includes(noteNumber)) {
      source = context.createBufferSource();
      source.buffer = this.noiseBuffer;
      filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 6400;
      envelope = context.createGain();
      envelope.gain.setValueAtTime(Math.max(0.0001, peak), start);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(panner);
      end = start + 0.45;
    } else if ([41, 43, 45, 47, 48, 50].includes(noteNumber)) {
      source = context.createOscillator();
      source.type = "sine";
      const base = 90 + (noteNumber % 12) * 12;
      source.frequency.setValueAtTime(base * 1.7, start);
      source.frequency.exponentialRampToValueAtTime(base, start + 0.18);
      envelope = context.createGain();
      envelope.gain.setValueAtTime(Math.max(0.0001, peak * 1.5), start);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      source.connect(envelope);
      envelope.connect(panner);
      end = start + 0.3;
    } else {
      source = context.createBufferSource();
      source.buffer = this.noiseBuffer;
      filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1500 + (noteNumber % 24) * 160;
      filter.Q.value = 1.2;
      envelope = context.createGain();
      envelope.gain.setValueAtTime(Math.max(0.0001, peak), start);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(panner);
      end = start + 0.2;
    }

    source.start(start);
    source.stop(end);
    this.register([source], envelope, end);
  }

  stopAll() {
    for (const voice of [...this.voices]) {
      voice.stop(0.03);
    }
  }
}

