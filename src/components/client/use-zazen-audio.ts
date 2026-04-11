import { useCallback, useRef } from "react";

interface ZazenAudio {
  playBell: () => void;
  playChime: () => void;
}

const CHIME_FREQ = 659.25;
const CHIME_PEAK_GAIN = 0.15;
const CHIME_ATTACK_S = 0.02;
const CHIME_RELEASE_S = 0.22;
const CHIME_STOP_S = 0.23;

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

  return { playBell, playChime };
};

export default useZazenAudio;
export type { ZazenAudio };
