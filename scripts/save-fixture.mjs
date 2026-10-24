// Saves one raw Kundlit response as a local test fixture (tests/fixtures/kundlit,
// not published). The test loaders pick files by prefix: janam-kundali-, dasha-,
// manglik-, kaal-sarp-, milan-.
//
//   node scripts/save-fixture.mjs <endpoint> <file.json> '<request body JSON>'
//   node scripts/save-fixture.mjs janam-kundali janam-kundali-1990-01-15-raipur.json \
//     '{"birth_date":"1990-01-15","birth_time":"14:30","latitude":21.2514,"longitude":81.6296,"timezone":"Asia/Kolkata"}'
//
// Endpoints: janam-kundali, dasha, manglik, kaal-sarp, kundli-milan (see lib/kundlit.ts for bodies).
// Use test births only, never a real person's details.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const [endpoint, file, body] = process.argv.slice(2);
if (!endpoint || !file || !body) {
  console.error("Usage: node scripts/save-fixture.mjs <endpoint> <file.json> '<request body JSON>'");
  process.exit(1);
}
const res = await fetch(`https://kundlit.com/api/astro/${endpoint}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(JSON.parse(body)),
});
if (!res.ok) {
  console.error("Kundlit returned", res.status, await res.text());
  process.exit(1);
}
const dir = path.join(import.meta.dirname, "..", "tests", "fixtures", "kundlit");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, file), JSON.stringify(await res.json(), null, 2));
console.log(`Saved tests/fixtures/kundlit/${file}`);
