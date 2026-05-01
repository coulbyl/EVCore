import type { FormationContentMeta } from "@/domains/formation/types/formation";

function clampStart(input: number | undefined): number {
  if (typeof input !== "number" || !Number.isFinite(input)) return 0;
  return Math.max(0, Math.floor(input));
}

function youtubeEmbedUrl(videoUrl: string, startSeconds: number): string {
  try {
    const url = new URL(videoUrl);
    const id =
      url.searchParams.get("v") ??
      (url.hostname === "youtu.be" ? url.pathname.slice(1) : null);
    if (!id) return videoUrl;
    const embed = new URL(`https://www.youtube.com/embed/${id}`);
    if (startSeconds > 0) embed.searchParams.set("start", String(startSeconds));
    embed.searchParams.set("rel", "0");
    return embed.toString();
  } catch {
    return videoUrl;
  }
}

function vimeoEmbedUrl(videoUrl: string, startSeconds: number): string {
  try {
    const url = new URL(videoUrl);
    const id = url.pathname.split("/").filter(Boolean).pop();
    if (!id) return videoUrl;
    const embed = new URL(`https://player.vimeo.com/video/${id}`);
    if (startSeconds > 0) embed.searchParams.set("#t", `${startSeconds}s`);
    return embed.toString();
  } catch {
    return videoUrl;
  }
}

export function FormationVideoPlayer({
  meta,
  startAtSeconds,
}: {
  meta: FormationContentMeta;
  startAtSeconds?: number;
}) {
  const provider = meta.videoProvider ?? "youtube";
  const videoUrl = meta.videoUrl ?? "";
  const start = clampStart(startAtSeconds);

  if (!videoUrl) return null;

  if (provider === "html5") {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-panel">
        <video
          controls
          preload="metadata"
          className="h-full w-full"
          src={videoUrl}
        />
      </div>
    );
  }

  const embedUrl =
    provider === "vimeo"
      ? vimeoEmbedUrl(videoUrl, start)
      : youtubeEmbedUrl(videoUrl, start);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-panel">
      <iframe
        className="h-full w-full"
        src={embedUrl}
        title={meta.title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
