import { useCallback, useRef } from "react";

interface ZazenAudio {
  playBell: () => void;
  playChime: () => void;
  playStoneDrop: () => void;
}

const CHIME_FREQ = 659.25;
const CHIME_PEAK_GAIN = 0.15;
const CHIME_ATTACK_S = 0.02;
const CHIME_RELEASE_S = 0.22;
const CHIME_STOP_S = 0.23;

// A stone leaving your hand. The chime is a reward and the bell is an ending, so this
// had to be neither: a low knock with no pitch to speak of, plus a short hiss of sand
// displaced around it. It is the only sound in the garden that costs you something, and
// it should land in the chest rather than the ear.
const DROP_THUD_FROM = 190;
const DROP_THUD_TO = 58;
const DROP_THUD_GAIN = 0.22;
const DROP_THUD_S = 0.26;
const DROP_SAND_S = 0.19;
const DROP_SAND_GAIN = 0.055;
const DROP_SAND_HIGHPASS = 1400;

const BELL_LOWPASS_FREQ = 2000;
const BELL_DURATION_S = 1.5;
const BELL_STOP_PADDING_S = 0.1;
const BELL_FUNDAMENTAL = 220;
const BELL_OVERTONE = 880;
const BELL_BODY = 660;
const BELL_PEAK_FUNDAMENTAL = 0.25;
const BELL_PEAK_OVERTONE = 0.12;
const BELL_PEAK_BODY = 0.08;
const BELL_ATTACK_S = 0.05;
const BELL_FLOOR = 0.001;

type AudioCtor = typeof AudioContext;

interface AudioGlobal {
  AudioContext?: AudioCtor;
  webkitAudioContext?: AudioCtor;
}

const getAudioContextCtor = (): AudioCtor | null => {
  const scope = globalThis as unknown as AudioGlobal;
  const ctor = scope.AudioContext ?? scope.webkitAudioContext;
  if (typeof ctor !== "function") {
    return null;
  }
  return ctor;
};

const useZazenAudio = (): ZazenAudio => {
  const ctxRef = useRef<AudioContext | null>(null);

  const ensureContext = useCallback((): AudioContext | null => {
    if (ctxRef.current) {
      if (ctxRef.current.state === "suspended") {
        void ctxRef.current.resume();
      }
      return ctxRef.current;
    }
    const Ctor = getAudioContextCtor();
    if (!Ctor) {
      return null;
    }
    try {
      ctxRef.current = new Ctor();
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);

  const playChime = useCallback(() => {
    const ctx = ensureContext();
    if (!ctx) {
      return;
    }
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(CHIME_FREQ, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(CHIME_PEAK_GAIN, now + CHIME_ATTACK_S);
      gain.gain.linearRampToValueAtTime(0, now + CHIME_RELEASE_S);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + CHIME_STOP_S);
    } catch {
      /* swallow */
    }
  }, [ensureContext]);

  const playBell = useCallback(() => {
    const ctx = ensureContext();
    if (!ctx) {
      return;
    }
    try {
      const now = ctx.currentTime;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.setValueAtTime(BELL_LOWPASS_FREQ, now);
      lowpass.connect(ctx.destination);

      const makeTone = (frequency: number, peak: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, now);
        gain.gain.setValueAtTime(BELL_FLOOR, now);
        gain.gain.linearRampToValueAtTime(peak, now + BELL_ATTACK_S);
        gain.gain.exponentialRampToValueAtTime(BELL_FLOOR, now + BELL_DURATION_S);
        osc.connect(gain).connect(lowpass);
        osc.start(now);
        osc.stop(now + BELL_DURATION_S + BELL_STOP_PADDING_S);
      };

      makeTone(BELL_FUNDAMENTAL, BELL_PEAK_FUNDAMENTAL);
      makeTone(BELL_OVERTONE, BELL_PEAK_OVERTONE);
      makeTone(BELL_BODY, BELL_PEAK_BODY);
    } catch {
      /* swallow */
    }
  }, [ensureContext]);

  const playStoneDrop = useCallback(() => {
    const ctx = ensureContext();
    if (!ctx) {
      return;
    }
    try {
      const now = ctx.currentTime;

      // The knock. A sine swept hard downward reads as mass hitting ground — holding one
      // frequency reads as a note, and a note is a reward.
      const thud = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thud.type = "sine";
      thud.frequency.setValueAtTime(DROP_THUD_FROM, now);
      thud.frequency.exponentialRampToValueAtTime(DROP_THUD_TO, now + DROP_THUD_S);
      thudGain.gain.setValueAtTime(DROP_THUD_GAIN, now);
      thudGain.gain.exponentialRampToValueAtTime(BELL_FLOOR, now + DROP_THUD_S);
      thud.connect(thudGain).connect(ctx.destination);
      thud.start(now);
      thud.stop(now + DROP_THUD_S + BELL_STOP_PADDING_S);

      // The sand. White noise through a highpass, gone almost before you hear it.
      const frames = Math.floor(ctx.sampleRate * DROP_SAND_S);
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let index = 0; index < frames; index += 1) {
        channel[index] = (Math.random() * 2 - 1) * (1 - index / frames);
      }
      const sand = ctx.createBufferSource();
      sand.buffer = buffer;
      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.setValueAtTime(DROP_SAND_HIGHPASS, now);
      const sandGain = ctx.createGain();
      sandGain.gain.setValueAtTime(DROP_SAND_GAIN, now);
      sandGain.gain.exponentialRampToValueAtTime(BELL_FLOOR, now + DROP_SAND_S);
      sand.connect(highpass).connect(sandGain).connect(ctx.destination);
      sand.start(now);
    } catch {
      /* swallow */
    }
  }, [ensureContext]);

  return { playBell, playChime, playStoneDrop };
};

export default useZazenAudio;
export type { ZazenAudio };
