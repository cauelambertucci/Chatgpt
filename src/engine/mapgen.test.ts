import { describe, it, expect } from "vitest";
import { mapgen } from "./mapgen";
describe("geografia", () => {
  it("é determinística e tem água, terra e biomas válidos", () => {
    const a = mapgen("aurora", 64);
    expect(a).toEqual(mapgen("aurora", 64));
    expect(a.tiles.some((t) => t.biome === 0)).toBe(true);
    expect(a.tiles.some((t) => t.biome !== 0)).toBe(true);
    expect(a.tiles.every((t) => t.biome >= 0 && t.biome <= 10)).toBe(true);
  });
});
