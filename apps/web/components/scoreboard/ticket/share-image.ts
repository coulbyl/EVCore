/**
 * « Partager mes chances » (07 § 5, maquette Partage): the ticket drawn on
 * a canvas, vertical, on the band's ink, for WhatsApp. The bets, the total
 * odds, the chance very large with its diodes, what 1xBet keeps over time;
 * at the bottom our hero of the day and the legal line. Never a stake nor
 * a gain (07 § 9). Loaded on the tap of the button only.
 */

export type ShareImageInput = {
  legs: { teams: string; label: string; odds: string }[];
  title: string;
  date: string;
  totalOddsLabel: string;
  totalOdds: string;
  /** « environ », above the chance; empty for a single bet. */
  about: string;
  chance: string;
  leds: { lit: number; total: number } | null;
  keep: string;
  ours: string | null;
  legal: string;
};

const WIDTH = 1080;
const HEIGHT = 1350;
const PAD = 72;

type Look = {
  ink: string;
  text: string;
  muted: string;
  rule: string;
  amber: string;
  ledOff: string;
  score: string;
  body: string;
};

/** The colours and fonts of the page, read off the scoreboard's root. */
function lookOfPage(): Look {
  const root = document.querySelector(".scoreboard") ?? document.body;
  const style = getComputedStyle(root);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    ink: read("--band", "#0e1320"),
    text: read("--band-foreground", "#ffffff"),
    muted: read("--band-muted", "#9aa3b2"),
    rule: read("--band-rule", "#2a3142"),
    amber: read("--led-on", "#ffb300"),
    ledOff: read("--led-off-band", "#2a3142"),
    // next/font's own variables: the theme's --font-score is not set here.
    score: read("--font-barlow-condensed", "sans-serif"),
    body: read("--font-barlow", "sans-serif"),
  };
}

