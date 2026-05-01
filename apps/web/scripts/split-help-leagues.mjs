import { promises as fs } from "node:fs";
import path from "node:path";

const INPUT_PATH = path.join(process.cwd(), "content", "help-leagues.md");
const OUTPUT_DIR = path.join(
  process.cwd(),
  "content",
  "formation",
  "articles",
  "leagues",
);

function normalizeNewlines(input) {
  return input.replace(/\r\n/g, "\n");
}

function stripTopH1(input) {
  const lines = input.split("\n");
  if (lines[0]?.trim().startsWith("# ")) {
    let start = 1;
    while (start < lines.length && !lines[start]?.trim()) start += 1;
    return lines.slice(start).join("\n").trimStart();
  }
  return input;
}

function stripFirstH2Heading(section) {
  const lines = section.split("\n");
  if (!lines[0]?.startsWith("## ")) return section.trimStart();
  let start = 1;
  while (start < lines.length && !lines[start]?.trim()) start += 1;
  return lines.slice(start).join("\n").trimStart();
}

function stripTrailingHr(section) {
  const trimmed = section.trimEnd();
  if (trimmed.endsWith("\n---")) {
    return trimmed.slice(0, -"\n---".length).trimEnd();
  }
  if (trimmed.endsWith("---")) {
    return trimmed.slice(0, -"---".length).trimEnd();
  }
  return trimmed;
}

function dedupeHorizontalRules(input) {
  return input
    .replace(/\n---\n(\s*\n---\n)+/g, "\n---\n")
    .replace(/\n---\n\s*\n---\n/g, "\n---\n");
}

function escapeFrontmatterString(value) {
  return JSON.stringify(String(value));
}

function toSlugSafe(input) {
  return String(input)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isLeagueHeading(title) {
  return /\([A-Za-z0-9.]{1,8}\)\s*(✅|⚠️|🔴)?\s*$/.test(title);
}

function parseLeagueTitle(rawTitle) {
  const cleaned = rawTitle.replace(/\s*(✅|⚠️|🔴)\s*$/, "").trim();
  const match = cleaned.match(/^(.+?)\s*\(([A-Za-z0-9.]{1,8})\)\s*$/);
  if (!match) return null;
  const name = match[1]?.trim();
  const code = match[2]?.trim();
  if (!name || !code) return null;
  return { name, code };
}

function findH2Sections(content) {
  const matches = [...content.matchAll(/^##\s+(.+)$/gm)].map((match) => ({
    title: match[1] ?? "",
    index: match.index ?? 0,
  }));

  const sections = matches.map((match, idx) => {
    const next = matches[idx + 1];
    const end = next ? next.index : content.length;
    return {
      title: match.title.trim(),
      raw: content.slice(match.index, end).trim(),
    };
  });

  return sections;
}

function extractSummary(sectionBody) {
  const lines = sectionBody.split("\n").map((l) => l.trim());
  const profile = lines.find((line) => line.startsWith("**Profil"));
  if (profile) {
    return profile
      .replace(/\*\*/g, "")
      .replace(/^Profil\s*:\s*/i, "")
      .trim()
      .slice(0, 160);
  }
  const firstParagraph = lines.find(
    (line) =>
      line &&
      !line.startsWith("## ") &&
      !line.startsWith("### ") &&
      !line.startsWith(">") &&
      !line.startsWith("- "),
  );
  return firstParagraph ? firstParagraph.slice(0, 160) : undefined;
}

async function main() {
  const raw = normalizeNewlines(await fs.readFile(INPUT_PATH, "utf8"));
  const noH1 = stripTopH1(raw);

  const h2Sections = findH2Sections(noH1);

  const commentIndex = h2Sections.findIndex(
    (s) => s.title.toLowerCase() === "comment lire un pick proposé",
  );

  const leagueStartIndex = h2Sections.findIndex((s) => isLeagueHeading(s.title));
  if (leagueStartIndex === -1) {
    throw new Error("No league sections found (expected headings like '## ... (CODE)').");
  }

  const commonSections = h2Sections.slice(
    0,
    commentIndex !== -1 ? Math.min(leagueStartIndex, commentIndex) : leagueStartIndex,
  );
  const leagueSections = h2Sections.slice(
    leagueStartIndex,
    commentIndex !== -1 ? commentIndex : h2Sections.length,
  );
  const tailSections = commentIndex !== -1 ? h2Sections.slice(commentIndex) : [];

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Intro (common rules + abbreviations + canal)
  {
    const content = dedupeHorizontalRules(
      stripTrailingHr(commonSections.map((s) => s.raw).join("\n\n")),
    );
    const frontmatter = [
      "---",
      `title: ${escapeFrontmatterString("Guide par ligue — introduction")}`,
      "category: leagues",
      "difficulty: beginner",
      "slug: leagues-intro",
      `summary: ${escapeFrontmatterString(
        "Abréviations, règles communes, et lecture des canaux (prédiction / Safe Value).",
      )}`,
      "---",
      "",
    ].join("\n");

    await fs.writeFile(path.join(OUTPUT_DIR, "leagues-intro.md"), frontmatter + content + "\n");
  }

  // One file per league
  for (const section of leagueSections) {
    const parsed = parseLeagueTitle(section.title);
    if (!parsed) continue;
    const { name, code } = parsed;
    const codeSlug = toSlugSafe(code);
    const slug = `league-${codeSlug}`;
    const filename = `league-${codeSlug}.md`;

    const body = stripTrailingHr(stripFirstH2Heading(section.raw));
    const summary = extractSummary(body);

    const frontmatter = [
      "---",
      `title: ${escapeFrontmatterString(`${name} (${code})`)}`,
      "category: leagues",
      "difficulty: beginner",
      `slug: ${slug}`,
      summary ? `summary: ${escapeFrontmatterString(summary)}` : null,
      `related: ["leagues-intro"]`,
      "---",
      "",
    ]
      .filter((line) => line !== null)
      .join("\n");

    await fs.writeFile(path.join(OUTPUT_DIR, filename), frontmatter + body + "\n");
  }

  // Tail: "Comment lire un pick proposé"
  if (tailSections.length > 0) {
    const tail = dedupeHorizontalRules(
      stripTrailingHr(tailSections.map((s) => s.raw).join("\n\n")),
    );
    const body = stripTrailingHr(stripFirstH2Heading(tail));
    const frontmatter = [
      "---",
      `title: ${escapeFrontmatterString("Comment lire un pick proposé")}`,
      "category: app",
      "difficulty: beginner",
      "slug: comment-lire-un-pick",
      `summary: ${escapeFrontmatterString(
        "Comprendre les badges, probabilités et signaux affichés sur un pick.",
      )}`,
      "---",
      "",
    ].join("\n");

    await fs.writeFile(
      path.join(process.cwd(), "content", "formation", "articles", "comment-lire-un-pick.md"),
      frontmatter + body + "\n",
    );
  }

  process.stdout.write("OK: Generated formation league articles.\n");
}

await main();
