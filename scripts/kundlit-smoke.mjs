// npm run kundlit:smoke
// One live janam-kundali call for the plan's test birth; prints the key fields.
// (Uses 1 of Kundlit's 20 calls/min for your IP.)
const res = await fetch("https://kundlit.com/api/astro/janam-kundali", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ birth_date: "1990-01-15", birth_time: "14:30", latitude: 21.2514, longitude: 81.6296, timezone: "Asia/Kolkata" }),
});
if (!res.ok) {
  console.error("Kundlit returned", res.status, await res.text());
  process.exit(1);
}
const { chart, attribution } = await res.json();
const dms = (d) => `${Math.floor(d)}°${String(Math.floor((d % 1) * 60)).padStart(2, "0")}′`;
const moon = chart.grahas.find((g) => g.name === "Moon");
const cur = chart.vimshottari.current;
console.log(`Lagna: ${chart.lagna.sign} ${dms(chart.lagna.deg_in_sign)}, ${chart.lagna.nakshatra}-${chart.lagna.pada}`);
console.log(`Moon:  ${moon.sign}, ${moon.nakshatra}-${moon.pada}`);
console.log(`Dasha: ${cur.mahadasha.lord} / ${cur.antardasha.lord} / ${cur.pratyantardasha.lord} (PD ends ${cur.pratyantardasha.end.slice(0, 10)})`);
console.log(`Source: ${attribution.citation}`);
