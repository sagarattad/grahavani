// Places the API's own sign numbers into the fixed North Indian (diamond)
// layout. This is layout only: house h holds the h-th sign counted from the
// ascendant sign. No astrology is calculated here.
import type { Chart } from "../kundlit-schemas";

export type ChartGraha = { name: string; signNum: number; retro: boolean; combust: boolean };
export type House = { house: number; signNum: number; grahas: ChartGraha[] };

export const houseSign = (ascSignNum: number, house: number) => ((ascSignNum - 1 + house - 1) % 12) + 1;
export const houseOfSign = (ascSignNum: number, signNum: number) => ((signNum - ascSignNum + 12) % 12) + 1;

export function placeInHouses(ascSignNum: number, grahas: ChartGraha[]): House[] {
  const houses: House[] = Array.from({ length: 12 }, (_, i) => ({
    house: i + 1,
    signNum: houseSign(ascSignNum, i + 1),
    grahas: [],
  }));
  for (const g of grahas) houses[houseOfSign(ascSignNum, g.signNum) - 1].grahas.push(g);
  return houses;
}

export function d1Houses(chart: Chart): House[] {
  return placeInHouses(
    chart.lagna.sign_num,
    chart.grahas.map((g) => ({ name: g.name, signNum: g.sign_num, retro: g.retrograde, combust: g.combust })),
  );
}

export function d9Houses(chart: Chart): House[] {
  return placeInHouses(
    chart.navamsha_lagna.sign_num,
    chart.grahas.map((g) => ({ name: g.name, signNum: g.navamsha.sign_num, retro: g.retrograde, combust: false })),
  );
}

export type HouseLabel = {
  key: string;
  short: string; // "La" or graha short name ("Ju")
  lagna: boolean;
  retro: boolean;
  combust: boolean;
  x: number;
  y: number;
  fontSize: number;
};

/**
 * Where each label goes inside a house (used by the web SVG and the PDF).
 * Corner triangles fit 2 labels per row, the 4 diamonds fit 3; crowded houses
 * use a smaller font.
 */
export function houseLabels(h: House, shortName: (apiName: string) => string): HouseLabel[] {
  const geo = HOUSE_GEOMETRY[h.house];
  const items = [
    ...(h.house === 1 ? [{ key: "la", short: "La", lagna: true, retro: false, combust: false }] : []),
    ...h.grahas.map((g) => ({ key: g.name, short: shortName(g.name), lagna: false, retro: g.retro, combust: g.combust })),
  ];
  const perRow = [1, 4, 7, 10].includes(h.house) ? 3 : 2;
  const rows = Math.ceil(items.length / perRow);
  const fontSize = items.length >= 4 ? 13 : 15;
  const lineH = fontSize + 3;
  return items.map((it, i) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, items.length - row * perRow);
    const col = i % perRow;
    return {
      ...it,
      x: geo.center[0] + (col - (inRow - 1) / 2) * (fontSize * 2.1),
      y: geo.center[1] + (row - (rows - 1) / 2) * lineH,
      fontSize,
    };
  });
}

// Geometry for a 400×400 viewBox. House 1 is the top-centre diamond and
// houses run anti-clockwise. `label` is where the sign number goes (near the
// centre of the chart), `center` is where the grahas go.
export const HOUSE_GEOMETRY: Record<number, { points: string; center: [number, number]; label: [number, number] }> = {
  1: { points: "200,0 300,100 200,200 100,100", center: [200, 90], label: [200, 175] },
  2: { points: "0,0 200,0 100,100", center: [100, 35], label: [100, 85] },
  3: { points: "0,0 100,100 0,200", center: [35, 100], label: [85, 100] },
  4: { points: "0,200 100,100 200,200 100,300", center: [100, 200], label: [175, 200] },
  5: { points: "0,200 100,300 0,400", center: [35, 300], label: [85, 300] },
  6: { points: "0,400 100,300 200,400", center: [100, 365], label: [100, 315] },
  7: { points: "200,400 100,300 200,200 300,300", center: [200, 310], label: [200, 225] },
  8: { points: "200,400 300,300 400,400", center: [300, 365], label: [300, 315] },
  9: { points: "400,400 300,300 400,200", center: [365, 300], label: [315, 300] },
  10: { points: "400,200 300,300 200,200 300,100", center: [300, 200], label: [225, 200] },
  11: { points: "400,200 300,100 400,0", center: [365, 100], label: [315, 100] },
  12: { points: "400,0 300,100 200,0", center: [300, 35], label: [300, 85] },
};
