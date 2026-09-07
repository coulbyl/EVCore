import { NextResponse } from "next/server";
import dns from "node:dns/promises";
import net from "node:net";

// SSRF guard: this route fetches whatever URL a chat participant pastes, so
// it must never be allowed to reach an address only reachable from inside
// our own network (RustFS admin console, ml-worker, cloud metadata
// endpoints, ...) — see the incident this was fixed for. Checks the
// resolved IP, not just the hostname string, since "http://localhost" and
// "http://2130706433" (decimal loopback) both need to be blocked too.
function isPrivateOrReservedIp(ip: string): boolean {
  const type = net.isIP(ip);
  if (type === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === undefined || b === undefined) return true;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    return false;
  }
  if (type === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true; // loopback
    if (normalized === "::") return true;
    if (normalized.startsWith("::ffff:")) {
      const embedded = normalized.slice("::ffff:".length);
      if (net.isIP(embedded) === 4) return isPrivateOrReservedIp(embedded);
    }
    if (normalized.startsWith("fc") || normalized.startsWith("fd"))
      return true; // unique local
    if (normalized.startsWith("fe80")) return true; // link-local
    return false;
  }
  return true; // couldn't parse as an IP at all — reject to be safe
}

async function assertResolvesToPublicAddress(hostname: string): Promise<void> {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) throw new Error("DNS resolution failed");
  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new Error("Resolves to a private/internal address");
    }
  }
}

// Manual redirect handling, re-validating the target host on every hop —
// otherwise a URL that passes the DNS check on the first request could
// redirect straight to an internal address and the guard above would never
// see it.
async function fetchPublicUrl(initialUrl: string): Promise<Response> {
  let currentUrl = initialUrl;
  for (let hop = 0; hop < 5; hop++) {
    const parsed = new URL(currentUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Invalid protocol");
    }
    await assertResolvesToPublicAddress(parsed.hostname);

    const res = await fetch(currentUrl, {
      headers: {
        "User-Agent": "EVCoreBot/1.0",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(6000),
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirect without a location");
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}

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
    const res = await fetchPublicUrl(url);

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
