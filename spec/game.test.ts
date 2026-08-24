import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Turns crit-5 ("A game")'s published spec into checks. Run `pnpm build`
// first (the `check` script does). Whether a stranger actually reaches an
// ending inside five minutes, and whether a move is possible at all, is the
// crit's job to play and judge -- these two lines are the only mechanically
// checkable ones; see the published spec for the rest.
const DIST = resolve("dist");

function filesWithExt(ext: string, dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesWithExt(ext, path);
    return entry.name.endsWith(ext) ? [path] : [];
  });
}

const htmlDocs = filesWithExt(".html").map(
  (path) => new JSDOM(readFileSync(path, "utf8")).window.document,
);

// Phrases that stand in for a how-to-play modal, page or aside -- the spec
// asks for none of it, on screen or off.
const INSTRUCTIONAL_PHRASES = [
  "how to play",
  "instructions",
  "tutorial",
  "controls:",
  "click to start",
  "press space",
  "use the arrow keys",
  "use arrow keys",
];

describe("teaches itself -- no instructions, on screen or off", () => {
  it("has no how-to-play text anywhere in the shipped page", () => {
    for (const doc of htmlDocs) {
      const text = doc.body.textContent?.toLowerCase() ?? "";
      for (const phrase of INSTRUCTIONAL_PHRASES) {
        expect(
          text.includes(phrase),
          `found "${phrase}" in the built page -- the spec asks for no instructions anywhere, on screen or off`,
        ).toBe(false);
      }
    }
  });

  it("the opening screen has something to act on", () => {
    for (const doc of htmlDocs) {
      // Scoped to <main>, not the whole document -- the starter's nav link is
      // always focusable and would make this pass before any game exists.
      const main = doc.querySelector("main");
      const focusable = main?.querySelectorAll(
        'button, a[href], input, select, textarea, canvas, [tabindex]:not([tabindex="-1"])',
      );
      expect(
        focusable?.length ?? 0,
        "no focusable or interactive element found inside <main> -- an opening screen with nothing to click, press or tab to can't invite a first move",
      ).toBeGreaterThan(0);
    }
  });
});

// The spec's other mechanically-checkable line -- "one rule of the game has
// a focused automated test" -- lives in spec/rules.test.ts: moving during
// darkness brings the ghost closer, and it ending the game (caught) or
// reaching the exit (escaped) are both covered there too. Whether play can
// actually be lost, and whether a stranger reaches an ending in five minutes
// without instructions, is the crit's job to play and judge -- see the
// published spec.
