import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  FormationContentItem,
  FormationContentMeta,
  FormationContentType,
} from "../types/formation";

const CONTENT_ROOT = path.join(process.cwd(), "content", "formation");

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

  return {
    type,
    slug: typeof data.slug === "string" ? data.slug : slugFromFilename,
    title,
    category,
    difficulty,
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

export async function getFormationIndex(): Promise<FormationContentMeta[]> {
  const articlesDir = path.join(CONTENT_ROOT, "articles");
  const videosDir = path.join(CONTENT_ROOT, "videos");

  const [articlePaths, videoPaths] = await Promise.all([
    listMarkdownFilesRecursively(articlesDir),
    listMarkdownFilesRecursively(videosDir),
  ]);

  const items = await Promise.all([
    ...articlePaths.map((fullPath) => readContentFile("article", fullPath)),
    ...videoPaths.map((fullPath) => readContentFile("video", fullPath)),
  ]);

  const metas: FormationContentMeta[] = [
    ...items.map(({ content: _c, ...meta }) => meta),
  ];

  metas.sort((a, b) => a.title.localeCompare(b.title));
  return metas;
}

export async function getFormationContentBySlug(
  type: FormationContentType,
  slug: string,
): Promise<FormationContentItem | null> {
  const dir = path.join(
    CONTENT_ROOT,
    type === "article" ? "articles" : "videos",
  );

  const paths = await listMarkdownFilesRecursively(dir);
  for (const fullPath of paths) {
    const item = await readContentFile(type, fullPath);
    if (item.slug === slug) return item;
  }

  return null;
}
