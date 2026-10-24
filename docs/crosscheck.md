# Gun Milan cross-check (Phase 9)

Compare Grahavani with 2–3 well-known Kundli Milan sites for 5 couples. Use
made-up or consenting test data, and Lahiri ayanamsa wherever a site offers a
choice. Totals within ±1.5 are acceptable; explain any bigger difference and,
if it is systematic, add a note to the About page.

Pick couples so that together they cover:
- [ ] Nadi Dosha (no cancellation)
- [ ] Bhakoot Dosha
- [ ] a dosha cancellation (Nadi or Bhakoot)
- [ ] both Manglik
- [ ] a Moon within 1° of a Nakshatra boundary

## Couple 1

| | Boy | Girl |
|---|---|---|
| Birth date & time | | |
| Place (as resolved) | | |

| Koot (max) | Grahavani | Site A: | Site B: | Note |
|---|---|---|---|---|
| Varna (1) | | | | |
| Vashya (2) | | | | |
| Tara (3) | | | | |
| Yoni (4) | | | | |
| Graha Maitri (5) | | | | |
| Gana (6) | | | | |
| Bhakoot (7) | | | | |
| Nadi (8) | | | | |
| **Total (36)** | | | | |
| Verdict wording | | | | |
| Nadi Dosha / cancellation | | | | |
| Bhakoot Dosha / cancellation | | | | |
| Boy Manglik | | | | |
| Girl Manglik | | | | |

Likely cause of differences (ayanamsa, Vashya/Yoni tables, half points,
cancellation rules, Manglik house rules):

<!-- Copy the Couple 1 block for couples 2–5. -->

## Kundlit response shapes seen so far (22 Oct 2026)

- `verdict`: `good`, `acceptable`, `below_threshold`
- `dosha`: `"Nadi Dosha"`, `"Bhakoot Dosha"` or `null`
- `cancelled_by`: rule ids such as `compat.ashtakoot.nadi.cancellation.same_rasi_different_pada`
  and `compat.ashtakoot.bhakoot.cancellation.same_lord`; a cancelled dosha
  earns partial points (e.g. Nadi 4/8, Bhakoot 3.5/7)
- `skipped`: always `false` so far
- Manglik `severity`: `mild` and `medium` seen so far

**Cancelled Nadi / Bhakoot and totals.** Kundlit gives a cancelled Nadi or Bhakoot
Dosha partial points (4 / 8 and 3.5 / 7 in the fixtures); an uncancelled one earns 0.
Other sites may score a cancelled dosha differently (full points, or 0), which is a
likely cause of differences in the total. Note it in the Differences column when a
couple has a cancelled Nadi or Bhakoot.

Add new values to `lib/glossary.ts` (the glossary test fails until you do).

## Yoga checklist: confirmed in real Kundlit responses (23 Oct 2026)

Each rule id below appeared in at least one saved response (`tests/fixtures/kundlit`). A test
fails if one is missing, so the app can honestly show "Not present" for any yoga not returned.

| Rule id | Name | Seen in fixture |
|---|---|---|
| yoga.ruchaka | Ruchaka | 1990-01-15 Raipur |
| yoga.bhadra | Bhadra | synthetic 2018-06-25 Delhi |
| yoga.hamsa | Hamsa | synthetic 2014-12-15 Delhi |
| yoga.malavya | Malavya | 2001-11-20 Bengaluru |
| yoga.sasa | Sasa | synthetic 2021-06-15 Delhi |
| yoga.gajakesari | Gajakesari | synthetic 2021-06-15 Delhi |
| yoga.raja | Raj Yoga | all |
| yoga.dhana | Dhana Yoga | 1990-01-15 Raipur |
| yoga.neechabhanga | Neechabhanga Raj Yoga | 1985-03-02 Mumbai |
| yoga.chandra_mangala | Chandra-Mangala | 2001-11-20 Bengaluru |
| yoga.sunaphaa | Sunapha | synthetic 1999-04-12 Delhi |
| yoga.anaphaa | Anapha | synthetic 2021-06-15 Delhi |
| yoga.durdhura | Durudhura | synthetic 2018-06-25 Delhi |
| yoga.vesi | Vesi | synthetic 2014-12-15 Delhi |
| yoga.vasi | Vasi | 1990-01-15 Raipur |
| yoga.ubhayachari | Ubhayachari | 1985-03-02 Mumbai |

Also returned, and shown when present (not in the checklist): Nabhasa yogas such as Pasha,
Dama, Kedara, Sarpa and Ardhachandra. Kemadruma is shown under Doshas.
