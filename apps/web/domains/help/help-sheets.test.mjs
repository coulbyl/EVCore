// Lancé par `pnpm --filter web test:unit`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HELP_SLUGS, helpSheets } from "./help-sheets.ts";

// 09 § 3: one screen, 150 words at most, one example with figures, one
// link to the screen it is about — in both languages.
for (const locale of ["fr", "en"]) {
  test(`the help sheets keep their rules (${locale})`, () => {
    const sheets = helpSheets(locale);
    assert.deepEqual(
      sheets.map((s) => s.slug),
      [...HELP_SLUGS],
    );
    for (const sheet of sheets) {
      const words = [sheet.title, ...sheet.paragraphs, sheet.example]
        .join(" ")
        .split(/\s+/)
        .filter(Boolean).length;
      assert.ok(words <= 150, `${sheet.slug}: ${words} words`);
      assert.match(
        sheet.example,
        /\d/,
        `${sheet.slug}: an example with figures`,
      );
      assert.match(
        sheet.link.href,
        /^\/[a-z]/,
        `${sheet.slug}: an in-app link`,
      );
    }
  });
}
