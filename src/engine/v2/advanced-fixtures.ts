import { advancedScenario } from "./scenario";
import { traits, values } from "../../data/v2/personality";
export function advancedFixture(kind: "governar" | "criar_obra") {
  const s = advancedScenario(`fixture-${kind}`);
  s.mode = "fixture";
  s.months = 24;
  for (const p of s.people) {
    for (const key of Object.keys(traits)) p.traits[key] = 50;
    for (const key of Object.keys(values)) p.values[key] = 0;
    p.traits.ambicao = 0;
    p.traits.cautela = 0;
    p.kin = [];
    p.rival = undefined;
    p.hostility = 0;
    p.values.lei = 100;
    p.values.paz = 50;
    p.skills = { lideranca: 20, escrita: 20 };
  }
  s.schedules.forEach((x) => {
    x.from = 0;
    x.until = 239;
    x.period = 1;
    x.absentMonths = 0;
  });
  const p = s.people[0];
  if (kind === "governar") {
    p.values.poder = 100;
    p.traits.ambicao = 100;
    p.skills!.lideranca = 100;
  } else {
    p.values.arte = 100;
    p.values.trabalho = 100;
    p.values.conhecimento = 60;
    p.traits.criatividade = 100;
    p.traits.perseveranca = 100;
    p.skills!.escrita = 50;
  }
  return s;
}
