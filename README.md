# Grahavani

Free, mobile-first Vedic astrology (Parashari Jyotish): Kundli with North
Indian D1/D9 charts, Ashtakoot Gun Milan, Manglik Dosha, and plain-language AI
readings. See [PLAN.md](PLAN.md) for the full design.

- Calculations: the free [Kundlit](https://kundlit.com) API, server-side only, all in `lib/kundlit.ts`.
- Stack: Next.js 16 on Vercel Hobby, Supabase Postgres (free) with Prisma 7, OpenAI via the AI SDK.
- Non-commercial only while on Vercel Hobby: no ads, no payments.

## Run it on your computer

```bash
npm install
npx prisma dev -n grahavani --detach   # local Postgres; prints a postgres:// URL
cp .env.example .env                   # put that URL in DATABASE_URL and DIRECT_URL
npx prisma migrate deploy              # creates the tables (never `migrate dev`, see below)
npm run dev                            # http://localhost:3000
```

The `.env.example` Turnstile keys are Cloudflare's always-pass test keys.
Without `OPENAI_API_KEY`, everything works except AI readings and questions.
Without the Google keys, login is hidden. Set `ALLOWED_EMAILS` (with the Google keys) to make the
whole site private: only those Google accounts can sign in, everyone else gets the sign-in page.

| Command | What it does |
|---|---|
| `npm test` | Unit tests: chart placement vs the API, glossary coverage, AI validator, Kundlit client (429 handling) |
| `npm run kundlit:smoke` | One live Kundlit call; prints Lagna, Moon and current Dasha |
| `npm run build` | Production build |

### Test fixtures (not in this repository)

Many tests read saved Kundlit API responses from `tests/fixtures/kundlit/`. They are not
published, because Kundlit's terms restrict republishing their content. Without them, `npm test`
skips those test files and says so. To run everything, save your own responses for test births
(never a real person's details):

```bash
node scripts/save-fixture.mjs janam-kundali janam-kundali-1990-01-15-raipur.json '{"birth_date":"1990-01-15","birth_time":"14:30","latitude":21.2514,"longitude":81.6296,"timezone":"Asia/Kolkata"}'
```

File names must start with `janam-kundali-`, `dasha-`, `manglik-`, `kaal-sarp-` or `milan-`.
Some tests check exact values from the original fixtures, so with different births a few of them
will need their expected values updated.

### Changing the database schema

Don't use `prisma migrate dev` with the local `prisma dev` server: it maps every database
name to one database, and Prisma's shadow-database reset wipes your local data. Instead:

```bash
git show HEAD:prisma/schema.prisma > old.prisma
npx prisma migrate diff --from-schema old.prisma --to-schema prisma/schema.prisma --script
```

Save the output as `prisma/migrations/<timestamp>_<name>/migration.sql`, apply it to the local
database with any SQL client, and run `npx prisma generate`. Production applies it with
`npm run db:migrate` (`prisma migrate deploy`).

## Where things are

| Path | What |
|---|---|
| `lib/kundlit.ts`, `lib/kundlit-schemas.ts` | The only Kundlit code: calls, limiter, Zod schemas that strip bulky fields |
| `lib/glossary.ts` | Every Jyotish term and spelling |
| `lib/cache.ts` | Shared caches: chart / Manglik per birth, Milan per couple |
| `lib/rateLimit.ts` | Postgres-backed limits shared by all serverless instances |
| `lib/chart/northIndian.ts` | Diamond-chart house placement (tested against the API) |
| `lib/ai/` | Prompts, facts builder, output schemas, validator, streaming |
| `config/ai.ts` | Model names, settings and prices |
| `messages/en.json`, `lib/i18n.ts` | UI text (add `hi.json` for Hindi later) |
| `prisma/schema.prisma` | Database tables |
| `docs/crosscheck.md` | Phase 9 Gun Milan comparison with other sites |

## Deploy (all free tiers)

1. **Supabase**: create a project (Mumbai region). Under Project Settings → Data API, **turn the Data API off**
   (the app uses Prisma only). Copy the *Transaction pooler* URL (port 6543, add `?pgbouncer=true`) into
   `DATABASE_URL` and the *Session pooler* URL (port 5432) into `DIRECT_URL`.
   Then run `npx prisma migrate deploy` once from your computer with those values in `.env`.
2. **Cloudflare Turnstile**: add a widget for your domain and use its real site key and secret.
3. **Google login** (optional): Google Cloud Console → Credentials → OAuth client (Web). Redirect URI:
   `https://<your-domain>/api/auth/callback/google`. Generate `AUTH_SECRET` with `npx auth secret`.
4. **OpenAI**: create a key and set a **hard monthly budget** in the OpenAI dashboard (start at $15).
   Confirm the model names and prices in `config/ai.ts`.
5. **Vercel**: import the GitHub repo, add every variable from `.env.example` (with a random `CRON_SECRET`
   and `IP_HASH_SALT`), deploy. `vercel.json` adds the daily cron (keep-alive and 12-month cleanup).
6. **GitHub**: set the repository variable `SITE_URL` for the weekly backup keep-alive workflow.
7. Before going public, work through the pre-launch checklist in PLAN.md §7 Phase 14 — including
   emailing Kundlit to confirm production use is OK.

## Licence

[MIT](LICENSE). Astrological calculations come from the [Kundlit](https://kundlit.com) API and are subject to Kundlit's own terms.
