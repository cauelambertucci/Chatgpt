import { it, expect } from "vitest";
import { writingSaturation, themeProof } from "./writing";
import { SliceSimulation } from "./engine";
import { dailyScenario } from "./daily-scenario";
import { CompactLog, replayCompact } from "./compact-log";
import { auditDailyCompact } from "./daily-audit";
import { validateCompact } from "./validate";
import type { Work, SliceEvent } from "./types";
const fixture = () => {
  const s = dailyScenario("writing-fixture", 12);
  s.mode = "fixture";
  s.months = 36;
  s.bodySimulation!.singleDuel = undefined;
  s.dailyLife!.initialPaper = 60;
  s.dailyLife!.initialInk = 40;
  s.lifeSimulation!.deathMonths = { [s.people[1].id]: 2 };
  for (const person of s.people) {
    person.born = -25;
    person.values.familia = 100;
    person.traits.confianca = 100;
    person.kin = [];
  }
  const p = s.people[0];
  p.values.arte = 100;
  p.traits.criatividade = 100;
  p.skills!.escrita = 80;
  p.values.poder = 0;
  p.traits.ambicao = 0;
  return s;
};
it("cada livro reduz utilidade; variar tema reduz repetição temática sem apagar saturação do formato", () => {
  const works = [{ theme: "death" }, { theme: "death" }] as Work[];
  const a = writingSaturation(works, (id) => id, "death"),
    b = writingSaturation(
      [...works, { theme: "birth" } as Work],
      (id) => id,
      "birth",
    );
  expect(a.formatPenalty).toBe(360);
  expect(a.topicPenalty).toBe(240);
  expect(b.formatPenalty).toBe(540);
  expect(b.topicPenalty).toBe(120);
  expect(writingSaturation([], (id) => id, "death").formatPenalty).toBe(0);
});
it("conhecer um fato exige notícia ou participação registrada, não só constar no mundo", () => {
  const e = {
    id: "event:4",
    seq: 4,
    ano: 0,
    dia: 0,
    month: 0,
    location: "place:void",
    causes: [],
    effects: [],
    type: "partnership.formed",
    participants: [
      { id: "a", role: "actor" },
      { id: "b", role: "reference" },
    ],
    data: { personalWitnesses: ["a", "b"] },
  } as SliceEvent;
  expect(themeProof("a", e.id, e)).toBe(true);
  expect(themeProof("c", e.id, e)).toBe(false);
  expect(themeProof("a", e.id, { ...e, data: {} })).toBe(false);
});
it("temas vividos coexistem com notícias e cada livro ocupa seis meses exclusivos, com replay", () => {
  const s = fixture(),
    sim = new SliceSimulation(s),
    middle = sim.runCompact(12),
    w = new SliceSimulation(s, middle).runCompact(),
    log = CompactLog.from(w.log),
    ev = [...log.view(true)];
  const books = Object.values(w.entities).filter(
    (e): e is Work => e.kind === "work" && e.creator === s.people[0].id,
  );
  expect(books.length).toBeGreaterThan(0);
  expect(
    books.some(
      (b) => log.event(Number(b.theme!.slice(6))).type !== "person.died",
    ),
  ).toBe(true);
  for (const b of books) {
    const periods = ev.filter(
      (e) => e.type === "work.period" && e.data.goal === b.goal,
    );
    expect(periods).toHaveLength(6);
    expect(new Set(periods.map((e) => e.month)).size).toBe(6);
    for (const e of periods) {
      const p = e.effects.find((f) => f.entity.id === b.creator)?.entity;
      expect(p?.kind === "person" && p.workedMonth).toBe(e.month);
    }
  }
  expect(auditDailyCompact(w)).toEqual([]);
  expect(validateCompact(w)).toEqual([]);
  expect(replayCompact(w)).toEqual(w.entities);
});
it("bloquear notícia da morte não impede vivências, mas impede obra sobre aquela morte", () => {
  const s = fixture();
  s.blockedInformation = [s.people[0].id];
  const w = new SliceSimulation(s).runCompact(),
    log = CompactLog.from(w.log),
    books = Object.values(w.entities).filter(
      (e): e is Work => e.kind === "work" && e.creator === s.people[0].id,
    );
  expect(books.length).toBeGreaterThan(0);
  expect(
    books.some(
      (b) => log.event(Number(b.theme!.slice(6))).type === "person.died",
    ),
  ).toBe(false);
});
