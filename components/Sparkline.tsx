import React from "react";
import { View } from "react-native";

/**
 * Dependency-free mini bar chart. Normalizes `data` to its own max and renders
 * a row of bars with a left-to-right opacity ramp so the latest points read as
 * "now". Works on native and web (no SVG required).
 */
export function Sparkline({
  data,
  color,
  height = 26,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  const pts = data.length ? data : [0];
  const max = Math.max(1, ...pts);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height }}>
      {pts.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: Math.max(3, (v / max) * height),
            backgroundColor: color,
            opacity: 0.3 + 0.7 * (i / Math.max(1, pts.length - 1)),
            borderRadius: 2,
          }}
        />
      ))}
    </View>
  );
}
