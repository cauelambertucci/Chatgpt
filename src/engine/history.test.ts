import { it, expect } from "vitest";
import { generate } from "./world";
import { validateWorld } from "./validate";
const params = { seed: "aurora", size: 32, years: 500, civs: 5, chaos: 0.7 };
it("reproduz toda a história e cobre pelo menos 15 tipos", () => {
  const w = generate(params);
  expect(w).toEqual(generate(params));
  expect(new Set(w.events.map((e) => e.type)).size).toBeGreaterThanOrEqual(15);
});
it("valida 100 seeds com famílias, eventos e proveniência consistentes", () => {
  for (let i = 0; i < 100; i++) {
    const w = generate({
      ...params,
      seed: `seed-${i}`,
      years: i % 10 === 0 ? 1000 : 100,
      civs: 3 + (i % 6),
    });
    expect(validateWorld(w), `seed-${i}`).toEqual([]);
  }
}, 30000);
it("detecta referências quebradas e pessoas mortas em eventos futuros", () => {
  const w = generate(params);
  w.events.push({
    ...w.events[0],
    id: "bad",
    year: 500,
    participants: ["inexistente"],
  });
  expect(validateWorld(w).length).toBeGreaterThan(0);
  const dead = w.people.find((p) => p.died !== undefined && p.died < 500)!;
  w.events.at(-1)!.participants = [dead.id];
  expect(validateWorld(w).some((e) => e.includes("fora de sua vida"))).toBe(
    true,
  );
});
it("gera 500 anos e cinco civilizações em menos de 10 segundos", () => {
  const start = performance.now();
  const w = generate({ ...params, size: 128 });
  expect(validateWorld(w)).toEqual([]);
  expect(performance.now() - start).toBeLessThan(10000);
});
