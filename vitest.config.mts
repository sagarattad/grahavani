import { defineConfig } from "vitest/config";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = import.meta.dirname;

// Tests that read raw Kundlit responses need tests/fixtures/kundlit, which is not
// published (Kundlit's terms restrict republishing their content). Without it,
// those tests are skipped; save your own with scripts/save-fixture.mjs.
const haveFixtures = existsSync(path.join(root, "tests/fixtures/kundlit"));
function fixtureTests(dir: string): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return e.name === "generated" ? [] : fixtureTests(rel);
    return /\.test\.tsx?$/.test(e.name) && readFileSync(path.join(root, rel), "utf8").includes("tests/fixtures") ? [rel] : [];
  });
}
const skipped = haveFixtures ? [] : ["lib", "app", "components"].flatMap(fixtureTests);
if (skipped.length) console.warn(`No tests/fixtures/kundlit: skipping ${skipped.length} test files that need Kundlit responses.`);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root),
      // "server-only" throws outside Next.js; tests import server modules directly.
      "server-only": path.resolve(root, "tests/server-only-stub.ts"),
    },
  },
  test: { environment: "node", include: ["**/*.test.ts", "**/*.test.tsx"], exclude: ["node_modules/**", ...skipped] },
});
