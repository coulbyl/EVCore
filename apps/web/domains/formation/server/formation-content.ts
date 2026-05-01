import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  FormationContentItem,
  FormationContentMeta,
  FormationContentType,
} from "../types/formation";

const DEFAULT_CONTENT_ROOT = path.join(process.cwd(), "content", "formation");
const MONOREPO_CONTENT_ROOT = path.join(
  process.cwd(),
  "apps",
  "web",
  "content",
  "formation",
);

let resolvedContentRoot: string | null = null;

async function getContentRoot(): Promise<string> {
  if (resolvedContentRoot) return resolvedContentRoot;

  try {
    await fs.access(DEFAULT_CONTENT_ROOT);
    resolvedContentRoot = DEFAULT_CONTENT_ROOT;
    return resolvedContentRoot;
  } catch {
    // fallback below
  }

  resolvedContentRoot = MONOREPO_CONTENT_ROOT;
  return resolvedContentRoot;
}

type FrontmatterParseResult = {
  data: Record<string, unknown>;
  content: string;
};

function parsePrimitiveValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function parseFrontmatter(input: string): FrontmatterParseResult {
  if (!input.startsWith("---\n")) {
    return { data: {}, content: input };
  }

  const endIndex = input.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return { data: {}, content: input };
  }

  const rawFrontmatter = input.slice(4, endIndex);
  const body = input.slice(endIndex + "\n---\n".length);

  const data: Record<string, unknown> = {};

  for (const line of rawFrontmatter.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) continue;

    data[key] = parsePrimitiveValue(value);
  }

  return { data, content: body.trimStart() };
}

function estimateReadTimeMinutes(content: string): number {
  const words = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#>*`[\]()-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return minutes;
}

function basenameSlug(filename: string): string {
  return filename.replace(/\.(md|mdx)$/i, "");
}

function toArrayOfStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item) => typeof item === "string");
  return strings.length === value.length ? strings : undefined;
}

async function readDirSafe(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

async function listMarkdownFilesRecursively(
  rootDir: string,
): Promise<string[]> {
  const results: string[] = [];
  const queue: string[] = [rootDir];

  while (queue.length > 0) {
    const currentDir = queue.pop();
    if (!currentDir) continue;

    const entries = await readDirSafe(currentDir);
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          queue.push(fullPath);
          continue;
        }
        if (stat.isFile() && /\.(md|mdx)$/i.test(entry)) {
          results.push(fullPath);
        }
      } catch {
        // ignore unreadable entries
      }
    }
  }

  results.sort((a, b) => a.localeCompare(b));
  return results;
}

function parseMeta(
  type: FormationContentType,
  slugFromFilename: string,
  data: Record<string, unknown>,
  content: string,
): FormationContentMeta {
  const title = typeof data.title === "string" ? data.title : slugFromFilename;

  const category =
    typeof data.category === "string"
      ? (data.category as FormationContentMeta["category"])
      : "bases";

  const difficulty =
    typeof data.difficulty === "string"
      ? (data.difficulty as FormationContentMeta["difficulty"])
      : "beginner";

  const readTime =
    typeof data.readTime === "number" && Number.isFinite(data.readTime)
      ? Math.max(1, Math.round(data.readTime))
      : estimateReadTimeMinutes(content);

  const order =
    typeof data.order === "number" && Number.isFinite(data.order)
      ? data.order
      : undefined;

  return {
    type,
    slug: typeof data.slug === "string" ? data.slug : slugFromFilename,
    title,
    category,
    difficulty,
    order,
    readTime,
    summary: typeof data.summary === "string" ? data.summary : undefined,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
    videoUrl: typeof data.videoUrl === "string" ? data.videoUrl : undefined,
    videoProvider:
      typeof data.videoProvider === "string"
        ? (data.videoProvider as FormationContentMeta["videoProvider"])
        : undefined,
    videoDuration:
      typeof data.videoDuration === "string" ? data.videoDuration : undefined,
    chapters: Array.isArray(data.chapters)
      ? (data.chapters as FormationContentMeta["chapters"])
      : undefined,
    transcriptUrl:
      typeof data.transcriptUrl === "string" ? data.transcriptUrl : undefined,
    thumbnail: typeof data.thumbnail === "string" ? data.thumbnail : undefined,
    related: toArrayOfStrings(data.related),
  };
}

async function readContentFile(
  type: FormationContentType,
  fullPath: string,
): Promise<FormationContentItem> {
  const raw = await fs.readFile(fullPath, "utf8");
  const { data, content } = parseFrontmatter(raw);
  const slugFromFilename = basenameSlug(path.basename(fullPath));
  const meta = parseMeta(type, slugFromFilename, data, content);
  return { ...meta, content };
}

function scoreMatch(text: string, query: string): number {
  const hay = text.toLowerCase();
  const needle = query.toLowerCase();
  if (!needle) return 0;
  const index = hay.indexOf(needle);
  if (index === -1) return 0;
  // Earlier matches score slightly higher.
  return 1 + Math.max(0, 30 - Math.floor(index / 20));
}

export async function getFormationIndex(): Promise<FormationContentMeta[]> {
  const contentRoot = await getContentRoot();
  const articlesDir = path.join(contentRoot, "articles");
  const videosDir = path.join(contentRoot, "videos");

  const [articlePaths, videoPaths] = await Promise.all([
    listMarkdownFilesRecursively(articlesDir),
    listMarkdownFilesRecursively(videosDir),
  ]);

  const items = await Promise.all([
    ...articlePaths.map((fullPath) => readContentFile("article", fullPath)),
    ...videoPaths.map((fullPath) => readContentFile("video", fullPath)),
  ]);

  const metas: FormationContentMeta[] = items.map((item) => {
    const { content, ...meta } = item;
    void content;
    return meta;
  });

  metas.sort((a, b) => a.title.localeCompare(b.title));
  return metas;
}

export async function getFormationContentBySlug(
  type: FormationContentType,
  slug: string,
): Promise<FormationContentItem | null> {
  const contentRoot = await getContentRoot();
  const dir = path.join(
    contentRoot,
    type === "article" ? "articles" : "videos",
  );

  const paths = await listMarkdownFilesRecursively(dir);
  for (const fullPath of paths) {
    const item = await readContentFile(type, fullPath);
    if (item.slug === slug) return item;
  }

  return null;
}

export async function searchFormationContent({
  category,
  q,
}: {
  category: FormationContentMeta["category"];
  q: string;
}): Promise<Array<{ type: FormationContentType; slug: string }>> {
  const query = q.trim();
  if (query.length < 2) return [];

  const contentRoot = await getContentRoot();
  const [articlePaths, videoPaths] = await Promise.all([
    listMarkdownFilesRecursively(path.join(contentRoot, "articles")),
    listMarkdownFilesRecursively(path.join(contentRoot, "videos")),
  ]);

  const candidates = await Promise.all([
    ...articlePaths.map(async (fullPath) => ({
      type: "article" as const,
      item: await readContentFile("article", fullPath),
    })),
    ...videoPaths.map(async (fullPath) => ({
      type: "video" as const,
      item: await readContentFile("video", fullPath),
    })),
  ]);

  const scored = candidates
    .filter(({ item }) => item.category === category)
    .map(({ type, item }) => {
      const titleScore = scoreMatch(item.title, query) * 3;
      const summaryScore = scoreMatch(item.summary ?? "", query) * 2;
      const contentScore = scoreMatch(item.content, query);
      const score = titleScore + summaryScore + contentScore;
      return { type, slug: item.slug, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map(({ type, slug }) => ({ type, slug }));
}
