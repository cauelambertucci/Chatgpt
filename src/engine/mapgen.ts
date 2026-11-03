import { fbm } from "./noise";
import { rng } from "./rng";
import { name } from "./names";
import type { Geography } from "../types";
export function mapgen(seed: string, size: number): Geography {
  const r = rng(seed + ":map"),
    regions = Array.from({ length: 16 }, (_, i) => ({
      id: `r${i}`,
      name: `${["Terras de", "Montes de", "Bosque de", "Vale de"][i % 4]} ${name(r, i)}`,
      kind: "região" as const,
      tile: 0,
    }));
  const tiles = Array.from({ length: size * size }, (_, i) => {
    const x = i % size,
      y = Math.floor(i / size),
      edge = Math.max(Math.abs(x / size - 0.5), Math.abs(y / size - 0.5)) * 2;
    const elevation =
      fbm((x / size) * 4, (y / size) * 4, seed) - edge ** 3 * 0.3;
    const temperature = Math.max(
      0,
      1 -
        Math.abs(y / size - 0.5) * 1.6 -
        Math.max(0, elevation - 0.55) * 0.9 +
        (fbm((x / size) * 3, (y / size) * 3, seed + "heat") - 0.5) * 0.3,
    );
    const rain = fbm((x / size) * 5, (y / size) * 5, seed + "rain");
    const biome =
      elevation < 0.32
        ? 0
        : elevation < 0.35
          ? 1
          : elevation > 0.73
            ? temperature < 0.35
              ? 10
              : 8
            : temperature < 0.25
              ? 7
              : rain < 0.34
                ? temperature > 0.55
                  ? 5
                  : 6
                : rain > 0.62
                  ? temperature > 0.65
                    ? 4
                    : 9
                  : rain > 0.48
                    ? 3
                    : 2;
    const region =
      Math.min(3, Math.floor((y / size) * 4)) * 4 +
      Math.min(3, Math.floor((x / size) * 4));
    return {
      elevation,
      temperature,
      rain,
      biome,
      region: regions[region].id,
      water: biome === 0,
      river: false,
    };
  });
  regions.forEach((reg, i) => {
    reg.tile =
      Math.floor(i / 4) * Math.floor(size / 4) * size +
      (i % 4) * Math.floor(size / 4);
  });
  // Strictly descending drainage: a basin becomes a lake, never an uphill river.
  for (let source = 0; source < tiles.length; source++) {
    if (tiles[source].elevation < 0.65 || r() > 0.045) continue;
    let current = source;
    for (let step = 0; step < size * 2; step++) {
      const tile = tiles[current];
      if (tile.biome === 0) break;
      tile.river = true;
      const x = current % size,
        y = Math.floor(current / size);
      const neighbors = [
        x > 0 ? current - 1 : -1,
        x < size - 1 ? current + 1 : -1,
        y > 0 ? current - size : -1,
        y < size - 1 ? current + size : -1,
      ].filter((j) => j >= 0);
      const next = neighbors.sort(
        (a, b) => tiles[a].elevation - tiles[b].elevation,
      )[0];
      if (tiles[next].elevation >= tile.elevation) {
        tile.water = true;
        break;
      }
      current = next;
    }
  }
  const featureKinds = [
    { label: "Rio", test: (t: (typeof tiles)[number]) => t.river && !t.water },
    {
      label: "Lago",
      test: (t: (typeof tiles)[number]) => t.water && t.biome !== 0,
    },
    {
      label: "Floresta",
      test: (t: (typeof tiles)[number]) => t.biome === 3 || t.biome === 4,
    },
    { label: "Montanha", test: (t: (typeof tiles)[number]) => t.biome === 8 },
  ];
  for (const feature of featureKinds) {
    let count = 0;
    for (let i = 0; i < tiles.length; i++) {
      if (count >= 4) break;
      if (feature.test(tiles[i]) && r() < 0.03) {
        regions.push({
          id: `r${regions.length}`,
          name: `${feature.label} ${name(r, count)}`,
          kind: "região",
          tile: i,
        });
        count++;
      }
    }
  }
  return { size, tiles, regions };
}
