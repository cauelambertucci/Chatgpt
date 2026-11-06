import { hash } from "../rng";
export const rules = {
  monthsPerYear: 12,
  daysPerMonth: 30,
  maxSkill: 1000,
  noise: 25,
  minMemory: 100,
  revengeThreshold: 180,
  lethalMargin: 45,
  flightMargin: 130,
  perceptionRadius: "same-abstract-place",
  maxEvents: 100000,
} as const;
export const sample = (seed: string, key: string, min: number, max: number) =>
  min + (hash(`${seed}|${key}`) % (max - min + 1));
export const noise = (
  seed: string,
  id: string,
  month: number,
  action: string,
) =>
  sample(seed, `decision:${id}:${month}:${action}`, -rules.noise, rules.noise);
export const names = [
  "Runa",
  "Elian",
  "Skarn",
  "Mira",
  "Orin",
  "Tala",
  "Neris",
  "Doran",
  "Luma",
  "Bram",
  "Iria",
  "Zarek",
  "Syl",
  "Alda",
  "Corin",
  "Vela",
  "Thorin",
  "Mael",
  "Sora",
  "Iven",
];
export const traitKeys = [
  "rancor",
  "coragem",
  "disciplina",
  "cautela",
] as const;
export const valueKeys = ["familia", "vinganca", "paz"] as const;
export const memoryWeight = (weight: number, rancor: number, elapsed: number) =>
  Math.max(0, weight - Math.floor((elapsed * (105 - rancor)) / 12));
