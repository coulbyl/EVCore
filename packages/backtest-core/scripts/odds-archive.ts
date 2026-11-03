import { DuckDbOddsArchive, PointInTimeLoader } from "../src";

/**
 * The replay's loader, with the archived odds months when ODDS_ARCHIVE_DIR
 * points at a local copy of the `evcore-odds-archive` bucket
 * (docs/exploitation.md). Without it, prices before the close of an
 * archived month are missing: say so in the report. `close` releases the
 * archive.
 */
export async function loaderFromEnv(): Promise<{
  loader: PointInTimeLoader;
  close: () => void;
}> {
  const dir = process.env.ODDS_ARCHIVE_DIR;
  if (!dir) {
    console.warn(
      "ODDS_ARCHIVE_DIR not set: archived months read from the base only (closing, opening and latest prices)",
    );
    return { loader: new PointInTimeLoader(), close: () => undefined };
  }
  const archive = await DuckDbOddsArchive.open(dir);
  return {
    loader: new PointInTimeLoader(undefined, archive),
    close: () => archive.close(),
  };
}
