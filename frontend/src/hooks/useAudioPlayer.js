import { useCallback, useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/format";

/**
 * Audio playback state for a single file.
 *
 * Extracted from FileCard so the card shell stays kind-agnostic. Preserves the
 * Chrome/Firefox WebM workaround: those files report `duration === Infinity`
 * until you seek to a huge offset, which forces the browser to resolve it.
 */
export function useAudioPlayer({ src, isLoading }) {
  const audioRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playRequested, setPlayRequested] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [duration, setDuration] = useState("--:--");

  // Play as soon as the signed URL arrives, if the user already asked.
  useEffect(() => {
    if (!src || !playRequested || !audioRef.current) return;

    audioRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
        setPlayRequested(false);
      })
      .catch(() => {
        // Autoplay policy or a decode error — drop back to a stopped state
        // rather than leaving a spinner running forever.
        setPlayRequested(false);
      });
  }, [src, playRequested]);

  // Pause and reset when the source changes out from under us.
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio && !audio.paused) audio.pause();
    };
  }, [src]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;

    // Source not ready yet — queue the intent and let the effect above run it.
    if (isLoading || !src) {
      setPlayRequested((prev) => !prev);
      return;
    }
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      setPlayRequested(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, [isLoading, src, isPlaying]);

  const onTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const dur = audio.duration;
    setProgress(Number.isFinite(dur) && dur > 0 ? (audio.currentTime / dur) * 100 : 0);
    setCurrentTime(formatDuration(audio.currentTime));
  }, []);

  const onLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // WebM recordings report Infinity until forced to seek to the end.
    if (audio.duration === Infinity) {
      audio.currentTime = 1e101;
      audio.ontimeupdate = function handleResolve() {
        this.ontimeupdate = null;
        audio.currentTime = 0;
        setDuration(formatDuration(audio.duration));
      };
      return;
    }

    setDuration(formatDuration(audio.duration));
  }, []);

  const onEnded = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
  }, []);

  /** Seek from a click on the progress bar. */
  const seekToEvent = useCallback((e) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = Math.min(Math.max(ratio, 0), 1) * audio.duration;
  }, []);

  /** Seek by a relative number of seconds — used for keyboard arrow support. */
  const nudge = useCallback((seconds) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.min(
      Math.max(audio.currentTime + seconds, 0),
      audio.duration,
    );
  }, []);

  return {
    audioRef,
    isPlaying,
    isPending: isLoading || (playRequested && !isPlaying),
    progress,
    currentTime,
    duration,
    toggle,
    nudge,
    seekToEvent,
    audioProps: {
      onTimeUpdate,
      onLoadedMetadata,
      onEnded,
      onPause: () => setIsPlaying(false),
      onPlay: () => setIsPlaying(true),
    },
  };
}
