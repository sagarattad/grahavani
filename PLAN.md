# Grahavani — Build Plan

A mobile-first Vedic astrology (Parashari Jyotish) web app: Kundli, Kundli Milan (Ashtakoot Gun Milan), Manglik Dosha check, and AI explanations in plain language.

- **Calculations:** the free Kundlit REST API only. We never calculate positions, houses, dasha dates or scores ourselves.
- **Hosting:** free tiers only. The only paid item is OpenAI usage.
- **Charts:** North Indian (diamond) only. No regional variants.
- **Status:** plan only. No code has been written yet.

Decisions already made:

| Topic | Decision |
|---|---|
| App name | **Grahavani** |
| Birth place | Free place search with Open-Meteo Geocoding. The user picks from a list, and we send lat/lon/timezone to Kundlit. |
| Gender options | Male / Female only, everywhere. Gun Milan uses "Boy" and "Girl" slots. |
| Data retention | Anonymous charts and matches not opened for 12 months are deleted automatically. Saved items under "My charts" are kept until the user deletes them. |

---

## 0. What I verified (22 Oct 2026)

- **Spec read:** I fetched and read `https://kundlit.com/api/astro/openapi.json` (OpenAPI 3.1, 18 POST endpoints).
- **No auth, open CORS:** Kundlit needs no authentication and sets CORS to `*`. We still call it from the server only.
- **Rate limits are per IP:**

  | Endpoint | Limit |
  |---|---|
  | `janam-kundali` | **20/min** |
  | `manglik`, `kundli-milan`, `ashtakoot`, `dasha`, `navamsa` | **30/min** |
  | `panchanga` | 60/min |

  A `429` response includes a `Retry-After` header (seconds). Successful responses carry **no** rate-limit headers, so we can't see how much quota is left.
- **Response bodies are not documented** in the spec ("shape is documented on the linked tool page"). The fields listed in §1 come from **one live call to each endpoint**: janam-kundali, dasha, manglik and kundli-milan all returned HTTP 200.
- **Every result includes an `attribution` object**, for example:
  ```json
  {"source":"kundlit.com","tool":"Kundli Milan",
   "url":"https://kundlit.com/kundli-milan?utm_source=llm&utm_medium=api",
   "citation":"Data computed by Kundlit (kundlit.com) - Swiss Ephemeris, Lahiri ayanamsa. Please credit kundlit.com with a link when presenting these results."}
  ```
- **Engine:** Swiss Ephemeris, **Lahiri ayanamsa**, whole-sign houses. I checked that every `graha.house` equals `(sign_num − lagna.sign_num) mod 12 + 1`.
- **Supported dates:** birth years 1200–2400. Birth time is `HH:MM` only (no seconds).

