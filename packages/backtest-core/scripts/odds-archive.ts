import { DuckDbOddsArchive } from "../src";

/**
 * The archived odds months for a replay, when ODDS_ARCHIVE_DIR points at a
 * local copy of the `evcore-odds-archive` bucket (docs/exploitation.md).
 * Without it, prices before the close of an archived month are missing:
 * say so in the report.
 */
export async function oddsArchiveFromEnv(): Promise<DuckDbOddsArchive | null> {
  const dir = process.env.ODDS_ARCHIVE_DIR;
  if (!dir) {
    console.warn(
      "ODDS_ARCHIVE_DIR not set: archived months read from the base only (closing, opening and latest prices)",
    );
    return null;
  }
  return DuckDbOddsArchive.open(dir);
}
