import { useCallback, useEffect, useRef, useState } from "react";

export default function useGardenMusic() {
  // Each visit starts silent; enabling playback requires the button gesture.
  const [musicOn, setMusicOn] = useState(false);
  const enabled = useRef(musicOn);
  const music = useRef<HTMLAudioElement | null>(null);
  const interacted = useRef(false);

  const start = useCallback(() => {
    const track = music.current;
    if (!enabled.current || !track || document.hidden || !interacted.current) return;
    void track.play().catch(() => {
      /* Retry on the next interaction if autoplay is blocked. */
    });
  }, []);

  useEffect(() => {
    const track = new Audio("/sounds/garden/zen-garden.mp3");
    track.loop = true;
    // The file is already mixed quietly: iOS ignores HTMLMediaElement.volume.
    track.volume = 1;
    track.preload = "none";
    music.current = track;
    const unlock = () => {
      interacted.current = true;
      if (track.paused) start();
    };
    const visibility = () => {
      if (document.hidden) track.pause();
      else start();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", visibility);
      track.pause();
      track.removeAttribute("src");
      track.load();
      music.current = null;
    };
  }, [start]);

  useEffect(() => {
    enabled.current = musicOn;
    if (!musicOn) music.current?.pause();
  }, [musicOn]);

  const toggleMusic = useCallback(() => {
    // Keep play inside the button gesture for browsers with strict autoplay rules.
    enabled.current = !enabled.current;
    interacted.current = true;
    if (enabled.current) start();
    else music.current?.pause();
    setMusicOn(enabled.current);
  }, [start]);

  return { musicOn, toggleMusic };
}
