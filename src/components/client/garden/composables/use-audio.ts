import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ZazenAudio {
  stopEffects: () => void;
  playAttack: () => void;
  playReveal: () => void;
  playVictory: () => void;
  playChime: () => void;
  playStoneDrop: () => void;
}

const CHIME_FREQ = 659.25;
const CHIME_PEAK_GAIN = 0.15;
const CHIME_ATTACK_S = 0.02;
const CHIME_RELEASE_S = 0.22;
const CHIME_STOP_S = 0.23;

// A stone leaving your hand. The chime is a reward and the bowl is an ending, so this
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

const DROP_STOP_PADDING_S = 0.1;
const GAIN_FLOOR = 0.001;

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

const useZazenAudio = (enabled = true): ZazenAudio => {
  const [activated, setActivated] = useState(enabled);
  if (enabled && !activated) setActivated(true);
  const samples = useRef<Partial<Record<"attack" | "reveal" | "victory", AudioBuffer>>>({});
  const playing = useRef(new Set<AudioBufferSourceNode>());
  const ctxRef = useRef<AudioContext | null>(null);
  const stopEffects = useCallback(() => {
    playing.current.forEach((source) => source.stop());
    playing.current.clear();
  }, []);

  const ensureContext = useCallback((): AudioContext | null => {
    if (ctxRef.current) {
      if (ctxRef.current.state === "suspended") {
        void ctxRef.current.resume().catch(() => {});
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

  useEffect(() => {
    if (!activated) return;
    const ctx = ensureContext();
    if (!ctx) return;
    const controller = new AbortController();
    for (const [kind, file] of [
      ["attack", "gardener-hit"],
      ["reveal", "card-reveal"],
      ["victory", "gate-bowl"],
    ] as const) {
      void fetch(`/sounds/garden/${file}.mp3`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error("Sound unavailable");
          return response.arrayBuffer();
        })
        .then((bytes) => ctx.decodeAudioData(bytes))
        .then((buffer) => {
          if (!controller.signal.aborted) samples.current[kind] = buffer;
        })
        .catch(() => {
          /* A missing sound must never interrupt play. */
        });
    }
    const unlock = () => {
      void ctx.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      controller.abort();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      stopEffects();
      samples.current = {};
      void ctx.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [activated, ensureContext, stopEffects]);

  useEffect(() => {
    if (!enabled) {
      stopEffects();
    }
  }, [enabled, stopEffects]);

  const playSample = useCallback(
    (kind: "attack" | "reveal" | "victory", delay = 0) => {
      const ctx = ctxRef.current;
      const buffer = samples.current[kind];
      // Never queue a late sound if the browser has not unlocked audio yet.
      if (!enabled || !ctx || ctx.state !== "running" || !buffer) return;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = kind === "attack" ? 0.55 : kind === "victory" ? 0.3 : 0.45;
      source.connect(gain).connect(ctx.destination);
      playing.current.add(source);
      source.onended = () => {
        playing.current.delete(source);
        source.disconnect();
        gain.disconnect();
      };
      source.start(ctx.currentTime + delay);
    },
    [enabled],
  );
  const playAttack = useCallback(() => playSample("attack", 0.36), [playSample]);
  const playReveal = useCallback(() => playSample("reveal"), [playSample]);

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

  const playVictory = useCallback(() => playSample("victory"), [playSample]);

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
      thudGain.gain.exponentialRampToValueAtTime(GAIN_FLOOR, now + DROP_THUD_S);
      thud.connect(thudGain).connect(ctx.destination);
      thud.start(now);
      thud.stop(now + DROP_THUD_S + DROP_STOP_PADDING_S);

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
      sandGain.gain.exponentialRampToValueAtTime(GAIN_FLOOR, now + DROP_SAND_S);
      sand.connect(highpass).connect(sandGain).connect(ctx.destination);
      sand.start(now);
    } catch {
      /* swallow */
    }
  }, [ensureContext]);

  return useMemo(
    () => ({ stopEffects, playVictory, playChime, playStoneDrop, playAttack, playReveal }),
    [stopEffects, playVictory, playChime, playStoneDrop, playAttack, playReveal],
  );
};

export default useZazenAudio;
export type { ZazenAudio };
