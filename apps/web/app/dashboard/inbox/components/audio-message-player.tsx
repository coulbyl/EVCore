"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Pause, Play } from "lucide-react";
import { formatDuration } from "./attachment-constants";

// Custom transport instead of the native <audio controls> widget — the
// browser default renders as an opaque black bar that clashes with every
// bubble variant. Every color here is `current`-based so it inherits
// whatever text color the parent Bubble variant sets (primary-foreground,
// secondary-foreground, …) and always reads correctly.
export function AudioMessagePlayer({
  src,
  durationMs,
}: {
  src: string;
  durationMs?: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState((durationMs ?? 0) / 1000);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      void audio.play();
    }
    setIsPlaying(!isPlaying);
  }

  function seek(e: MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      Math.max((e.clientX - rect.left) / rect.width, 0),
      1,
    );
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  const totalMs = duration > 0 ? duration * 1000 : (durationMs ?? 0);
  // WhatsApp-style: shows the full length until playback starts, then
  // counts down the remaining time instead.
  const labelMs = currentTime > 0 ? totalMs - currentTime * 1000 : totalMs;

  return (
    <div className="flex min-w-[220px] items-center gap-2">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={togglePlay}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-current/15 transition-colors hover:bg-current/25"
      >
        {isPlaying ? (
          <Pause size={14} />
        ) : (
          <Play size={14} className="ml-0.5" />
        )}
        <span className="sr-only">{isPlaying ? "Pause" : "Lecture"}</span>
      </button>
      <div
        className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-current/20"
        onClick={seek}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-current"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-[0.65rem] tabular-nums opacity-80">
        {formatDuration(Math.max(labelMs, 0))}
      </span>
    </div>
  );
}
