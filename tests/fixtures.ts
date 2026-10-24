import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { janamKundaliResponse, kaalSarpResponse, manglikResponse, milanResponse } from "../lib/kundlit-schemas";

const DIR = path.join(__dirname, "fixtures", "kundlit");
const read = (f: string) => JSON.parse(readFileSync(path.join(DIR, f), "utf8"));
const files = (prefix: string) => readdirSync(DIR).filter((f) => f.startsWith(prefix));

export const rawFixture = read;

export function loadKundliFixtures() {
  return files("janam-kundali-").map((file) => ({ file, ...janamKundaliResponse.parse(read(file)) }));
}

export function loadMilanFixtures() {
  return files("milan-").map((file) => ({ file, ...milanResponse.parse(read(file)) }));
}

export function loadManglikFixtures() {
  return files("manglik-").map((file) => ({ file, ...manglikResponse.parse(read(file)) }));
}

export function loadKaalSarpFixtures() {
  return files("kaal-sarp-").map((file) => ({ file, ...kaalSarpResponse.parse(read(file)) }));
}
