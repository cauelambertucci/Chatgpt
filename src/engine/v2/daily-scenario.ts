import { demographicScenario } from "./demographic-scenario";
export function dailyScenario(seed: string, count = 40) {
  const s = demographicScenario(seed, count, true);
  s.personalObjectives = true;
  s.advancedObjectives = true;
  s.dailyLife = { initialPaper: 6, initialInk: 4 };
  return s;
}
