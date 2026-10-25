const WORKLET_URL = new URL(
  "../../vendor/spessasynth/spessasynth_processor.min.js",
  import.meta.url,
);
const SOUNDFONT_URL = new URL(
  "../../soundfonts/generaluser-gs.sf2?v=1",
  import.meta.url,
);
const CACHE_NAME = "lfies-generaluser-v1";

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

async function loadSoundfontBuffer() {
  if ("caches" in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      let response = await cache.match(SOUNDFONT_URL.href);
      if (!response) {
        response = await fetch(SOUNDFONT_URL.href);
        if (!response.ok) {
          throw new Error(`SoundFont request failed with status ${response.status}.`);
        }
        await cache.put(SOUNDFONT_URL.href, response.clone());
      }
      return response.arrayBuffer();
    } catch (error) {
      console.warn("SoundFont cache unavailable, loading directly.", error);
    }
  }
  const response = await fetch(SOUNDFONT_URL.href);
  if (!response.ok) {
    throw new Error(`SoundFont request failed with status ${response.status}.`);
  }
  return response.arrayBuffer();
}

export class SoundfontSynth {
  constructor(context, synth, output, limiter) {
    this.context = context;
    this.synth = synth;
    this.output = output;
    this.limiter = limiter;
    this.channelPrograms = new Map();
  }

  static async create(context) {
    if (!context.audioWorklet) {
      throw new Error("AudioWorklet is not supported.");
    }

    const [{ WorkletSynthesizer }, soundfont] = await Promise.all([
      import("../../vendor/spessasynth/index.js"),
      loadSoundfontBuffer(),
      context.audioWorklet.addModule(WORKLET_URL.href),
    ]);

    const synth = new WorkletSynthesizer(context);
    await synth.soundBankManager.addSoundBank(soundfont, "generaluser");
    await synth.isReady;
    synth.setSystemParameter("gain", 1);

    const output = context.createGain();
    output.gain.value = 1;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 18;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;

    synth.connect(output);
    output.connect(limiter);
    limiter.connect(context.destination);

    return new SoundfontSynth(context, synth, output, limiter);
  }

  setVolume(value) {
    const volume = clamp(Number(value) || 0, 0, 1);
    const now = this.context.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setTargetAtTime(clamp(volume * 2.4, 0, 2.8), now, 0.025);
  }

  scheduleNote(note, when, _pan = 0) {
    const time = Math.max(when, this.context.currentTime + 0.004);
    const channel = note.channel & 0x0f;

    if (channel !== 9) {
      const program = note.program & 0x7f;
      if (this.channelPrograms.get(channel) !== program) {
        this.synth.programChange(channel, program, { time });
        this.channelPrograms.set(channel, program);
      }
    }

    this.synth.noteOn(channel, note.note, note.velocity, { time });
    this.synth.noteOff(channel, note.note, {
      time: time + Math.max(0.02, note.duration),
    });
  }

  stopAll() {
    this.synth.stopAll(true);
    this.channelPrograms.clear();
  }

  destroy() {
    try {
      this.synth.stopAll(true);
      this.synth.disconnect();
    } catch {
      return;
    }
    this.output.disconnect();
    this.limiter.disconnect();
  }
}
