import type { Params, World, Entity } from "../types";
import { mapgen } from "./mapgen";
import { populate } from "./civs";
import { simulate } from "./history";
export function checkParams(p: Params) {
  if (
    typeof p.seed !== "string" ||
    p.seed.length < 1 ||
    p.seed.length > 200 ||
    !Number.isInteger(p.size) ||
    p.size < 32 ||
    p.size > 256 ||
    !Number.isInteger(p.years) ||
    p.years < 50 ||
    p.years > 1000 ||
    !Number.isInteger(p.civs) ||
    p.civs < 3 ||
    p.civs > 8 ||
    !Number.isFinite(p.chaos) ||
    p.chaos < 0 ||
    p.chaos > 1
  )
    throw Error("Parâmetros inválidos");
}
export function generate(
  p: Params,
  progress: (n: number) => void = () => {},
): World {
  checkParams(p);
  progress(0.03);
  const geo = mapgen(p.seed, p.size);
  progress(0.25);
  const w = populate(p, geo);
  progress(0.35);
  return simulate(w, (n) => progress(0.35 + n * 0.65));
}
export const entities = (w: World): Entity[] => [
  ...w.geography.regions,
  ...w.civs,
  ...w.settlements,
  ...w.people,
  ...w.creatures,
  ...w.artifacts,
];
