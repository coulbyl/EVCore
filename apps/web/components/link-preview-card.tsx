"use client";

import { useEffect, useState } from "react";

type OgMeta = {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

export function LinkPreviewCard({ url }: { url: string }) {
  const [meta, setMeta] = useState<OgMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/og-preview?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: OgMeta) => {
        if (!cancelled && (data.title ?? data.description ?? data.image)) {
          setMeta(data);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!meta) return null;

  let domain = url;
  try {
    domain = new URL(url).hostname;
  } catch {
    /* keep raw url */
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex overflow-hidden rounded-lg border border-border bg-panel-strong no-underline transition-colors hover:brightness-105"
    >
      {meta.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={meta.image} alt="" className="w-1/3 shrink-0 object-cover" />
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-2.5 py-2">
        {meta.siteName && (
          <p className="truncate text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-accent">
            {meta.siteName}
          </p>
        )}
        {meta.title && (
          <p className="line-clamp-1 text-[0.7rem] font-semibold leading-snug text-foreground">
            {meta.title}
          </p>
        )}
        <p className="truncate text-[0.62rem] text-muted-foreground">
          {domain}
        </p>
      </div>
    </a>
  );
}
