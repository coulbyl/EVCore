"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceRecorderState = "idle" | "recording" | "preview" | "error";

/**
 * Why the microphone could not start, from the browser's error: a player
 * told « pas autorisé » when the PC simply has no microphone looks for a
 * setting that does not exist.
 */
export type VoiceRecorderProblem =
  | "denied"
  | "notFound"
  | "busy"
  | "unsupported"
  | "unknown";

function problemOf(error: unknown): VoiceRecorderProblem {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "notFound";
  }
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  if (name === "NotSupportedError") return "unsupported";
  return "unknown";
}

// Codecs tried in signed-URL-friendly preference order — the mime type
// actually used (MediaRecorder.mimeType, read after recording starts) is
// what gets sent to the backend, stripped of the ";codecs=..." suffix (the
// backend's allowlist matches on the bare type — see support-attachment.util.ts).
const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return undefined;
  }
  return PREFERRED_MIME_TYPES.find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

/**
 * Press-to-start / press-to-stop voice note recording (not hold-to-record —
 * holding a button reliably across mobile scroll/touch handling is fragile,
 * and a tap is more accessible). Produces a Blob in the "preview" state so
 * the caller can offer listen-before-send; never uploads anything itself.
 */
export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceRecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<VoiceRecorderProblem | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setProblem(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Enregistrement vocal non supporté par ce navigateur");
      setProblem("unsupported");
      setState("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        releaseStream();
        setPreviewBlob(blob);
        setState("preview");
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      startTimeRef.current = Date.now();
      setElapsedMs(0);
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 200);
      setState("recording");
    } catch (caught) {
      setError("Microphone indisponible ou permission refusée");
      setProblem(problemOf(caught));
      setState("error");
    }
  }, [releaseStream]);

  const stop = useCallback(() => {
    stopTimer();
    mediaRecorderRef.current?.stop();
  }, [stopTimer]);

  // Recording → discarded without ever reaching preview (e.g. "changed my
  // mind" mid-recording).
  const cancel = useCallback(() => {
    stopTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null; // don't let the discard path also stage a preview
      recorder.stop();
    }
    releaseStream();
    chunksRef.current = [];
    setPreviewBlob(null);
    setElapsedMs(0);
    setState("idle");
  }, [releaseStream, stopTimer]);

  // Preview → discarded before sending.
  const discardPreview = useCallback(() => {
    setPreviewBlob(null);
    setElapsedMs(0);
    setState("idle");
  }, []);

  const reset = useCallback(() => {
    setPreviewBlob(null);
    setElapsedMs(0);
    setError(null);
    setProblem(null);
    setState("idle");
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      releaseStream();
    };
  }, [releaseStream, stopTimer]);

  return {
    state,
    elapsedMs,
    error,
    problem,
    previewBlob,
    start,
    stop,
    cancel,
    discardPreview,
    reset,
  };
}
