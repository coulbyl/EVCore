import { NextResponse } from "next/server";

type OgMeta = {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

function extractOgMeta(html: string): OgMeta {
  function prop(name: string): string | null {
    return (
      html.match(
        new RegExp(
          `<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`,
          "i",
        ),
      )?.[1] ??
      html.match(
        new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`,
          "i",
        ),
      )?.[1] ??
      null
    );
  }

  function named(name: string): string | null {
    return (
      html.match(
        new RegExp(
          `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
          "i",
        ),
      )?.[1] ??
      html.match(
        new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`,
          "i",
        ),
      )?.[1] ??
      null
    );
  }

  return {
    title:
      prop("og:title") ??
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ??
      null,
    description: prop("og:description") ?? named("description"),
    image: prop("og:image"),
    siteName: prop("og:site_name"),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "EVCoreBot/1.0",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
    }

    // Only read the first 100 KB — OG tags are always in <head>
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      while (html.length < 100_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        if (/<\/head>/i.test(html)) break;
      }
      await reader.cancel();
    }

    const meta = extractOgMeta(html);

    return NextResponse.json(meta, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
