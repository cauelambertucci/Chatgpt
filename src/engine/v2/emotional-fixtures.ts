import { advancedFixture } from "./advanced-fixtures";
import { protectionFixture } from "./personal-fixtures";
import { initialPsychology } from "./emotions";
import type { Scenario } from "./types";
export function emotionalize(s: Scenario): Scenario {
  s.emotionalDynamics = true;
  for (const p of s.people) p.psychology = initialPsychology();
  return s;
}
export function lossFixture(kind: "irado" | "solidario") {
  const s = emotionalize(advancedFixture("governar"));
  s.seed = "fixture-mesma-perda";
  s.months = 12;
  const [f, v, o] = s.people;
  f.values.poder = 0;
  f.traits.ambicao = 0;
  f.kin = [v.id];
  v.kin = [f.id];
  f.traits.rancor = kind === "irado" ? 80 : 0;
  f.traits.agressividade = kind === "irado" ? 80 : 0;
  f.traits.compaixao = kind === "irado" ? 0 : 80;
  f.traits.autocontrole = kind === "irado" ? 0 : 80;
  f.values.vinganca = kind === "irado" ? 80 : 0;
  f.values.paz = kind === "irado" ? 0 : 80;
  s.schedules.find((x) => x.id === f.id)!.from = 1;
  o.rival = v.id;
  o.hostility = 100;
  o.skill = 800;
  o.traits.cautela = 0;
  o.traits.coragem = 100;
  o.traits.agressividade = 100;
  o.values.paz = -100;
  v.skill = 10;
  v.traits.cautela = 0;
  for (const p of s.people) {
    p.values.solidariedade = 0;
    p.values.familia = 0;
  }
  return s;
}
export function recurringFixture(twoGuardians = false) {
  const s = emotionalize(protectionFixture());
  s.months = 48;
  const [a, b, c, d, e] = s.people;
  s.schedules.forEach((x) => {
    x.from = 0;
    x.until = 239;
    x.period = 1;
    x.absentMonths = 0;
  });
  // Warning is feasible while a direct contest is costly; danger returns after shelter ends.
  d.skill = 50;
  d.traits.cautela = 100;
  d.values.paz = 100;
  c.skill = 800;
  c.traits.coragem = 100;
  c.traits.disciplina = 0;
  c.traits.rancor = 100;
  c.values.vinganca = 100;
  c.values.paz = -100;
  b.values.paz = 100;
  b.traits.coragem = 0;
  a.traits.cautela = 100;
  a.values.paz = 100;
  if (twoGuardians) {
    e.values.solidariedade = 100;
    e.values.paz = 100;
    e.traits.cautela = 100;
    e.skill = 50;
  }
  return s;
}