Test input used (the spec's own example, not a real person): 1990-01-15, 14:30, Raipur (21.2514, 81.6296), Asia/Kolkata. For Milan, person B was 1992-06-21, 07:45, Delhi.

---

## 1. Kundlit endpoints per feature

All Kundlit calls go in **`lib/kundlit.ts`** and nowhere else. That file:
- validates each response with Zod,
- strips bulky fields,
- returns our own typed objects,

so the provider can be swapped later. The browser never calls Kundlit.

### 1.1 Kundli → `POST /api/astro/janam-kundali` (20/min)

**Input**

```json
{ "birth_date": "1990-01-15", "birth_time": "14:30",
  "latitude": 21.2334, "longitude": 81.6333, "timezone": "Asia/Kolkata" }
```

We send lat/lon/timezone from our place picker. We do **not** send the free-text `place` field, because we already resolved the place.

**Response fields we use** (top level: `resolved`, `chart`, `attribution`):

| Path | Example | Used for |
|---|---|---|
| `chart.lagna.{sign, sign_num, deg_in_sign, longitude, nakshatra, nakshatra_num, pada, lord}` | Vrishabha, 2, 18.11, Rohini, 4, 3, Venus | Lagna details, D1 house 1, boundary note |
| `chart.lagna.lagna_confidence_minutes` | 49.2 | Undocumented. We record it but don't use it at launch. |
| `chart.grahas[]` (9 items: Sun…Ketu) `.{name, sign, sign_num, deg_in_sign, longitude, nakshatra, nakshatra_num, pada, house, retrograde, combust, dignity}` | Mars, Vrishchika, 26.1°, Jyeshtha-3, house 7, own | Planet table, D1 chart |
| `chart.grahas[].navamsha.{sign, sign_num, lord}`, `.vargottama` | Mars → Kumbha | D9 chart |
| `chart.navamsha_lagna.{sign, sign_num, lord}` | Mithuna, 3 | D9 house 1 |
| `chart.bhavas[]` (12) `.{num, sign, sign_num, lord, occupants[]}` | 9 → Makara [Sun, Venus, Rahu] | Unit-test oracle for the chart drawing |
| `chart.vimshottari.birth.{mahadasha.{lord, balance_years, balance_ymd}, antardasha}` | Venus, 6y 8m 7d | "Dasha balance at birth" |
| `chart.vimshottari.current.{as_of, mahadasha, antardasha, pratyantardasha}.{lord, start, end}` | Rahu / Saturn / Mars, ending 2026-11-10 | Current dasha card |
| `chart.vimshottari.timeline[]` (9 MDs) `.{lord, start, end}` | Venus 1990→1996 … | Full Vimshottari timeline |
| `chart.functional.{house_lords, yogakarakas, functional_benefics, functional_malefics}` | | AI facts only |
| `chart.yogas[].{name, category, claim, participants}` | Ruchaka · mahapurusha · "Mars in Vrishchika (own) in the 7th house…" | Yogas list. This also includes *Bhanga* (cancellation) items. |
| `attribution` | | Shown under the result |

**Fields we strip before storing:**
- `yogas[].citations`: about **389 KB of the 403 KB** chart.
- `transit`: depends on today's date, so caching it would make it stale.
- `strength_components`, `dashamsha`, `aspect_*`, `avastha`, and the null blocks: `jaimini`, `yogini`, `vimshottari_6level`, `vargas`, `cross_system_claims`.

After stripping, a chart is about **12 KB of JSON**.

**One call covers D1, D9 and dasha.** The janam-kundali response already includes navamsha and Vimshottari, so a new Kundli costs **one** Kundlit call. We don't call `/navamsa` or `/dasha` at creation.

### 1.2 Dasha refresh → `POST /api/astro/dasha` (30/min)

- **Input:** the same birth fields as 1.1.
- **Response:** `result.{birth, current{asOf, mahadasha, antardasha, pratyantardasha}, timeline[]}`.
- **Why we need it:** `current` is "as of the moment of the call", so a cached chart goes stale.
- **Rule:** when a Kundli page opens and the cached `current.pratyantardasha.end` is in the past, call `/dasha` once and update `birth_charts.dasha_current`. We never work out dasha periods in code.

### 1.3 Manglik → `POST /api/astro/manglik` (30/min)

**Input:** `birth_date`, `birth_time`, `latitude`, `longitude`, `timezone`. All are required; this endpoint has no free-text place field.

**Response** (complete, 575 bytes):

```json
{"manglik":true,"severity":"mild","ascendant_check":true,"moon_check":true,"venus_check":false,
 "cancellations":["Mars in own sign (Vrishchika)"],
 "remedies":["Recite Hanuman Chalisa on Tuesdays", "..."],
 "attribution":{...}}
```

How we show it:
- **Checks:** "From Lagna ✓ / From Chandra (Moon) ✓ / From Shukra (Venus) ✗".
- **Remedies:** shown under the heading **"Traditional remedies"**.
- **Severity:** only `"mild"` was seen so far. Other values get mapped in the glossary as we find them, with a title-case fallback.

### 1.4 Gun Milan → `POST /api/astro/kundli-milan` (30/min)

**Input:**

```json
{ "person_a": { "...birth fields + lat/lon/tz", "gender": "male" },
  "person_b": { "...", "gender": "female" } }
```

We always send the Boy as `person_a` and the Girl as `person_b`. `gender` must be `male` or `female`.

**Response:**
- `koots[]` (8 items, already in standard order), each with: `koot`, `max_points`, `earned`, `passed`, `dosha`, `cancelled_by`, `skipped`, `skip_reason`, `claim.claim`. For example, `claim.claim` reads "Gana koot: manushya/rakshasa (1.0/6)".
- `total_36` (e.g. 19)
- `verdict` (e.g. `"acceptable"`)
- `attribution`

**Fields we strip:** `claim.{citations, rule_id, confidence, supporting_rule_ids, participants, name, category}`.

**Not seen yet:** our test couple had no Nadi or Bhakoot Dosha, so we haven't seen what `dosha` and `cancelled_by` look like when filled in. Phase 9 records these with couples that do have the doshas.

**`/ashtakoot` is the same contract** as `/kundli-milan`. We use only `/kundli-milan`.

### 1.5 Cost of a new Gun Milan

A match with two new people needs 5 calls:

| Call | Count |
|---|---|
| janam-kundali | 2 |
| manglik | 2 |
| kundli-milan | 1 |

People already in the cache cost 0. `janam-kundali` (20/min) is the bottleneck, so our limiter allows at most **~7 brand-new matches per minute** across all users.

### 1.6 What Kundlit does NOT provide, and how we handle each gap

| Gap | How we handle it |
|---|---|
| No chart images | We draw the North Indian D1 and D9 as our own SVG (§5). |
| No list of matching places. Free text resolves to one result only, and `resolved.displayName` is just the coordinates when we send lat/lon. | **Open-Meteo Geocoding** (free, no key). For example, "Raipur" returns 5 Indian Raipurs with state and IANA timezone. The user picks one. |
| Milan returns no Manglik result | We call `/manglik` for both people (cached per birth) and display both. |
| Milan returns no Moon details for either person | We take each Moon's longitude from that person's cached Kundli, for the nakshatra-boundary note. |
| Antardasha/Pratyantar lists for non-current Mahadashas | We show the MD timeline plus the current MD/AD/PD only. A full AD/PD tree is a later item, only if a provider supplies it. We don't calculate it. |
| "Current" dasha goes stale | We refresh it through `/dasha` when the cached Pratyantar has ended (§1.2). |
| No response schema and no versioning | Our own Zod schemas (unknown extra fields allowed). Missing required fields cause a logged `kundlit_schema_drift` error and a friendly error page. Fixture tests use saved real responses. |
| Graha names in English ("Sun"); koot spelled "Vasya"; verdict values not documented | A single glossary file maps API strings to our spellings (Surya, Vashya…). Unknown values fall back to title case, and a test flags them. |
| No Hindi output | The glossary has `en` and `hi` labels. AI output language is a parameter. |
| No "birth time unknown" mode; time is HH:MM only | Birth time is required at launch. "Time unknown" is a later item. |
| No SLA, no API key, no remaining-quota headers | Our own limiter (§3, Phase 6), aggressive caching, and a pre-launch email to Kundlit. |
| Yoga `claim` text is technical English | We show the yoga name, category and a short line. The AI explains the rest. |

---

## 2. Tech stack (all free tiers)

| Piece | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | The most popular React framework, runs natively on Vercel, and AI assistants know it best. |
| Hosting | **Vercel Hobby** | Free, deploys on git push, has cron. **Non-commercial use only**, so no ads, payments or paid features while on Hobby. |
| Database | **Supabase Postgres (free)** | Free managed Postgres with a simple dashboard. |
| ORM | **Prisma** | One readable schema file, easy migrations, well known by AI assistants. |
| Styling/UI | **Tailwind CSS + shadcn/ui** | Fast mobile-first styling with copy-paste components (tabs, cards, accordion). |
| Validation | **Zod** | One tool for form inputs, Kundlit responses and the AI output schema. |
| AI | **OpenAI** through the **Vercel AI SDK** (`ai`, `@ai-sdk/openai`) | `streamObject` and `useObject` stream structured JSON straight into cards. |
| Login | **Auth.js (NextAuth v5) + Google provider + Prisma adapter** | Free, standard way to add Google sign-in to Next.js. |
| Bot protection | **Cloudflare Turnstile** (`@marsidev/react-turnstile`) | Free CAPTCHA alternative, verified on our server. |
| Place search | **Open-Meteo Geocoding API** | Free, no key, returns state and IANA timezone. Free for non-commercial use, which matches our Hobby constraint. |
| i18n | **next-intl** | All UI strings in `messages/en.json` from day one, so adding `hi.json` later is easy. |
| Tests | **Vitest** | Simple, fast unit tests (chart placement, glossary, AI validator, limiter). |
| Scheduled jobs | **Vercel Cron** (1 daily job) | Keeps Supabase awake and runs the retention cleanup. |
| Code hosting | **GitHub (free)** | Vercel deploys from it. |
| Domain | `grahavani.vercel.app` | A custom domain costs money, so it's optional. |

### Free-tier limits and how we design around them

Figures as of Oct 2026. Re-check them on the official pricing pages before launch.

| Limit | Value | Design response |
|---|---|---|
| Vercel Hobby: commercial use | Not allowed | No ads, no payments, no "pro" tier. Moving to Pro is the trigger if this ever changes. |
| Vercel function duration | Hobby max **300 s** (fluid compute) | `export const maxDuration`: **60 s** on routes that call Kundlit, **120 s** on AI routes. AI readings are **streamed** so the page fills in while the function runs. |
| Vercel cron | Daily schedule on Hobby | One daily job (`/api/cron/daily`), protected by `CRON_SECRET`. |
| Supabase: pause after **7 days** inactive | | The daily cron runs `SELECT 1` plus the cleanup, which counts as activity. Backup: a GitHub Actions scheduled workflow pings `/api/health` weekly. |
| Supabase DB size **500 MB** | | Strip bulky fields (§1.1). Store JSON as `jsonb` (Postgres compresses it). Use the 12-month retention cleanup. Show storage on an admin page and warn at 70%. |
| Supabase egress ~5 GB/mo | | Pages are rendered on the server and send small JSON. Fine for the expected scale. |
| Supabase: no automatic backups on free | | The cached results can be recomputed. Monthly manual `pg_dump` of the user tables, kept locally and encrypted. |
| Supabase: 2 projects | | One project for production. Local dev uses the same project with a `dev` schema, or a second free project. |
| Supabase Data API (PostgREST) is exposed by default | | We don't use it. **Disable the Data API** (or enable RLS with no policies on every table) so the public anon key can't read birth data. |

**Storage estimate:**

| Row | Size |
|---|---|
| Stripped chart | ~12 KB JSON → ~5–7 KB on disk after jsonb compression |
| Manglik result | ~0.6 KB |
| Milan result | ~2 KB |
| AI reading | ~5 KB |
| Profile / match / index overhead | ~1 KB each |

A person with a Kundli, Manglik and one reading is **≈ 15–20 KB**. Using ~400 MB of the 500 MB:
- ≈ **20,000–25,000 people with readings**, or
- ≈ **50,000 charts without readings**.

The 12-month retention keeps us well under this.

### Database connections (Prisma on serverless)

- `DATABASE_URL`: the Supabase **pooled** connection (Supavisor transaction mode, port **6543**) with `?pgbouncer=true&connection_limit=1`. The app uses this.
- `DIRECT_URL`: the **direct** connection (port 5432), used only by `prisma migrate`. If your home network has no IPv6, use Supabase's **session pooler** URL (also port 5432), because the direct host is IPv6-only.
- `schema.prisma`: `datasource db { url = env("DATABASE_URL") directUrl = env("DIRECT_URL") }`.

### Environment variables

All server-only. None start with `NEXT_PUBLIC_` except the Turnstile site key.

| Purpose | Variables |
|---|---|
| Database | `DATABASE_URL`, `DIRECT_URL` |
| AI | `OPENAI_API_KEY` |
| Login | `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` |
| Bot protection | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` |
| Cron and hashing | `CRON_SECRET`, `IP_HASH_SALT` |
| App-level AI budget | `AI_MONTHLY_BUDGET_USD` |

### OpenAI cost

- **Models live in config.** `config/ai.ts` holds `{ fullReading: "gpt-6.1-sol", followUp: "gpt-6-luna" }`, plus per-model settings: `temperature: 0.2` where the model supports it, otherwise `reasoningEffort: "low"`.
- **Prices are unconfirmed.** Third-party sites list gpt-6.1-sol at about **$2 / 1M input** and **$10 / 1M output**, and gpt-6-luna at about **$0.10 / $0.50**. I couldn't find OpenAI's own pricing page, so confirm at developers.openai.com/api/docs/pricing before launch. The estimates below use these rates.

**Per-reading estimates:**

| Item | Tokens | Cost |
|---|---|---|
| Full Kundli reading (Sol) | ~4,000 input + ~2,500 output (including low-effort reasoning) | $0.008 + $0.025 ≈ **$0.033 (≈ ₹3)** |
| Gun Milan reading (Sol) | about the same | ≈ **$0.035** |
| Manglik reading (Sol) | ~2,500 input + ~1,200 output | ≈ **$0.017** |
| Follow-up question (Luna) | ~3,000 input + ~300 output | ≈ **$0.0005** |
| One retry after a failed check | | adds up to 1× the cost, rarely |

**Monthly estimate** (with caching, every reading is paid for only once):

| Usage | Cost |
|---|---|
| 300 readings + 1,000 follow-ups | ≈ **$11** |
| 1,000 readings + 3,000 follow-ups | ≈ **$37** |

**Budget limits:**
1. Set a **hard monthly budget in the OpenAI dashboard** for the project. Start at **$15**, and raise it on purpose if needed.
2. Add an app-side guard. A `usage_monthly` row adds up estimated cost from token counts. When it reaches `AI_MONTHLY_BUDGET_USD` (say $12), "Get reading" shows "Readings are paused for this month. All chart data is still available."

---

## 3. Database tables

The design has two layers:
- **Shared calculation caches**, keyed by a birth or a couple. They hold no names and no user id.
- **User-facing rows**, which hold names, slugs and `user_id`.

Two users who enter the same people each get their own link, and both links point to the same cached result.

**Keys:**
- `birth_key` = `sha256("YYYY-MM-DD|HH:MM|lat(4dp)|lon(4dp)|IANA tz")`. 4 decimal places is about 11 m.
- `pair_key` = `sha256(boy_birth_key + "|" + girl_birth_key)`. Order matters.

### Shared caches

| Table | Columns |
|---|---|
| **places** (geocoder cache) | `id`, `provider` ("open-meteo"), `provider_place_id` (unique), `name`, `admin1` (state), `admin2`, `country_code`, `lat`, `lon`, `timezone`, `population`, `created_at`. **Written only from geocoder results, never from user edits.** |
| **birth_charts** | `id`, `birth_key` (unique), `birth_date`, `birth_time`, `lat`, `lon`, `timezone`, `chart` (jsonb, stripped), `dasha_current` (jsonb), `dasha_refreshed_at`, `attribution` (jsonb), `source` ("kundlit"), `fetched_at` |
| **manglik_results** | `id`, `birth_chart_id` (unique FK), `result` (jsonb), `attribution`, `fetched_at` |
| **milan_results** | `id`, `pair_key` (unique), `boy_chart_id` FK, `girl_chart_id` FK, `result` (jsonb, stripped), `attribution`, `fetched_at` |
| **ai_readings** | `id`, `cache_key` (unique = sha256 of `kind \| facts_hash \| language \| prompt_version \| model`), `kind` (kundli / milan / manglik), `facts_hash`, `language`, `prompt_version`, `model`, `output` (jsonb), `input_tokens`, `output_tokens`, `est_cost_usd`, `birth_chart_id` FK or `milan_result_id` FK (cascade delete), `created_at` |

### User-facing

| Table | Columns |
|---|---|
| **users / accounts / sessions** | Standard Auth.js Prisma adapter tables. Google account only. |
| **profiles** (one person's birth details) | `id`, `slug` (unique, 22-char random base62 ≈ 131 bits), `user_id` (nullable), `name`, `gender` (male/female), `birth_date`, `birth_time`, `place_label` (e.g. "Raipur, Chhattisgarh, India"), `place_id` (FK places, nullable), `lat`, `lon`, `timezone`, `place_edited` (bool: true when the user overrode the picked place), `birth_chart_id` FK, `created_via` (kundli / manglik / milan), `last_viewed_at`, `created_at` |
| **matches** | `id`, `slug` (unique), `user_id` (nullable), `boy_profile_id` FK, `girl_profile_id` FK, `milan_result_id` FK, `last_viewed_at`, `created_at` |
| **followups** | `id`, `kind`, `target_slug`, `question`, `answer` (jsonb), `user_id` (nullable), `ip_hash`, `created_at`. Used for the daily cap and audit. |
| **rate_limits** | `bucket` (e.g. `kundlit:janam-kundali`, `ip:<hash>:new-chart`), `window_start`, `count`, PK (`bucket`, `window_start`) |
| **provider_cooldowns** | `endpoint` (PK), `blocked_until`. Set from `Retry-After`. |
| **usage_monthly** | `month` (PK, "2026-10"), `ai_requests`, `input_tokens`, `output_tokens`, `est_cost_usd`, `kundlit_calls` |

### Rules

- **Place corrections.** A user's edit is stored on **their `profiles` row** (`lat/lon/timezone/place_label`, `place_edited = true`). The `places` table is never touched. A different place gives a different `birth_key` and therefore a different cached chart.
- **Delete this chart / match.** This hard-deletes the user's `profiles` / `matches` row right away. A cleanup then removes any shared cache rows (`birth_charts`, `manglik_results`, `milan_results`, `ai_readings`) that **no remaining profile or match points to**.
- **Retention (daily cron).** Delete `profiles` / `matches` where `user_id IS NULL` and `last_viewed_at < now() − 12 months`, then run the same orphan cleanup.
- **IP addresses** are never stored raw. We store `sha256(ip + IP_HASH_SALT)` only.

---

## 4. Pages and screens

All pages are mobile-first: a single column at 360–420 px wide and tap targets of at least 44 px. Every page uses the glossary through a `<Term id="rashi" />` component. It shows "Rashi (Moon sign)" the first time on a page and "Rashi" after that.

All result pages get:
- `robots: noindex, nofollow` meta and an `X-Robots-Tag: noindex` header,
- `Referrer-Policy: no-referrer`, so the slug doesn't leak through outbound links,
- a Kundlit attribution line under each computed block,
- **Share**, **Delete**, and (when logged in) **Save to My charts** buttons.

| Route | What it shows |
|---|---|
| `/` Home | App name and tagline, plus three large cards: **Kundli**, **Kundli Milan (Gun Milan)**, **Manglik Dosha check**. Links to "My charts", the privacy policy and the login button. |
| `/kundli/new` | **Form:** Name, Gender (Male/Female), Birth date (date picker), Birth time (required; help text: "Check the birth certificate or hospital record — even a few minutes matter"), Birth place (search box with the hint "City, State, India" and a dropdown of Open-Meteo matches showing *name, district, state*), and Turnstile. **After a place is picked:** "📍 Raipur, Raipur district, Chhattisgarh, India · Asia/Kolkata (IST) — Wrong place? Edit". Submitting creates a profile and redirects to the slug page. |
| `/kundli/[slug]` | **Header:** name, birth details, resolved place and timezone, and "Wrong place? Edit" (opens the place picker and creates a new chart). **Accuracy note** when Lagna or the Moon is within 1° of a sign boundary. **Tabs: Lagna chart (D1) \| Navamsa (D9)**, drawn as SVG. **Planet table:** Graha, Rashi, Degree (18°06′), Nakshatra-Pada, Bhava, R (retrograde), C (combust). On a phone it scrolls sideways with a sticky Graha column, and tapping a row shows details. **Lagna details:** Rashi, degree, Nakshatra-Pada, lord. **Current Dasha card:** Mahadasha / Antardasha / Pratyantar Dasha with lord and end date, plus the dasha balance at birth. **Vimshottari timeline:** 9 Mahadashas with start and end; the current one is highlighted. **Yogas:** name, category chip, one-line description; Bhanga (cancellation) items shown as linked to their yoga. **AI reading:** a "Get reading" button that streams the cards (Personality, Career, Marriage, Health & wellbeing, Current Dasha, Yogas, Summary). **Follow-up box:** "Ask about this chart", with remaining questions for today shown. Link: "Check Manglik Dosha for this chart". Attribution. |
| `/manglik/new` | The same person form as Kundli. A chart picker is offered if logged in. |
| `/manglik/[slug]` | **Big status:** "Manglik: Yes — Mild" or "Manglik: No". **Checks that triggered:** From Lagna / From Chandra / From Shukra, each ✓/✗. **Cancellations** list. **Traditional remedies** (labelled "Traditional — shared for information; no purchase needed"). AI reading (Manglik). Disclaimer. Attribution. |
| `/milan/new` | Two stacked person sections, **Boy** and **Girl**. Each has name, birth date, time and place, or "Pick from My charts" when logged in. One Turnstile and a "Match Kundlis" button. A progress line ("Calculating Boy's Kundli… Girl's Kundli… Gun Milan…") because a new match can take up to 5 calls. |
| `/milan/[slug]` | See the detailed design below. |
| `/my` | Login required. Lists of "My Kundlis" and "My Matches" with name(s), date and score, plus open and delete buttons. |
| `/privacy` | Privacy policy (DPDP). Covers what we collect; that birth details go to **Kundlit** for calculation and to **OpenAI** (facts only, no names) for readings; that place search text goes to Open-Meteo; Cloudflare Turnstile; 12-month retention; how to delete; contact email. |
| `/about` | What Jyotish calculations are, the data source (Kundlit, Lahiri ayanamsa), and a disclaimer: "for traditional/cultural guidance; not a substitute for professional advice". |
| Error states | "Kundlit is busy — retrying in 20 s" (auto-retry countdown), "Calculation service unavailable — please try again later", "Place not found". |

### Gun Milan result page (`/milan/[slug]`)

Top to bottom on a phone:

1. **Names strip.** "Rahul (Boy) · Priya (Girl)". Tapping it shows both people's birth details and resolved places, each with "Wrong place? Edit".
2. **Score hero.** The largest element on the page.
   - The score: **19 / 36** in very large type, inside a ring that fills 19/36.
   - A verdict badge underneath, taken **straight from the API** (`acceptable` → "Acceptable"). Badge colour is set per verdict in the glossary.
   - A static traditional note in one line: "Traditionally, 18 or more out of 36 is considered acceptable for Gun Milan."
   - A one-line disclaimer: "Gun Milan is one traditional factor among many."
3. **Dosha alerts.** Two cards, always shown side by side (stacked on narrow screens):
   - **Nadi Dosha (8 points):** "No Nadi Dosha" (green), "Nadi Dosha present" (red), or "Nadi Dosha present — cancelled: *reason from `cancelled_by`*" (amber with a ✓ "Cancelled" chip).
   - **Bhakoot Dosha (7 points):** the same three states.
   - A dosha that has been cancelled is never shown in red.
4. **Manglik Dosha for both.** Two mini cards (Boy: "Manglik — Mild" or "Not Manglik", with the checks; Girl: the same), followed by one combined line:
   - Both: "Both are Manglik — traditionally this is considered balancing."
   - One: "Only the Girl is Manglik — see her cancellations above; families traditionally consult further."
   - Neither: "Neither is Manglik."

   This is only a display of the two `/manglik` results. We make no decision of our own.
5. **Ashtakoot table.** All 8 koots in fixed order: Varna (1), Vashya (2), Tara (3), Yoni (4), Graha Maitri (5), Gana (6), Bhakoot (7), Nadi (8). We sort by our own order map, not by the API's order. Each row has:
   - the koot name with its English meaning on first use, e.g. "Gana (temperament)",
   - a mini bar and "1 / 6",
   - ✓ or ✗ (`passed`),
   - a dosha chip (red, or amber when cancelled), or "skipped: *reason*".

   Tapping a row shows "What was compared" in plain words, from `claim.claim` (e.g. "Manushya vs Rakshasa gana"). A total row at the bottom reads **19 / 36**.
6. **Accuracy note.** Shown if either Moon is within 1° of a nakshatra boundary (longitude mod 13°20′ is under 1° or over 12°20′): "Birth time accuracy matters: the Boy's Moon is close to a Nakshatra boundary, so a small time error could change the score."
7. **AI reading.** A "Get reading" button. Cards stream in: Overall, Koot-by-koot, Doshas & cancellations, Manglik for both, Summary. Above them: "Explanation of the computed result — not advice to marry or not."
8. **Follow-up questions** with the daily cap.
9. **Footer:** Kundlit attribution, Share (copy link / WhatsApp), Delete this match, Save.

---

## 5. Drawing the North Indian chart (D1 and D9) as SVG

**Pure data step** (`lib/chart/northIndian.ts`, no React):

```
placeInHouses(ascSignNum, grahas[{ name, signNum, retro, combust }])
  → houses[1..12] = { signNum, grahas[] }
house h has signNum = ((ascSignNum - 1 + h - 1) % 12) + 1
graha goes in house ((signNum - ascSignNum + 12) % 12) + 1
```

- **D1:** `ascSignNum = lagna.sign_num`, and each graha uses its `sign_num`.
- **D9:** `ascSignNum = navamsha_lagna.sign_num`, and each graha uses `navamsha.sign_num`.

This only places the API's own sign numbers into the fixed diamond layout. It isn't an astrological calculation.

**SVG** (`components/NorthIndianChart.tsx`):
- **Lines:** a `viewBox="0 0 400 400"` square, both diagonals, and the inner diamond joining the side midpoints. That makes 12 houses, and their positions are fixed.
- **House order:** House 1 is the top-centre diamond, and houses run **anti-clockwise**: 2 top-left triangle, 3 left-upper, 4 left-centre diamond, 5 left-lower, 6 bottom-left, 7 bottom-centre, 8 bottom-right, 9 right-lower, 10 right-centre, 11 right-upper, 12 top-right.
- **Labels:**
  - Each house shows its **Rashi number** (1–12) near the inner corner, as is standard on Indian sites.
  - Graha short names come from the glossary (Su, Mo, Ma, Me, Ju, Ve, Sa, Ra, Ke). There is a Hindi set for later.
  - "R" marks retrograde and "C" marks combust.
  - House 1 is marked "La" (Lagna).
  - Crowded houses wrap onto two lines, and the font shrinks in houses with 4 or more grahas.
- **Behaviour:** the chart scales to the screen width. It has an accessible `<title>`, plus a hidden text list ("House 1: Vrishabha, no grahas…") for screen readers. Tapping a house highlights its rows in the planet table.

**Unit tests** (`lib/chart/northIndian.test.ts`, Vitest), using 3 saved real janam-kundali responses in `tests/fixtures/kundlit/`. One of them is the 1990-01-15 Raipur chart.
1. For every graha, our D1 house equals the API's `graha.house`.
2. For every house, our D1 `signNum` equals `bhavas[h-1].sign_num`, and our occupant set equals `bhavas[h-1].occupants`.
3. D9: house 1 sign equals `navamsha_lagna.sign_num`, and every graha's D9 house sign equals its `navamsha.sign_num`.
4. All 9 grahas are placed exactly once, in both D1 and D9.
5. Edge cases: a Lagna in Meena (12 → wraparound), and every Lagna 1–12 with a synthetic graha set.

---

## 6. OpenAI prompts and guardrails

**Prompt files:**
- `lib/ai/prompts/system.v1.md`: the shared system prompt below.
- `lib/ai/prompts/{kundli,milan,manglik,followup}.v1.md`: one task prompt per feature.

`PROMPT_VERSION = "v1"` is part of the cache key.

**Facts payload** (built by `lib/ai/facts.ts` from cached rows only):
- **Kundli:** Lagna (Rashi, degree rounded to 0.1°, Nakshatra-Pada, lord); for each graha its Rashi, Bhava, Nakshatra-Pada, retrograde, combust, dignity, D9 Rashi and vargottama; house lords; functional benefics/malefics; yogas (name, category, short claim); current MD/AD/PD with end dates; the MD timeline.
- **Milan:** the 8 koots (name, earned, max, passed, dosha, cancelled_by, short compared text), total, verdict, and both Manglik results. People are labelled "Boy" and "Girl" only.
- **Never included:** names, place names, birth date or birth time. Birth data isn't needed because positions are already computed.
- All names use glossary spellings.
- Requests send `store: false`.

**System prompt (v1):**

```
You are Grahavani's explainer for Vedic astrology (Parashari Jyotish). You explain
already-computed results in clear, warm, plain language for a general Indian audience.

DATA RULES
1. Use ONLY the facts in the JSON block named FACTS. Do not calculate, estimate or
   "correct" anything: no planetary positions, Rashis, Bhavas, Nakshatras, dasha dates,
   koot points, totals or Manglik status beyond what FACTS states.
2. If something is not in FACTS, say it is not part of this chart's computed data.
   Never invent yogas, doshas, aspects, transits, dates or scores.
3. When you mention a graha's Rashi or Bhava, or a koot's points, use exactly the values
   in FACTS. Quote koot points as "earned / max" from FACTS.
4. Refer to people only as "the Boy", "the Girl" or "you". You do not know their names.

TONE AND SAFETY
5. Be balanced and encouraging. Present tendencies as traditional interpretations
   ("traditionally, this placement is associated with..."), never as certain outcomes.
6. No fear-based predictions: never predict or hint at death, accidents, serious illness,
   infertility, divorce, widowhood, separation, financial ruin, or curses. Do not use
   words like "doom", "danger", "fatal" or "bad luck". Describe doshas calmly, and always
   mention any cancellations given in FACTS.
7. No medical, legal, financial or investment advice. In "health & wellbeing", speak only
   about general wellbeing themes and add: "For any health concern, consult a doctor."
8. Never tell anyone to marry or not marry, accept or reject a match, or that a match is
   "good/bad for life". Gun Milan is one traditional factor; the decision belongs to the
   families and individuals.
9. Remedies: mention only the remedies listed in FACTS, label them "traditional", and
   describe them as optional. Never recommend or promote paid pujas, gemstones, yantras,
   astrologer consultations, products or services, and never say a remedy must be bought.
10. Be respectful of all religions, castes, communities, genders and regions. Do not
    rank people or groups. Explain Varna koot only as a traditional temperament grouping,
    not as caste. Avoid gender stereotypes about roles, careers or marriage.

LANGUAGE AND TERMS
11. Write in the language given in LANGUAGE (e.g. "en"). Use the standard Sanskrit/Hindi
    terms exactly as spelled in the GLOSSARY block (Kundli, Lagna, Rashi, Nakshatra,
    Pada, Graha, Bhava, Mahadasha, Antardasha, Pratyantar Dasha, Yoga, Navamsa, Gun Milan,
    Koot, Manglik Dosha, and the Rashi/Nakshatra/Graha names). On first use in your
    answer, add the English meaning in brackets, e.g. "Rashi (Moon sign)", "Surya (Sun)".
12. Short paragraphs, simple words, no jargon without explanation. No headings or
    markdown inside fields; the app renders each field as its own card.

OUTPUT
13. Return only JSON matching the provided schema. Every field is required.
```

**Structured output schemas** (Zod, passed to `streamObject`):

| Kind | Fields |
|---|---|
| **Kundli** | `{ personality, career, marriage, health_wellbeing, current_dasha, yogas, summary }`, each a string of 60–150 words |
| **Milan** | `{ overall, koots: [{ koot, earned, max, explanation }] × 8, doshas_and_cancellations, manglik_both, summary }` |
| **Manglik** | `{ status, what_triggered, cancellations, traditional_remedies, summary }` |
| **Follow-up** (Luna) | `{ answer (≤120 words), out_of_scope: boolean }`. The task prompt adds: "Answer only from FACTS; if the question needs data not in FACTS, or asks for a yes/no on marriage, health, money or legal matters, set out_of_scope = true and explain gently." |

**Code-side check** (`lib/ai/validate.ts`), run after each full response:
1. **Schema:** the response parses with Zod.
2. **Koot points:** in the `koots[]` field, `earned` and `max` must equal the API values for that koot, with all 8 present. In any text, a pattern like `<koot name> … N/M` or "N out of M" within one sentence must match the API values. Any "N / 36" or "N out of 36" must equal `total_36`.
3. **Graha placements:** in each sentence, the patterns "<Graha> in <Rashi>" and "<Graha> in the Nth Bhava/house" (in English or glossary names) must name a pair that exists in FACTS. D9 pairs are accepted only if the sentence mentions Navamsa.
4. **Dasha lords:** any "<Graha> Mahadasha/Antardasha/Pratyantar" must match the current stack or the timeline.
5. **General numbers are ignored:** "8 koots", "36 points", "12 houses", "27 Nakshatras", "9 grahas" and similar don't fail the check.

What happens on the result:
- **Fail:** retry **once**, adding a short note listing what was wrong.
- **Second fail:** don't cache it. The UI drops the streamed text and shows "We couldn't generate a reliable explanation right now. All computed data above is accurate from Kundlit." The data cards stay.

While streaming, cards show a small "checking…" badge. The badge is removed when validation passes.

**Caching and triggers:**
- A reading is generated **only** when the user clicks "Get reading" (after Turnstile). It is first looked up by `cache_key`.
- `facts_hash` = sha256 of the facts JSON with keys in a fixed order. It includes the current dasha, so a new Pratyantar gives a fresh reading the next time someone clicks.

**Follow-up limits:**
- 5 per day per user (logged in) or per IP hash (anonymous), and 10 per day per result page across everyone.
- Turnstile on the question box.
- Answers aren't shared between users. They're stored only for the cap and for audit.

---

## 7. Build phases

Each phase is small and ends with a check. Rate limiting (Phase 6) comes before Manglik and Gun Milan.

### Phase 0: Accounts and an empty app online
- Create free accounts: GitHub, Vercel, Supabase, Cloudflare (Turnstile), Google Cloud (OAuth client), OpenAI (add a key and set the **hard monthly budget** now).
- `create-next-app` (TypeScript, Tailwind, App Router), add shadcn/ui and next-intl with `messages/en.json`, push to GitHub, and import into Vercel.
- **Check:** `https://grahavani.vercel.app` loads on your phone and shows "Grahavani", with the text coming from `en.json`.

### Phase 1: Glossary and Kundlit client (no UI)
- Create `lib/glossary.ts`: Rashis 1–12, Nakshatras 1–27, Grahas (Sun → Surya…), Koots (Vasya → Vashya), verdicts, Manglik severities, and terms with their English meanings. Each entry has `en` and `hi` labels (`hi` can be empty for now). Lookups use **numbers** (`sign_num`, `nakshatra_num`) where possible.
- Create `lib/kundlit.ts`: `getKundli`, `getDasha`, `getManglik`, `getMilan`. It uses `fetch` with a 15 s timeout, Zod schemas, stripping, and attribution pass-through.
- Save 3 real responses as fixtures in `tests/fixtures/kundlit/`.
- **Check:** `npm run kundlit:smoke` prints "Lagna: Vrishabha 18°06′, Moon: Simha, Rohini-3…" for the test birth. `npm test` passes (Zod parses every fixture; every Kundlit string maps to a glossary entry). Searching the code for `kundlit.com` finds it only in `lib/kundlit.ts`.

### Phase 2: Database, caching and keep-alive
- Prisma schema (§3), the pooled and direct URLs, the first migration, and Data API off.
- Create `lib/cache.ts`: `getOrCreateChart(birth)`, which looks up `birth_key` and calls Kundlit only if the chart is missing.
- Add the `/api/cron/daily` keep-alive in `vercel.json`, plus `/api/health`.
- **Check:** creating the same birth twice gives exactly **one** Kundlit call (`usage_monthly.kundlit_calls` goes up by 1). A stored chart row is under 15 KB (`pg_column_size`). Triggering the cron by hand returns 200.

### Phase 3: Place search and Kundli form
- `/api/places?q=` calls Open-Meteo with `countryCode` empty, so places outside India work too, but Indian results are ranked first. Results are saved into `places`.
- Build the form with validation and help text, the resolved-place line, and "Wrong place? Edit".
- **Check:** typing "Raipur" shows all 5 Raipurs with their states. Picking one shows "Asia/Kolkata". Editing the place on one profile leaves the `places` row unchanged (check in the Supabase table view).

### Phase 4: Kundli result page (data only)
- Slug creation, the planet table, Lagna details, current dasha with end dates, the MD timeline, yogas, accuracy notes, attribution, noindex and no-referrer, plus Share and Delete.
- Dasha refresh (§1.2).
- **Check:** for the test birth the page shows Rahu / Saturn / Mars, ending 10 Nov 2026, matching kundlit.com/janam-kundali for the same input. View source shows `noindex`. A chart with the Moon at 29.5° shows the accuracy note. Delete removes the row and the link returns 404.

### Phase 5: North Indian chart (D1/D9)
- `placeInHouses` and its unit tests (§5), the SVG component, and the D1/D9 tabs.
- **Check:** `npm test` passes all placement tests. Visually, the test chart has Ju in house 2 (sign 3), Ke in 3, Mo in 4, Ma in 7, Me and Sa in 8, and Su, Ve and Ra in 9. It reads clearly on a 360 px-wide phone.

### Phase 6: Rate limiting and bot protection (before Gun Milan)
- **Kundlit limiter inside `lib/kundlit.ts`**, shared across all serverless instances through Postgres:
  - **Budgets:** 70% of Kundlit's limits, so **14/min for janam-kundali** and **21/min for the others**.
  - **Slot reservation:** one atomic SQL `INSERT … ON CONFLICT … DO UPDATE SET count = count + 1 WHERE count < limit RETURNING count` per call.
  - **No slot free:** wait if the next minute starts within 8 s. Otherwise return `busy` with `retryAfter`, and the UI shows a countdown and retries automatically.
  - **On 429:** read `Retry-After` and write `provider_cooldowns.blocked_until`. All instances stop calling that endpoint until then. Retry once only if the wait is 8 s or less.
  - **On 502/503 or timeout:** one retry after 2 s, then "service unavailable".
  - **Concurrent duplicates:** two requests for the same `birth_key` are deduplicated by the unique constraint. The second waits for and reads the first.
- **Per-IP caps** (hashed IP): new charts 10/hour, new matches 5/hour, readings 10/day.
- **Turnstile** on every form, on "Get reading" and on the follow-up box. The token is verified on the server through Cloudflare `siteverify`.
- **Check:**
  - A script fires 40 uncached Kundli requests in one minute. Kundlit sees ≤14, the rest get a "busy" response with a retry time, and there are **zero 429s from Kundlit**.
  - A unit test with a mocked 429 + `Retry-After: 30` shows that no calls happen for 30 s.
  - A form POST without a Turnstile token gets a 403.

### Phase 7: Manglik Dosha page
- `/manglik/new` and `/manglik/[slug]`, using the `manglik_results` cache.
- **Check:** the test birth shows "Manglik: Yes — Mild"; checks Lagna ✓, Chandra ✓, Shukra ✗; the cancellation "Mars in own sign (Vrishchika)"; and 3 remedies under "Traditional remedies". A second visit makes 0 Kundlit calls.

### Phase 8: Gun Milan
- The `/milan/new` two-person form (with "Pick from My charts" later, in Phase 12), the progress line, `getOrCreateMilan`, and the full result page (§4).
- **Check:** the spec couple shows **19 / 36**, "Acceptable", and koots 1/1, 0/2, 0/3, 2/4, 0/5, 1/6, 7/7, 8/8 in standard order. Nadi and Bhakoot show "No dosha". Both Manglik cards and the combined line appear. Re-running the same couple makes 0 calls. A couple where one person is already cached makes 3 calls (not 5).

### Phase 9: Cross-check Gun Milan against well-known sites
- Pick **5 couples**: at least one with Nadi Dosha, one with Bhakoot Dosha, one with a cancellation, one with both Manglik, and one with a Moon near a nakshatra boundary. Use made-up or consenting test data.
- Enter each couple by hand in Grahavani and on 2–3 well-known sites (e.g. AstroSage, ProKerala, Drik Panchang, Astrotalk). Use Lahiri ayanamsa where a site offers a choice.
- Record everything in `docs/crosscheck.md`: per couple, each koot's points, the total, the verdict wording, Nadi/Bhakoot dosha and cancellation, and both Manglik results, for every site. Also capture the real shape of `dosha`, `cancelled_by` and `skipped` from these responses and update the Zod schema and glossary.
- **Check:** the table is complete. Every difference has a note on its likely cause (ayanamsa, a different Vashya/Yoni table, half-point rules, which cancellations a site applies, Manglik house rules). Totals within ±1.5 are acceptable. Larger differences get a note on the About page.

### Phase 10: AI reading for Kundli
- The system and task prompts, `facts.ts`, `validate.ts`, `/api/reading` (`maxDuration = 120`, streaming through `streamObject`), the cards UI, caching, and `usage_monthly` cost tracking.
- **Check:**
  - Click "Get reading": cards stream in within a few seconds. A second click (or another browser) loads instantly from the cache, with no OpenAI call in the logs.
  - A unit test feeds the validator a fake response saying "Mars in Mesha", which isn't in the facts, and it fails.
  - The logged request payload contains no name.
  - A manual review of 3 readings finds no fear-based or advice language.

### Phase 11: AI for Milan and Manglik, plus follow-ups
- The Milan and Manglik schemas and prompts, the koot-point check, follow-ups on Luna with caps, and the app-side monthly budget guard.
- **Check:**
  - A validator unit test with a fake "Nadi 0/8" (the API says 8/8) fails, and the UI then shows data only.
  - Asking "Should we marry?" returns a polite `out_of_scope` answer.
  - The 6th question in a day is blocked.
  - Setting `AI_MONTHLY_BUDGET_USD=0` pauses readings.

### Phase 12: Login, My charts, deletion and retention
- Auth.js with Google, "Save to My charts", `/my`, chart picking in the Milan form, and the retention and orphan cleanup in the daily cron.
- **Check:**
  - Everything still works logged out.
  - After logging in, saved items appear in `/my`.
  - Deleting a match removes the cached milan result only when nothing else points to it (tested with two links to the same couple).
  - A test row with `last_viewed_at` 13 months ago is removed by the cron.

### Phase 13: Privacy, polish and multi-language readiness
- The `/privacy` and `/about` pages, footer disclaimers, a Lighthouse mobile check, an accessibility pass (contrast, labels, chart text alternative), and loading and error states.
- Add an empty `hi.json` and a language switch hidden behind a flag, to confirm that no hard-coded strings remain.
- **Check:**
  - Lighthouse mobile scores ≥ 90 for performance and accessibility on `/kundli/[slug]`.
  - With the flag on, switching to `hi` shows translation-key fallbacks only. No English is hard-coded in components (`grep` check).
  - The privacy page names Kundlit, OpenAI, Open-Meteo and Cloudflare.

### Phase 14: Pre-launch checklist
- [ ] **Email Kundlit** (contact via kundlit.com). Describe Grahavani (free, non-commercial, server-side calls, caching, attribution shown, expected volume) and ask them to confirm that production use is OK and what limits apply. Don't launch publicly until they reply.
- [ ] OpenAI hard budget set, and the model names and prices confirmed on OpenAI's pricing page.
- [ ] Supabase: Data API disabled or RLS on all tables; the keep-alive cron seen running for 8+ days.
- [ ] Vercel free-tier limits re-checked; no ads or payments anywhere.
- [ ] Turnstile in production mode, with the domain added.
- [ ] Phase 9 cross-check done and its differences documented.
- [ ] A `pg_dump` backup of the user tables taken.

---

## 8. Risks and how we handle them

| Risk | Impact | Handling |
|---|---|---|
| **Kundlit rate limits** (per IP, shared by all users; janam-kundali only 20/min) | Busy errors at peak | Cache every result for good. Own Postgres limiter at 70% of Kundlit's limits. Global cooldown from `Retry-After`. Per-IP caps and Turnstile. UI countdown with auto-retry. A new Kundli costs 1 call, a new match ≤5. |
| **Vercel IPs are shared** with other Vercel apps that may also call Kundlit | We could hit 429 below our own count | The `Retry-After` cooldown handles it. Mention our usage in the Kundlit email. |
| **Kundlit downtime or shape change** (502/503, no SLA, undocumented responses) | New charts fail; cached ones still work | Cached pages never call Kundlit, except the occasional dasha refresh, which fails quietly and shows the stored dasha with an "as of" date. Zod plus a schema-drift log. `lib/kundlit.ts` is the only file to change if we swap providers. |
| **Kundlit says no to production use** | Can't launch | Ask before launch. The single-file adapter makes a swap possible to another API or a self-hosted Swiss Ephemeris service (would need a new plan). |
| **Wrong place or timezone** | Wrong Lagna and houses | Place picker with state and district, always showing the resolved place and timezone with "Wrong place? Edit". The IANA timezone covers historical offsets (e.g. India's +06:30 war time in 1942–45). Corrections live on the profile only, never in `places`. The 1° boundary notes warn users. |
| **Wrong or approximate birth time** | Lagna, D9 and Milan can change | Birth time required, with help text. Accuracy notes near sign and nakshatra boundaries. "Time unknown" mode later. |
| **Differences from other sites** | User distrust | The Phase 9 cross-check, an About page stating "Lahiri ayanamsa, Swiss Ephemeris, via Kundlit", and known-difference notes. |
| **OpenAI cost runaway** | Bills | Hard budget in the OpenAI dashboard, an app-side monthly guard, generation only on click (behind Turnstile), a cache per facts hash, a daily follow-up cap, and Luna for follow-ups. |
| **AI makes up data or uses harmful wording** | Misinformation or distress | Facts-only prompt with guardrails, a structured schema, a code-side validator with one retry and then a data-only fallback, no names sent, and manual review of sample readings in Phases 10–11. |
| **Model names or parameters change** (e.g. temperature not supported) | Errors | Model names and per-model params live in `config/ai.ts`. A fallback to `reasoningEffort: "low"`. |
| **Supabase pauses after 7 days idle** | App offline | Daily Vercel cron query plus a weekly GitHub Actions ping. |
| **500 MB database limit** | Writes fail | Stripping (~12 KB per chart), 12-month retention, orphan cleanup, a storage display with a 70% warning. Capacity is ~20k+ people with readings. |
| **Vercel function time limit** | Cut-off readings | Streaming, `maxDuration` 60 s / 120 s, a 15 s timeout per Kundlit call. |
| **Vercel Hobby is non-commercial** | Terms violation | No ads, payments or upsells. Any money plan means moving to Vercel Pro and reviewing Open-Meteo's terms. |
| **Supabase anon key exposes tables** | Birth data leak | Data API disabled or RLS on everywhere. Prisma connects server-side only. |
| **Privacy (DPDP Act)** | Legal and trust | Unguessable 131-bit slugs, noindex, no-referrer, a Delete action, 12-month retention, hashed IPs, no names to OpenAI, `store: false`, and a clear privacy policy naming every processor. |
| **Share links forwarded widely** | Others see birth details | The Delete action (by anyone holding the link at launch; owner-only once saved to an account). A share dialog warns "anyone with this link can view it". |
| **Bots and abuse** | Quota exhaustion | Turnstile on all forms and AI actions, plus per-IP caps. |
| **Free-tier terms change** | Surprise limits | Re-check pricing pages before launch and every quarter. Design choices are listed in §2 so they're easy to revisit. |

---

## Later items (not at launch)

- "Birth time unknown" mode.
- Hindi UI and AI output.
- A full Antardasha/Pratyantar tree for every Mahadasha (only if a provider supplies it).
- A PDF download of the Kundli.
- Other divisional charts.

---

## Implementation notes (22 Oct 2026)

Where the first build differs from this plan, and why:

- **i18n:** a small helper (`lib/i18n.ts` + `messages/en.json`) instead of next-intl. The next-intl plugin needs a native SWC binary that would not load on this machine. Adding Hindi is still just a `messages/hi.json` file.
- **UI kit:** plain Tailwind utilities (`card`, `btn-primary`, `field`… in `app/globals.css`) instead of shadcn/ui. The app needs only tabs, cards and a list.
- **Prompts:** kept in `lib/ai/prompts.ts` (not `.md` files), so they are always bundled on Vercel.
- **Login:** Auth.js with JWT sessions and our own small `users` table, instead of the Prisma adapter's tables.
- **Models:** GPT-6-family models don't accept `temperature`, so `config/ai.ts` uses `reasoningEffort: "low"`.
- **Limiter windows:** 10-second windows (2 calls for janam-kundali, 3 for the others). This keeps any 60-second span at or below 70% of Kundlit's limits, even across window edges.
- **Deleted links:** show "This link does not exist" with `noindex`, but the HTTP status is 200, not 404, because the page streams.
- **Storage:** a stripped chart takes about 3 KB on disk (measured), so the 500 MB free database fits far more than estimated in §2.
- **Not built yet:** "Pick from My charts" in the Milan form, the hidden Hindi switch, and an admin storage page (the daily cron logs the database size instead).

## Implementation notes (23 Oct 2026): Yogas, Doshas and timing

- **Antardasha dates are computed in code** (`lib/dasha.ts`). Each Kundlit Mahadasha is split with the standard Vimshottari proportions. This is the one exception to "Kundlit only". Tests check that the computed current Antardasha and Pratyantar match Kundlit's own dates (to within 2 minutes) on every fixture.
- **Yogas** are grouped by Kundlit's `rule_id`. Bhanga entries attach to the yoga they cancel, and "when active" means the Dasha periods of the participating grahas.
  - The Present / Not present checklist only lists yogas confirmed in real Kundlit responses (synthetic fixtures in `tests/fixtures/kundlit`, list in `docs/crosscheck.md`).
  - Kemadruma appears only under Doshas.
- **Doshas:** Manglik, Kaal Sarp (own endpoint), Kemadruma, and Sade Sati / Shani Dhaiya (from the chart's transit block, refreshed yearly). They load lazily with `Promise.allSettled`, and a failure shows "Not available — Retry".
- **Creating a result makes only the essential calls:** a Kundli makes one, Gun Milan makes two charts plus the Milan.
- **Remedies are removed everywhere.** Zod drops `remedies` when Manglik data is parsed, and the migration strips stored rows.
- **Timing follow-ups:**
  - `lib/timing.ts` picks significators and candidate Antardasha windows in code, and the model only ranks and explains them.
  - The validator requires every date in an answer to be one that appears in FACTS (or the birth date).
  - Death, illness, accidents, surgery, divorce or separation, childbirth or fertility, and legal outcomes are refused in code before any OpenAI call.
- **Reading facts exclude transit data** (Sade Sati / Dhaiya), so a yearly transit refresh never triggers a paid reading regeneration. Follow-ups, which aren't cached, include it.
- **The birth date never reaches OpenAI.** The first Dasha period starts at birth, so its date is replaced with "birth" in FACTS.
- **Dates** are computed as UTC instants and always displayed in IST. Kundlit's Shani-transit ingress times can shift by a few hours between calls.
- **Groom / Bride** replaces Boy / Girl everywhere users or the AI see it. Database columns are unchanged.
- **Cost:** follow-ups now use gpt-6.1-sol, at about $0.018 per question measured. A v2 Kundli reading measured $0.028. The daily caps stay at 5 per visitor and 10 per page. Example month: 1,000 readings + 3,000 questions ≈ $30 + $55.
- **Local database:** never run `prisma migrate dev` against the `prisma dev` server (see README). It wiped the local test data once.

## Implementation notes (23 Oct 2026): "About this Yoga / Dosha"

- Each present Yoga and Dosha has a collapsed "About" toggle: Nadi / Bhakoot on Gun Milan only when present or cancelled; Sade Sati / Dhaiya only while running.
- The text is AI-written per chart (gpt-6-luna; it was gpt-6.1-sol until 23 Oct 2026). One request writes every item for that chart the first time any toggle is opened.
  - It's cached in `ai_readings` (`kind: about | about_milan`) and shared by everyone viewing the chart, including the Groom's and Bride's charts on Gun Milan.
  - A hidden Turnstile runs only on demand, and there's a per-IP cap of 20 per day.
- The FACTS for this request have no dates or windows. Code checks: exact keys, no dates, no remedy words, and placements must match FACTS. On failure: one retry, then "Couldn't write this right now".
- These texts have their own prompt version (`ABOUT_PROMPT_VERSION`), so changing them never regenerates full readings.
- The PDF prints cached texts only (never generates) and otherwise shows a one-line hint.
- Measured cost on gpt-6.1-sol was about $0.012–0.015 per chart; on gpt-6-luna it is well under $0.01, once per chart.
- Since prompt version a3, each text is 5–7 sentences (about 100–140 words) in plain, everyday language: what the Yoga or Dosha is, its traditional effects in daily life, and how it shows up in this chart, with Bhavas explained in simple words. Measured: about $0.0008 per chart on gpt-6-luna.

## Implementation notes (23 Oct 2026): Grahavani's classical rating

Each present Yoga gets "Grahavani's classical rating" (Strong / Moderate / Weak) and each present, cancelled or running Dosha an "Intensity: High / Medium / Low", always with the reasons shown. It is Grahavani's own interpretive layer on Kundlit's chart data (like the Antardasha split), computed in `lib/strength.ts`. It is **not Shadbala**, and nothing in the app calls it that.

**Why not Kundlit's `strength_score`.** On a test chart with an AstroSage Shadbala table (the only one available), Kundlit's per-graha `strength_score` ranks the grahas almost unrelated to AstroSage's Shadbala ratio (Spearman **−0.18**):

| Graha | Kundlit score (rank) | AstroSage Shadbala ratio (rank) |
|---|---|---|
| Moon | 0.67 (1) | 1.01 (6) |
| Mercury | 0.61 (2) | 1.05 (5) |
| Saturn | 0.59 (3) | 1.60 (1) |
| Sun | 0.57 (4) | 1.41 (2) |
| Venus | 0.51 (5) | 0.94 (7) |
| Jupiter | 0.46 (6) | 1.16 (4) |
| Mars | 0.41 (7) | 1.28 (3) |

So `strength_score` and `strength_components` are stripped at parse time (Zod). Its `sthana` component maps exactly to dignity (debilitated 0, neutral 0.4, own 0.7, exalted 1.0), so we use `dignity` directly.

**Graha points** (each factor adds a short reason):
- Dignity: exalted / moolatrikona +2, own +1.5, friend +0.5, neutral 0, enemy −0.5, debilitated −2.
- House, scored once per graha: kendra or trikona (1, 4, 5, 7, 9, 10) +1 (house 1 counts once), dusthana (6, 8, 12) −1, others 0.
- Combust −1 (not the Sun).
- Baladi avastha: Yuva +1, Kumara +0.5, Bala +0.25, Vriddha 0, Mrita −0.5.

**Yogas.** A combination scores the average of its grahas; Rahu and Ketu are left out when another graha takes part, and a node-only combination gets house points only. The yoga takes its strongest combination. Thresholds: **Strong ≥ 1.5, Moderate ≥ 0.25, else Weak**, giving 6 Strong / 15 Moderate / 14 Weak over the 7 fixtures (`lib/strength.test.ts` pins every value).
- In chart terms: **Strong** means the yoga's grahas are, on average, well placed (dignified or in kendra / trikona, not combust, in a productive age state); **Moderate** means mixed support; **Weak** means they are mostly weakened (debilitated, combust, in 6 / 8 / 12, or Vriddha / Mrita).
- Pancha Mahapurusha yogas get no dignity or house points (own / exalted sign in a kendra is the yoga's own condition): avastha + combustion ≥ 0.5 → Strong, ≥ 0 → Moderate, else Weak.
- A Bhanga lowers the rating one level. Nabhasa yogas are not rated. A chart without avastha data shows "Not rated".
- Old charts without `avastha` are re-fetched once (`ensureChartComplete` in `lib/cache.ts`, together with the transit refresh).

**Doshas.**
- Manglik: Kundlit's severity (mild → Low, medium / moderate / partial → Medium, high / severe → High). Checked on fixtures: the severity already includes Kundlit's cancellations (2 triggers + 1 cancellation = mild; 3 + 2 = mild; 2 + 0 = medium), so it is not lowered again.
- Kaal Sarp: full → High, partial → Medium. Kemadruma: Medium, Low with a listed cancellation. Sade Sati: Peak → High, Rising / Setting → Medium. Shani Dhaiya running: Medium.
- Nadi / Bhakoot (Gun Milan): not cancelled → High, cancelled → Low. Kundlit is not binary here: a cancelled dosha earns partial points (Nadi 4 / 8, Bhakoot 3.5 / 7) and an uncancelled one 0. The page notes that some sites score a cancelled dosha differently.

**AI.** FACTS carry each rating as a fixed phrase ("rated Moderate", "intensity: Low") with its reasons, and grahas carry `avastha`. The prompts allow a rating only in that fixed form, naming the one Yoga or Dosha in the same sentence. `lib/ai/validate.ts` checks only those phrases: each belongs to the one item named since the previous phrase in the sentence (or the sentence's only item) and must match its FACTS rating; a phrase whose item is unclear ("Raj Yoga and Dhana Yoga are rated Moderate") is rejected. Checked live: "Gajakesari Yoga is rated Strong, while Vesi Yoga is rated Weak" passes, and "What is my Shadbala?" got "Shadbala is not calculated in this report…". Other uses of strong / weak / high / low are ignored. A sentence presenting a rating as Shadbala is rejected; "Shadbala is not calculated in this report" is allowed. About texts are checked per item. `PROMPT_VERSION` v3, `ABOUT_PROMPT_VERSION` a4.

**Localisation.** The fixed rating phrases and the Shadbala check are English-only. When other output languages (e.g. Hindi) are added, localise the phrases in the prompts and the validator patterns (`RATING_RE`, `SHADBALA_RE`, `NOT_COVERED_RE`) together.

## Implementation notes (24 Oct 2026): direct reading tone

At the owner's request, readings, About texts and follow-ups are now direct: they state weaknesses, afflictions, weak ratings and running doshas as plainly as strengths, with no softening or reassurance, and negative words are allowed. Unchanged: indications stay "traditional", never certain; no predictions of death, specific accidents or illnesses, infertility, widowhood or curses; the refused-topic list (lib/ai/refusal.ts); no remedies; no medical / legal / financial advice; never telling anyone to marry or not. `PROMPT_VERSION` v4, `ABOUT_PROMPT_VERSION` a5, so cached texts are rewritten once when next opened.

## Implementation notes (24 Oct 2026): karmic perspective, About model, limits

- **Karmic perspective** is the last card of the Kundli AI reading (`karmic_perspective`, 120–180 words, normal Jyotish terms): Ketu's and Rahu's Rashi and Bhava, the lords of Bhava 5 and 9 with dignity, and yogas and doshas read plainly in traditional karmic terms (good karma and karmic burden). It must not invent specific past lives or events.
- A separate plain-language "Summary" card was built and then removed at the owner's request; the karmic perspective moved into the reading instead.
- **About texts** use gpt-5.4-mini (low reasoning, about $0.01 per chart). In a side-by-side on one chart it wrote clearer texts than gpt-6-luna (low or medium) and answered in about 12 s; Gemini 3.8 Flash on the free tier took minutes or returned "high demand" errors in Oct 2026. The Gemini wiring (`lib/ai/models.ts`, `GOOGLE_API_KEY`) is kept but unused.
- **Follow-up limits:** 10 questions per visitor per day, 20 per chart or match per day (`FOLLOWUP_LIMITS`).
- **Tone (v7):** all rules that pushed readings toward positive or reassuring wording are removed: no required "blessings / lessons" framing or uplifting closing line, no banned karmic words, no "not certain" disclaimers, no "traditionally considered favourable" for timing. Kept as safety rules, not tone: no predictions of death, specific accidents or illnesses, infertility or widowhood; the refused-topic list; no medical / legal / financial advice; never "marry / don't marry"; no remedies.
