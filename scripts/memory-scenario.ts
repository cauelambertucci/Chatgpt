import { emotionalScenario } from "./src/engine/v2/scenario";
export function memoryScenario() {
  const seed = "benchmark-pre-m2-100x100-v1";
  const s = emotionalScenario(seed);
  s.months = 1200;
  s.people = [];
  s.schedules = [];
  s.materials = { paper: 150, ink: 300 };
  for (let cohort = 0; cohort < 5; cohort++) {
    const part = emotionalScenario(`${seed}:cohort:${cohort}`);
    const ids = Object.fromEntries(
      part.people.map((p, i) => [
        p.id,
        `person:${String(cohort * 20 + i).padStart(3, "0")}`,
      ]),
    );
    s.people.push(
      ...part.people.map((p) => ({
        ...p,
        id: ids[p.id],
        name: `${p.name} ${cohort + 1}`,
        kin: p.kin.map((id) => ids[id]),
        ...(p.rival ? { rival: ids[p.rival] } : {}),
      })),
    );
    s.schedules.push(
      ...part.schedules.map((schedule) => ({
        ...schedule,
        id: ids[schedule.id],
        until: 1199,
      })),
    );
    if (cohort === 0) {
      s.focal = ids[part.focal];
      s.victim = ids[part.victim];
      s.offender = ids[part.offender];
      s.helper = ids[part.helper];
    }
  }

  return s;
}
