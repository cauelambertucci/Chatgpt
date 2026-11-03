import { syllables, endings } from "../data/catalog";
import { pick, type RNG } from "./rng";
export const name = (r: RNG, style = 0) =>
  pick(r, syllables[style % 4]) + pick(r, endings[style % 4]);
