import { settlementScenario } from "./politics";
/** Controlled initial conditions, not a free seed or quota of outcomes. Casualty RNG unchanged. */
export function politicalWarFixture() {
  const s = settlementScenario("marco3-fixture-guerra", 40);
  s.mode = "fixture";
  s.months = 180;
  for (const p of s.people) {
    p.born = -25;
    Object.assign(p.traits, {
      agressividade: 100,
      rancor: 100,
      coragem: 100,
      cautela: 0,
      compaixao: 0,
      autocontrole: 0,
      confianca: 100,
    });
    Object.assign(p.values, {
      paz: -100,
      poder: 100,
      vinganca: 100,
      familia: 100,
    });
  }
  // The two duelists remain in different founder homes. Other adults form families normally.
  s.people[0].values.familia = -100;
  s.people[1].values.familia = -100;
  s.bodySimulation = {
    ...s.bodySimulation,
    fixture: true,
    maxExchanges: 1,
    singleDuel: {
      attacker: s.people[0].id,
      defender: s.people[1].id,
      caregiver: s.people[2].id,
      month: 120,
    },
  };
  return s;
}
