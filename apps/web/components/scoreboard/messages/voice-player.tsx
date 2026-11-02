"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/**
 * A voice message (09 § 2): play, a bar, its length. The length comes
 * with the message (`durationMs`, measured when it was recorded): a voice
 * recorded by a browser often carries none in its file, and the native
 * player showed « 0:00 / 0:00 » until played. Colours follow the bubble's
 * text (`current`), mine on ink as the team's on card. Taken from the old
 * inbox's player, which the team liked.
 */
export function VoicePlayer({
  src,
  durationMs,
  label,
}: {
  src: string;
  durationMs: number | null;
  /** « Message vocal »: the button is a toggle, pressed while playing. */
  label: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState((durationMs ?? 0) / 1000);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrent(audio.currentTime);
    const onLoaded = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
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

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void audio.play();
    setPlaying(!playing);
  }

  const progress = duration > 0 ? Math.min(current / duration, 1) : 0;
  // The whole length until it plays, then what is left.
  const seconds = Math.max(Math.round(duration - current), 0);

  return (
    <div className="flex min-w-52 items-center gap-2.5">
      <audio ref={audioRef} src={src} preload="none" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-pressed={playing}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-current/15 transition-colors hover:bg-current/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {playing ? (
          <Pause aria-hidden className="size-4" strokeWidth={2.5} />
        ) : (
          <Play aria-hidden className="ms-0.5 size-4" strokeWidth={2.5} />
        )}
      </button>
      <div
        aria-hidden
        className="relative h-1.5 flex-1 rounded-full bg-current/20"
      >
        <div
          className="absolute inset-y-0 start-0 rounded-full bg-current"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className="score w-10 shrink-0 text-end text-meta tabular-nums opacity-80">
        {`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}
      </span>
    </div>
  );
}
