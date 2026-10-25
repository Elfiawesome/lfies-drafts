const PROGRAM_RULES = [
  [/piccolo/i, 72],
  [/flute/i, 73],
  [/recorder/i, 74],
  [/clarinet|\bclar\b/i, 71],
  [/bassoon|basson|fagott/i, 70],
  [/oboe/i, 68],
  [/sax/i, 65],
  [/trumpet|\btpt\b/i, 56],
  [/trombone/i, 57],
  [/tuba/i, 58],
  [/french horn|\bhorn\b/i, 60],
  [/brass/i, 61],
  [/violin/i, 40],
  [/viola/i, 41],
  [/cello/i, 42],
  [/contrabass|double bass/i, 43],
  [/strings|string/i, 48],
  [/harp/i, 46],
  [/timpani/i, 47],
  [/guitar/i, 25],
  [/bass/i, 32],
  [/organ/i, 16],
  [/choir|vocal|vox|voice/i, 53],
  [/bell/i, 14],
  [/marimba/i, 12],
  [/glockenspiel/i, 9],
  [/xylophone/i, 11],
  [/vibraphone/i, 11],
  [/pad/i, 89],
  [/lead/i, 80],
  [/synth/i, 80],
  [/piano|keys/i, 0],
];

export function inferProgram(trackName, fallback = 0) {
  const name = String(trackName || "");
  for (const [pattern, program] of PROGRAM_RULES) {
    if (pattern.test(name)) {
      return program;
    }
  }
  return fallback;
}
