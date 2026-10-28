"""Audit public pages of c-evcore.com in desktop and mobile viewports (read-only)."""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
BASE = "https://c-evcore.com"
PATHS = ["/", "/auth/register", "/auth/login", "/auth/forgot-password",
         "/dashboard", "/dashboard/track-record", "/page-inexistante",
         "/cgu", "/confidentialite", "/mentions-legales", "/pricing", "/tarifs"]

PROFILES = {
    "desktop": dict(viewport={"width": 1440, "height": 900}),
    "mobile": dict(viewport={"width": 375, "height": 812}, is_mobile=True,
                   has_touch=True, device_scale_factor=2,
                   user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                               "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
                               "Mobile/15E148 Safari/604.1")),
}

LCP_JS = """
window.__lcp = 0; window.__cls = 0;
new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; })
  .observe({type: 'largest-contentful-paint', buffered: true});
new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
  .observe({type: 'layout-shift', buffered: true});
"""

META_JS = """
() => {
  const m = n => { const e = document.querySelector(`meta[name="${n}"],meta[property="${n}"]`); return e ? e.content : null; };
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const res = performance.getEntriesByType('resource');
  const bytes = res.reduce((a, r) => a + (r.transferSize || 0), 0) + (nav.transferSize || 0);
  return {
    url: location.href, title: document.title, lang: document.documentElement.lang,
    description: m('description'), robots: m('robots'),
    ogTitle: m('og:title'), ogDescription: m('og:description'), ogImage: m('og:image'),
    ogUrl: m('og:url'), twitterCard: m('twitter:card'),
    canonical: (document.querySelector('link[rel=canonical]') || {}).href || null,
    h1: [...document.querySelectorAll('h1')].map(h => h.innerText.trim()),
    h2: [...document.querySelectorAll('h2')].map(h => h.innerText.trim()),
    links: [...document.querySelectorAll('a[href]')].map(a => ({t: a.innerText.trim().slice(0, 60), h: a.getAttribute('href')})),
    imgsNoAlt: [...document.querySelectorAll('img')].filter(i => !i.alt).length,
    inputs: [...document.querySelectorAll('input,textarea,select')].map(i => ({type: i.type, name: i.name, placeholder: i.placeholder, required: i.required, label: (i.labels && i.labels[0]) ? i.labels[0].innerText.trim() : null})),
    checkboxes: document.querySelectorAll('input[type=checkbox],[role=checkbox]').length,
    scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
    ttfb: nav.responseStart, domContentLoaded: nav.domContentLoadedEventEnd, load: nav.loadEventEnd,
    lcp: window.__lcp, cls: window.__cls, requests: res.length + 1, transferBytes: bytes,
    smallTapTargets: [...document.querySelectorAll('a,button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32); }).map(e => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30)).slice(0, 15),
    text: document.body.innerText,
  };
}
"""


def run() -> None:
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for name, opts in PROFILES.items():
            ctx = browser.new_context(locale="fr-FR", **opts)
            ctx.add_init_script(LCP_JS)
            for path in PATHS:
                page = ctx.new_page()
                console, failed = [], []
                page.on("console", lambda m, c=console: c.append(f"{m.type}: {m.text}"[:300]) if m.type in ("error", "warning") else None)
                page.on("requestfailed", lambda r, f=failed: f.append(f"{r.url} {r.failure}"))
                page.on("response", lambda r, f=failed: f.append(f"{r.status} {r.url}") if r.status >= 400 else None)
                t0 = time.time()
                try:
                    resp = page.goto(BASE + path, wait_until="networkidle", timeout=45000)
                    status = resp.status if resp else None
                except Exception as exc:  # noqa: BLE001
                    status = f"ERR {exc}"[:200]
                page.wait_for_timeout(1500)
                info = page.evaluate(META_JS)
                info.update(profile=name, path=path, status=status,
                            wallSeconds=round(time.time() - t0, 2),
                            console=console[:30], failed=failed[:30])
                slug = path.strip("/").replace("/", "_") or "home"
                page.screenshot(path=str(OUT / f"{name}__{slug}.png"), full_page=True)
                page.screenshot(path=str(OUT / f"{name}__{slug}__fold.png"), full_page=False)
                results.append(info)
                page.close()
            ctx.close()
        browser.close()
    (OUT / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    run()
