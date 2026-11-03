import { it, expect } from "vitest";
import { populate } from "./civs";
import { mapgen } from "./mapgen";
it("posiciona capitais em terra e mantém territórios e relações válidos", () => {
  const w = populate(
    { seed: "atlas", size: 64, years: 50, civs: 5, chaos: 0.5 },
    mapgen("atlas", 64),
  );
  expect(w.civs).toHaveLength(5);
  for (const c of w.civs) {
    expect(w.settlements.find((s) => s.id === c.capital)?.civ).toBe(c.id);
    expect(Object.keys(c.relations)).toHaveLength(4);
  }
  expect(w.settlements.every((s) => !w.geography.tiles[s.tile].water)).toBe(
    true,
  );
});
