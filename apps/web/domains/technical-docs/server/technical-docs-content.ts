import { promises as fs } from "node:fs";
import path from "node:path";
import type { TechnicalDoc, TechnicalDocSummary } from "../types/technical-docs";

const CONTENT_DIR = path.join(
  process.cwd(),
  "content",
  "technical-docs",
);

// Ordre d'affichage explicite — le préfixe numérique du fichier ne sert qu'à
// ça, il n'apparaît jamais dans l'URL (slug = nom de fichier sans préfixe).
const FILES = [
  "00-apercu.md",
  "01-architecture.md",
  "02-backend.md",
  "03-prediction-engine-channels.md",
  "04-frontend-web.md",
  "05-workers.md",
  "06-packages-database.md",
  "07-etat-avancement.md",
] as const;

function slugFromFilename(filename: string): string {
  return filename.replace(/^\d+-/, "").replace(/\.md$/, "");
}

function titleFromContent(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? fallback;
}

export async function listTechnicalDocs(): Promise<TechnicalDocSummary[]> {
  return Promise.all(
    FILES.map(async (filename, order) => {
      const raw = await fs.readFile(path.join(CONTENT_DIR, filename), "utf8");
      const slug = slugFromFilename(filename);
      return { slug, title: titleFromContent(raw, slug), order };
    }),
  );
}

export async function getTechnicalDocBySlug(
  slug: string,
): Promise<TechnicalDoc | null> {
  const filename = FILES.find((entry) => slugFromFilename(entry) === slug);
  if (!filename) return null;

  const order = FILES.indexOf(filename);
  const content = await fs.readFile(path.join(CONTENT_DIR, filename), "utf8");
  return { slug, title: titleFromContent(content, slug), order, content };
}