/** Cuts a text with « … » to fit `width`. */
function fit(context: CanvasRenderingContext2D, text: string, width: number) {
  if (context.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && context.measureText(`${cut}…`).width > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

export async function drawTicketImage(input: ShareImageInput): Promise<Blob> {
  const look = lookOfPage();
  // The scoreboard fonts may not be loaded at this size yet.
  await Promise.all([
    document.fonts.load(`700 120px ${look.score}`),
    document.fonts.load(`500 34px ${look.body}`),
    document.fonts.load(`600 40px ${look.score}`),
  ]).catch(() => undefined);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2D canvas");
  const c = context;
  const inner = WIDTH - 2 * PAD;

  c.fillStyle = look.ink;
  c.fillRect(0, 0, WIDTH, HEIGHT);
  c.textBaseline = "alphabetic";

  // The brand, discreet, and the day.
  c.fillStyle = look.text;
  c.font = `700 52px ${look.score}`;
  c.fillText(input.title, PAD, PAD + 44);
  c.fillStyle = look.muted;
  c.font = `500 30px ${look.body}`;
  c.textAlign = "right";
  c.fillText(input.date, WIDTH - PAD, PAD + 44);
  c.textAlign = "left";

  // The bets: two lines each while they fit, one line beyond (15 at most).
  // The body (bets, odds, chance, keep) is centred between the header and
  // the footer: a short ticket does not leave a hole under its bets.
  const headerEnd = PAD + 90;
  const footerStart = HEIGHT - PAD - 90;
  const ledsHeight = input.leds ? 66 : 0;
  const restHeight = 170 + (input.about ? 40 : 0) + 140 + ledsHeight + 40;
  // The bets take what the rest leaves, up to two comfortable lines each.
  const room = footerStart - headerEnd - restHeight;
  const row = Math.min(108, room / Math.max(1, input.legs.length));
  const twoLines = row >= 84;
  const bodyHeight = row * input.legs.length + restHeight;
  const top =
    headerEnd + Math.max(0, (footerStart - headerEnd - bodyHeight) / 2);
  const size = twoLines ? 36 : Math.max(22, Math.floor(row * 0.6));
  input.legs.forEach((leg, index) => {
    const y = top + index * row;
    c.font = `700 ${size + 4}px ${look.score}`;
    const oddsWidth = c.measureText(leg.odds).width;
    c.fillStyle = look.text;
    c.textAlign = "right";
    c.fillText(leg.odds, WIDTH - PAD, y + (twoLines ? row * 0.62 : row * 0.72));
    c.textAlign = "left";
    c.font = `500 ${size}px ${look.body}`;
    if (twoLines) {
      c.fillStyle = look.muted;
      c.font = `500 26px ${look.body}`;
      c.fillText(fit(c, leg.teams, inner - oddsWidth - 24), PAD, y + 30);
      c.fillStyle = look.text;
      c.font = `500 ${size}px ${look.body}`;
      c.fillText(
        fit(c, leg.label, inner - oddsWidth - 24),
        PAD,
        y + row * 0.72,
      );
    } else {
      c.fillStyle = look.text;
      c.fillText(
        fit(c, leg.label, inner - oddsWidth - 24),
        PAD,
        y + row * 0.72,
      );
    }
  });

  // The total odds.
  let y = top + row * input.legs.length + 40;
  c.fillStyle = look.rule;
  c.fillRect(PAD, y, inner, 2);
  y += 70;
  c.fillStyle = look.muted;
  c.font = `500 32px ${look.body}`;
  c.fillText(input.totalOddsLabel, PAD, y);
  c.fillStyle = look.text;
  c.font = `700 64px ${look.score}`;
  c.textAlign = "right";
  c.fillText(input.totalOdds, WIDTH - PAD, y + 6);
  c.textAlign = "left";

  // The chance, very large, with its diodes.
  y += 60;
  if (input.about) {
    c.fillStyle = look.muted;
    c.font = `500 34px ${look.body}`;
    c.fillText(input.about, PAD, y + 34);
    y += 40;
  }
  c.fillStyle = look.amber;
  // The figure the player never saw: smaller rather than cut.
  let chanceSize = 120;
  c.font = `700 ${chanceSize}px ${look.score}`;
  while (chanceSize > 48 && c.measureText(input.chance).width > inner) {
    chanceSize -= 4;
    c.font = `700 ${chanceSize}px ${look.score}`;
  }
  c.fillText(input.chance, PAD, y + 112);
  y += 140;
  if (input.leds) {
    const gap = 12;
    const dot = Math.min(
      36,
      (inner - gap * (input.leds.total - 1)) / input.leds.total,
    );
    for (let i = 0; i < input.leds.total; i += 1) {
      c.beginPath();
      c.arc(
        PAD + dot / 2 + i * (dot + gap),
        y + dot / 2,
        dot / 2,
        0,
        Math.PI * 2,
      );
      c.fillStyle = i < input.leds.lit ? look.amber : look.ledOff;
      c.fill();
    }
    y += dot + 30;
  }

  // What 1xBet keeps, over time.
  c.fillStyle = look.muted;
  c.font = `500 32px ${look.body}`;
  c.fillText(fit(c, input.keep, inner), PAD, y + 32);

  // Our hero and the legal line, small, at the bottom.
  c.font = `500 26px ${look.body}`;
  if (input.ours) c.fillText(fit(c, input.ours, inner), PAD, HEIGHT - PAD - 44);
  c.font = `500 22px ${look.body}`;
  c.fillText(fit(c, input.legal, inner), PAD, HEIGHT - PAD);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))),
      "image/png",
    ),
  );
}

/**
 * Shares the image through the phone's share sheet (WhatsApp, …) when the
 * browser can share files, downloads it otherwise.
 */
export async function shareTicketImage(
  input: ShareImageInput,
  filename: string,
): Promise<void> {
  const blob = await drawTicketImage(input);
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: input.title });
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
