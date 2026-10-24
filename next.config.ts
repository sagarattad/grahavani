import type { NextConfig } from "next";
// Result pages hold birth details: keep them out of search engines and never
// leak their unguessable URLs through the Referer header.
const privateHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Referrer-Policy", value: "no-referrer" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The PDF route reads its font files at runtime; make sure Vercel bundles them.
  outputFileTracingIncludes: { "/api/pdf/**": ["./lib/pdf/fonts/**"] },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    // ":slug((?!new$).*)" skips the public /…/new form pages.
    return ["/kundli/:slug((?!new$).*)", "/manglik/:slug((?!new$).*)", "/milan/:slug((?!new$).*)", "/my"].map((source) => ({
      source,
      headers: privateHeaders,
    }));
  },
};

export default nextConfig;
