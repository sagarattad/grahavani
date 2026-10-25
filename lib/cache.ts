import "server-only";
import { db } from "./db";
import { birthKey, pairKey } from "./ids";
import { getKundli, getCurrentDasha, getKaalSarp, getManglik, getMilan, type Birth } from "./kundlit";
import type { BirthChart, KaalSarpResult, ManglikResult } from "./generated/prisma/client";
import { kaalSarpSchema, manglikSchema, type Chart, type DashaCurrent, type KaalSarp, type Manglik } from "./kundlit-schemas";
import { computeManglik, type ManglikResult as ManglikComputed } from "./astro/manglik";

// Every Kundlit result is stored once and shared: a chart, Manglik and Kaal
// Sarp result per birth, a Milan result per couple.

export const birthOf = (row: Pick<BirthChart, "birthDate" | "birthTime" | "lat" | "lon" | "timezone">): Birth => ({
  birth_date: row.birthDate,
  birth_time: row.birthTime,
  latitude: row.lat,
  longitude: row.lon,
  timezone: row.timezone,
});

export async function getOrCreateChart(b: Birth): Promise<BirthChart> {
  const key = birthKey(b);
  const existing = await db.birthChart.findUnique({ where: { birthKey: key } });
  if (existing) return existing;

  const { chart, attribution } = await getKundli(b);
  return db.birthChart.upsert({
    where: { birthKey: key },
    create: {
      birthKey: key,
      birthDate: b.birth_date,
      birthTime: b.birth_time,
      lat: b.latitude,
      lon: b.longitude,
      timezone: b.timezone,
      chart,
      dashaCurrent: chart.vimshottari.current,
      attribution,
    },
    update: {},
  });
}

/**
 * The "current" dasha from Kundlit is as of the call time. When the cached
 * Pratyantar Dasha has ended, ask Kundlit again (we never compute it).
 * If Kundlit is unavailable we keep showing the stored one with its date.
 */
export async function ensureFreshDasha(row: BirthChart): Promise<DashaCurrent> {
  const current = row.dashaCurrent as DashaCurrent;
  if (new Date(current.pratyantardasha.end).getTime() > Date.now()) return current;
  try {
    const fresh = await getCurrentDasha(birthOf(row));
    await db.birthChart.update({
      where: { id: row.id },
      data: { dashaCurrent: fresh, dashaRefreshedAt: new Date() },
    });
    return fresh;
  } catch (e) {
    console.warn("dasha_refresh_failed", (e as Error).message);
    return current;
  }
}

export async function getOrCreateManglik(chartRow: BirthChart) {
  const existing = await db.manglikResult.findUnique({ where: { birthChartId: chartRow.id } });
  if (existing) return existing;
  const { result, attribution } = await getManglik(birthOf(chartRow));
  return db.manglikResult.upsert({
    where: { birthChartId: chartRow.id },
    create: { birthChartId: chartRow.id, result, attribution },
    update: {},
  });
}

export async function getOrCreateMilan(boy: BirthChart, girl: BirthChart) {
  const key = pairKey(boy.birthKey, girl.birthKey);
  const existing = await db.milanResult.findUnique({ where: { pairKey: key } });
  if (existing) return existing;
  const { result, attribution } = await getMilan(birthOf(boy), birthOf(girl));
  return db.milanResult.upsert({
    where: { pairKey: key },
    create: { pairKey: key, boyChartId: boy.id, girlChartId: girl.id, result, attribution },
    update: {},
  });
}

export const chartOf = (row: BirthChart) => row.chart as unknown as Chart;

/** Stored Manglik JSON, re-parsed so old rows can never leak remedies. */
export const manglikOf = (row: Pick<ManglikResult, "result">): Manglik => manglikSchema.parse(row.result);
export const kaalSarpOf = (row: Pick<KaalSarpResult, "result">): KaalSarp => kaalSarpSchema.parse(row.result);

export async function getOrCreateKaalSarp(chartRow: BirthChart) {
  const existing = await db.kaalSarpResult.findUnique({ where: { birthChartId: chartRow.id } });
  if (existing) return existing;
  const { result, attribution } = await getKaalSarp(birthOf(chartRow));
  return db.kaalSarpResult.upsert({
    where: { birthChartId: chartRow.id },
    create: { birthChartId: chartRow.id, result, attribution },
    update: {},
  });
}

const YEAR_MS = 365 * 86400_000;

/**
 * Sade Sati / Dhaiya dates come from the chart's transit block, computed by
 * Kundlit as of the call date (10 years ahead), and the classical rating needs
 * each graha's Baladi avastha and aspects. Charts saved before we kept these, or with
 * transit data older than a year, are re-fetched once. Dasha data is untouched.
 */
export async function ensureChartComplete(row: BirthChart): Promise<Chart> {
  const chart = chartOf(row);
  const transitFresh = chart.transit && Date.now() - new Date(chart.transit.as_of).getTime() < YEAR_MS;
  if (transitFresh && chart.grahas.every((g) => g.avastha && g.aspect_grahas)) return chart;
  const fresh = await getKundli(birthOf(row));
  await db.birthChart.update({ where: { id: row.id }, data: { chart: fresh.chart, attribution: fresh.attribution } });
  return fresh.chart;
}

/** The row with its chart completed; on a Kundlit failure, the saved chart as it is. */
export async function completedChartRow(row: BirthChart): Promise<{ row: BirthChart; chart: Chart }> {
  try {
    const chart = await ensureChartComplete(row);
    return { row: { ...row, chart }, chart };
  } catch (e) {
    console.warn("chart_refresh_unavailable", (e as Error)?.message);
    return { row, chart: chartOf(row) };
  }
}

export type DoshaData = { chart: Chart; manglik: ManglikComputed; kaalSarp: KaalSarp | null };

/**
 * Everything the Doshas section needs, fetched in parallel. A failed call
 * (e.g. Kundlit busy) becomes null so the page shows "Not available" instead
 * of failing. Manglik is Grahavani's own (lib/astro/manglik.ts), computed from
 * the chart, so it needs no Kundlit call.
 */
export async function loadDoshaData(row: BirthChart): Promise<DoshaData> {
  const [k, t] = await Promise.allSettled([getOrCreateKaalSarp(row), ensureChartComplete(row)]);
  for (const r of [k, t]) if (r.status === "rejected") console.warn("dosha_data_unavailable", (r.reason as Error)?.message);
  const chart = t.status === "fulfilled" ? t.value : chartOf(row);
  return {
    manglik: computeManglik(chart),
    kaalSarp: k.status === "fulfilled" ? kaalSarpOf(k.value) : null,
    chart,
  };
}
