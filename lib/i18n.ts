// Minimal translation helper. All UI text lives in messages/<locale>.json.
// To add Hindi: create messages/hi.json with the same keys, add it below, and
// choose the locale per request (e.g. from a cookie).
import en from "@/messages/en.json";

const MESSAGES = { en } as const;
export type Locale = keyof typeof MESSAGES;
export const DEFAULT_LOCALE: Locale = "en";

type Tree = { [k: string]: string | Tree };

export function getT(namespace?: string, locale: Locale = DEFAULT_LOCALE) {
  return (key: string, vars?: Record<string, string | number>): string => {
    const path = (namespace ? `${namespace}.${key}` : key).split(".");
    let node: string | Tree | undefined = MESSAGES[locale] as Tree;
    for (const p of path) node = typeof node === "object" ? node[p] : undefined;
    if (typeof node !== "string") return path.join("."); // missing key: show it, never crash
    return vars ? node.replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? `{${v}}`)) : node;
  };
}
