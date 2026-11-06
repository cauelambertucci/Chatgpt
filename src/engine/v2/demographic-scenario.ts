import { lifeScenario } from "./life-scenario";
export function demographicScenario(
  seed: string,
  count = 12,
  adjusted = false,
) {
  if (![12, 40, 100].includes(count))
    throw Error("Expected 12, 40 or 100 founders");
  const s = lifeScenario(seed, Math.min(count, 20));
  for (let offset = 20; offset < count; offset += 20) {
    const part = lifeScenario(
      `${seed}:founders:${offset / 20}`,
      Math.min(20, count - offset),
    );
    const ids = Object.fromEntries(
      part.people.map((p, i) => [
        p.id,
        `person:${String(offset + i).padStart(2, "0")}`,
      ]),
    );
    s.people.push(
      ...part.people.map((p) => ({
        ...p,
        id: ids[p.id],
        name: `${p.name} ${offset / 20 + 1}`,
        kin: [],
        rival: undefined,
      })),
    );
    s.schedules.push(...part.schedules.map((q) => ({ ...q, id: ids[q.id] })));
  }
  if (s.people.length !== count) throw Error("Wrong founder count");
  if (adjusted) s.lifeSimulation = { fertilityPolicy: "replacement-2c" };
  return s;
}
