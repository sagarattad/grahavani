import { Line, Polygon, Rect, Svg, Text as SvgText, View, Text } from "@react-pdf/renderer";
import { HOUSE_GEOMETRY, houseLabels, type House } from "../chart/northIndian";
import { grahaShort } from "../glossary";
import { C, s } from "./layout";

// The North Indian chart for the PDF, using the same layout as the web chart.
// R / C are drawn as small raised text after the graha (the font has no superscript letters).
export function PdfChart({ houses, title, width = 240 }: { houses: House[]; title: string; width?: number }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Svg viewBox="-4 -4 408 408" width={width} height={width}>
        <Rect x={0} y={0} width={400} height={400} fill="#fffdf8" stroke={C.brandStrong} strokeWidth={2.5} />
        <Line x1={0} y1={0} x2={400} y2={400} stroke={C.brandStrong} strokeWidth={1.5} />
        <Line x1={400} y1={0} x2={0} y2={400} stroke={C.brandStrong} strokeWidth={1.5} />
        <Polygon points="200,0 400,200 200,400 0,200" fill="none" stroke={C.brandStrong} strokeWidth={1.5} />
        {houses.map((h) => {
          const geo = HOUSE_GEOMETRY[h.house];
          return [
            <SvgText
              key={`n${h.house}`}
              x={geo.label[0]}
              y={geo.label[1] + 4}
              textAnchor="middle"
              style={{ fontFamily: "NotoSans", fontSize: 12 }}
              fill="#9a6b55"
            >
              {String(h.signNum)}
            </SvgText>,
            ...houseLabels(h, grahaShort).flatMap((l) => {
              const suffix = `${l.retro ? "R" : ""}${l.combust ? "C" : ""}`;
              return [
                <SvgText
                  key={l.key}
                  x={l.x}
                  y={l.y + l.fontSize * 0.35}
                  textAnchor="middle"
                  style={{ fontFamily: "NotoSans", fontSize: l.fontSize, fontWeight: 700 }}
                  fill={l.lagna ? C.warn : C.fg}
                >
                  {l.short}
                </SvgText>,
                ...(suffix
                  ? [
                      <SvgText
                        key={`${l.key}-s`}
                        x={l.x + l.fontSize * 0.62}
                        y={l.y - l.fontSize * 0.05}
                        textAnchor="start"
                        style={{ fontFamily: "NotoSans", fontSize: l.fontSize * 0.6, fontWeight: 700 }}
                        fill={C.brand}
                      >
                        {suffix}
                      </SvgText>,
                    ]
                  : []),
              ];
            }),
          ];
        })}
      </Svg>
      <Text style={[s.bold, { marginTop: 3 }]}>{title}</Text>
    </View>
  );
}
