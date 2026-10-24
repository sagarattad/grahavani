
-- CreateTable
CREATE TABLE "kaal_sarp_results" (
    "id" TEXT NOT NULL,
    "birth_chart_id" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "attribution" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kaal_sarp_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kaal_sarp_results_birth_chart_id_key" ON "kaal_sarp_results"("birth_chart_id");

-- AddForeignKey
ALTER TABLE "kaal_sarp_results" ADD CONSTRAINT "kaal_sarp_results_birth_chart_id_fkey" FOREIGN KEY ("birth_chart_id") REFERENCES "birth_charts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Remedies are no longer shown anywhere; remove them from Manglik results already stored.
UPDATE "manglik_results" SET "result" = "result" - 'remedies';
