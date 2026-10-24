// Prisma CLI config. Migrations use the DIRECT (non-pooled) connection;
// the app itself uses the pooled DATABASE_URL (see lib/db.ts).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Don't run `prisma migrate dev` against the local `prisma dev` server: it maps
  // every database name to one database, so the shadow-DB reset wipes real data.
  // Create migrations with `prisma migrate diff` instead (see README).
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
});
