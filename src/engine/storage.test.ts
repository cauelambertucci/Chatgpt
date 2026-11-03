import { it, expect } from "vitest";
import { generate } from "./world";
import { parseWorld, validateWorld } from "./validate";
import { narrative } from "./narrative";
it("salva e restaura um mundo sem alterar a simulação", () => {
  const w = generate({
    seed: "arquivo",
    size: 64,
    years: 50,
    civs: 3,
    chaos: 1,
  });
  expect(parseWorld(JSON.stringify(w))).toEqual(w);
  expect(narrative(w, w.events[0])).toContain("ano 0");
});
it("rejeita arquivos inválidos e proveniência quebrada", () => {
  expect(() => parseWorld("{}")).toThrow();
  const w = generate({
    seed: "arquivo",
    size: 64,
    years: 100,
    civs: 3,
    chaos: 1,
  });
  w.artifacts[0].provenance = [];
  expect(validateWorld(w)).toContain("Proveniência ausente");
});
