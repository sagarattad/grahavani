-- CreateTable
CREATE TABLE "places" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'open-meteo',
    "provider_place_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "admin1" TEXT,
    "admin2" TEXT,
    "country" TEXT,
    "country_code" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL,
    "population" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "birth_charts" (
    "id" TEXT NOT NULL,
    "birth_key" TEXT NOT NULL,
    "birth_date" TEXT NOT NULL,
    "birth_time" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL,
    "chart" JSONB NOT NULL,
    "dasha_current" JSONB NOT NULL,
    "dasha_refreshed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attribution" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'kundlit',
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "birth_charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manglik_results" (
    "id" TEXT NOT NULL,
    "birth_chart_id" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "attribution" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manglik_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milan_results" (
    "id" TEXT NOT NULL,
    "pair_key" TEXT NOT NULL,
    "boy_chart_id" TEXT NOT NULL,
    "girl_chart_id" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "attribution" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milan_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_readings" (
    "id" TEXT NOT NULL,
    "cache_key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "facts_hash" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "output" JSONB NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "est_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "birth_chart_id" TEXT,
    "manglik_result_id" TEXT,
    "milan_result_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "google_sub" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "birth_date" TEXT NOT NULL,
    "birth_time" TEXT NOT NULL,
    "place_label" TEXT NOT NULL,
    "place_id" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL,
    "place_edited" BOOLEAN NOT NULL DEFAULT false,
    "birth_chart_id" TEXT NOT NULL,
    "created_via" TEXT NOT NULL,
    "last_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "user_id" TEXT,
    "boy_profile_id" TEXT NOT NULL,
    "girl_profile_id" TEXT NOT NULL,
    "milan_result_id" TEXT NOT NULL,
    "last_viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "followups" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "target_slug" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "user_id" TEXT,
    "ip_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "followups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "bucket" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("bucket","window_start")
);

-- CreateTable
CREATE TABLE "provider_cooldowns" (
    "endpoint" TEXT NOT NULL,
    "blocked_until" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_cooldowns_pkey" PRIMARY KEY ("endpoint")
);

-- CreateTable
CREATE TABLE "usage_monthly" (
    "month" TEXT NOT NULL,
    "ai_requests" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "est_cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kundlit_calls" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usage_monthly_pkey" PRIMARY KEY ("month")
);

-- CreateIndex
CREATE UNIQUE INDEX "places_provider_place_id_key" ON "places"("provider_place_id");

-- CreateIndex
CREATE UNIQUE INDEX "birth_charts_birth_key_key" ON "birth_charts"("birth_key");

-- CreateIndex
CREATE UNIQUE INDEX "manglik_results_birth_chart_id_key" ON "manglik_results"("birth_chart_id");

-- CreateIndex
CREATE UNIQUE INDEX "milan_results_pair_key_key" ON "milan_results"("pair_key");

-- CreateIndex
CREATE UNIQUE INDEX "ai_readings_cache_key_key" ON "ai_readings"("cache_key");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_slug_key" ON "profiles"("slug");

-- CreateIndex
CREATE INDEX "profiles_user_id_idx" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "profiles_last_viewed_at_idx" ON "profiles"("last_viewed_at");

-- CreateIndex
CREATE UNIQUE INDEX "matches_slug_key" ON "matches"("slug");

-- CreateIndex
CREATE INDEX "matches_user_id_idx" ON "matches"("user_id");

-- CreateIndex
CREATE INDEX "matches_last_viewed_at_idx" ON "matches"("last_viewed_at");

-- CreateIndex
CREATE INDEX "followups_ip_hash_created_at_idx" ON "followups"("ip_hash", "created_at");

-- CreateIndex
CREATE INDEX "followups_target_slug_created_at_idx" ON "followups"("target_slug", "created_at");

-- AddForeignKey
ALTER TABLE "manglik_results" ADD CONSTRAINT "manglik_results_birth_chart_id_fkey" FOREIGN KEY ("birth_chart_id") REFERENCES "birth_charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milan_results" ADD CONSTRAINT "milan_results_boy_chart_id_fkey" FOREIGN KEY ("boy_chart_id") REFERENCES "birth_charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milan_results" ADD CONSTRAINT "milan_results_girl_chart_id_fkey" FOREIGN KEY ("girl_chart_id") REFERENCES "birth_charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_readings" ADD CONSTRAINT "ai_readings_birth_chart_id_fkey" FOREIGN KEY ("birth_chart_id") REFERENCES "birth_charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_readings" ADD CONSTRAINT "ai_readings_manglik_result_id_fkey" FOREIGN KEY ("manglik_result_id") REFERENCES "manglik_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_readings" ADD CONSTRAINT "ai_readings_milan_result_id_fkey" FOREIGN KEY ("milan_result_id") REFERENCES "milan_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_birth_chart_id_fkey" FOREIGN KEY ("birth_chart_id") REFERENCES "birth_charts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_boy_profile_id_fkey" FOREIGN KEY ("boy_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_girl_profile_id_fkey" FOREIGN KEY ("girl_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_milan_result_id_fkey" FOREIGN KEY ("milan_result_id") REFERENCES "milan_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
