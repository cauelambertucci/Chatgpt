import { settlementScenario } from "../../engine/v2/politics";
export const profiles = {
  leve: { label: "Leve", founders: 40, years: 100 },
  padrao: { label: "Padrão", founders: 70, years: 100 },
  epico: { label: "Épico", founders: 100, years: 100 },
} as const;
export type ProfileId = keyof typeof profiles;
/** UI configuration only: existing founder generator, identical simulation rules. */
export function profileScenario(seed: string, id: ProfileId) {
  const p = profiles[id];
  const s = settlementScenario(seed.trim(), p.founders === 40 ? 40 : 100);
  s.people = s.people.slice(0, p.founders);
  const ids = new Set(s.people.map((p) => p.id));
  s.schedules = s.schedules.filter((q) => ids.has(q.id));
  s.months = p.years * 12;
  return s;
}
export function estimateProfile(id: ProfileId) {
  const p = profiles[id],
    scale = (p.founders / 40) * (p.years / 100);
  return {
    seconds: [11.1 * scale, 27.4 * scale],
    memoryGB: [0.36 * scale, 0.56 * scale],
    kind: "extrapolação",
    source:
      "Motor do Marco 3: 40 fundadores/100 anos, Node; 11,1–27,4 s e 0,36–0,56 GB de pico RSS. Escala linear por fundadores e anos; não é medição da aba nem garantia. Crescimento populacional e dispositivo podem aumentar o custo.",
  };
}
