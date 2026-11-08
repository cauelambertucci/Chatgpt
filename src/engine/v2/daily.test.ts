import {themeProof} from "./writing";
import { auditDailyCompact } from "./daily-audit";
import { it, expect } from "vitest";
import { dailyScenario } from "./daily-scenario";
import { SliceSimulation } from "./engine";
import { CompactLog, replayCompact } from "./compact-log";
import { validateCompact } from "./validate";
import { domainSeed } from "./daily";
import { sample } from "./rules";
const fixture = () => {
  const s = dailyScenario("2d1-fixture", 12);
  s.mode = "fixture";
  s.months = 36;
  s.bodySimulation!.singleDuel = undefined;
  s.lifeSimulation!.deathMonths = { [s.people[1].id]: 2 };
  const p = s.people[0];
  p.values.arte = 100;
  p.traits.criatividade = 100;
  p.traits.perseveranca = 100;
  p.traits.disciplina = 20;
  p.skills = { escrita: 80, lideranca: 0 };
  p.values.poder = 0;
  p.values.amizade = 0;
  p.values.solidariedade = 0;
  p.traits.compaixao = 0;
  p.medicalSkill = 0;
  p.kin = [];
  return s;
};
const run = (s = fixture()) => new SliceSimulation(s).runCompact();
const events = (w: ReturnType<typeof run>) => [
  ...CompactLog.from(w.log).view(true),
];
it("livro conserva insumos, referencia notícia anterior, dono e replay", () => {
  const s = fixture(),
    w = run(s),
    ev = events(w),
    made = ev.filter(
      (e) =>
        e.type === "work.created" && e.participants[0].id === s.people[0].id,
    );
  expect(made.length).toBeGreaterThan(0);
  const book = w.entities[String(made[0].data.work)];
  expect(book.kind).toBe("work");
  if (book.kind !== "work") return;
  expect(book.owner).toBeTruthy();
  expect(book.knowledgeSource).toBeTruthy();
  const receipt = ev.find((e) => e.id === book.knowledgeSource)!;
  expect(themeProof(book.creator,book.theme!,receipt)).toBe(true);
  expect(receipt.seq).toBeLessThan(made[0].seq);
  const h = Object.values(w.entities).filter((e) => e.kind === "household");
  expect(
    h.every((e) => e.writingStock!.paper >= 0 && e.writingStock!.ink >= 0),
  ).toBe(true);
  expect(replayCompact(w)).toEqual(w.entities);
  expect(validateCompact(w)).toEqual([]);
  expect(auditDailyCompact(w)).toEqual([]);
});
it("sem material não há livro e a tentativa falha com causa", () => {
  const s = fixture();
  s.dailyLife = { initialPaper: 0, initialInk: 0 };
  const ev = events(run(s));
  expect(ev.some((e) => e.type === "work.created")).toBe(false);
  expect(ev.some((e) => e.type === "work.blocked")).toBe(true);
});
it("notícia bloqueada impede tema sobre a morte", () => {
  const s = fixture();
  s.blockedInformation = [s.people[0].id];
  const w = run(s);
  expect(
    Object.values(w.entities).some(
      (e) => e.kind === "work" && e.creator === s.people[0].id && evType(w,e.theme)==="person.died",
    ),
  ).toBe(false);
});
it("limitação manual muda o ofício conforme preferências e tarefa", () => {
  const s = fixture();
  s.months = 1;
  const p = s.people[0];
  p.medicalSkill = 40;
  p.traits.compaixao = 40;
  const before = run(s).entities[p.id];
  s.bodySimulation!.missing = { [p.id]: ["hand.right"] };
  const after = run(s).entities[p.id];
  expect(before.kind === "person" && before.occupation).toBe("criador");
  expect(after.kind === "person" && after.occupation).toBe("cuidador");
  const t = structuredClone(s);
  t.people[0].medicalSkill = 0;
  t.people[0].traits.compaixao = 0;
  t.people[0].values.solidariedade = -100;
  const unwilling = run(t).entities[p.id];
  expect(unwilling.kind === "person" && unwilling.occupation).toBe(
    "sem ofício",
  );
});
it("RNG de ofícios e decisões não consome sorteios da demografia", () => {
  const seed = "domains",
    before = sample(seed, "birth:test", 0, 100000);
  for (let i = 0; i < 100; i++)
    sample(domainSeed(seed, "occupation"), String(i), 0, 100000);
  expect(sample(seed, "birth:test", 0, 100000)).toBe(before);
  expect(domainSeed(seed, "occupation")).not.toBe(
    domainSeed(seed, "friendship"),
  );
});
it("retomada compacta preserva domínio, estoque e objetivos", () => {
  const s = fixture(),
    partial = new SliceSimulation(s).runCompact(8);
  const resumed = new SliceSimulation(s, partial).runCompact();
  expect(resumed).toEqual(run(s));
});

it("crianças não votam nem recebem ofício; o quórum usa adultos presentes", () => {
  const s = fixture();
  s.months = 24;
  const child = s.people[2];
  child.born = -5;
  const candidate = s.people[3];
  candidate.values.poder = 100;
  candidate.traits.ambicao = 100;
  candidate.values.arte = 0;
  const ev = events(run(s));
  expect(
    ev.some(
      (e) =>
        ["leadership.responded", "occupation.changed"].includes(e.type) &&
        e.participants[0]?.id === child.id,
    ),
  ).toBe(false);
  expect(ev.some((e) => e.type === "leadership.requested")).toBe(true);
});
it("validador usa a mesma maioria adulta da eleição", () => {
  const s = fixture();
  s.months = 1;
  const candidate = s.people[3];
  s.people[2].born = -5;
  for (const p of s.people) {
    p.values.poder = 0;
    p.values.amizade = 0;
    p.values.lei = -100;
    p.values.paz = -100;
    p.values.arte = 0;
    p.traits.ambicao = 100;
    p.skills = { escrita: 0, lideranca: 0 };
    p.rival = undefined;
  }
  candidate.values.poder = 100;
  for (const i of [0, 1, 4, 5, 6]) s.people[i].supportFor = candidate.id;
  const w = run(s),
    e = events(w).find((e) => e.type === "leadership.changed");
  expect(e).toBeDefined();
  expect(e!.data.majority).toBe(6);
  expect(validateCompact(w)).toEqual([]);
});
it("proteção continua alcançável no mundo de linhagens quando há ameaça conhecida", async () => {
  const { protectionFixture } = await import("./personal-fixtures");
  const { emotionalize } = await import("./emotional-fixtures");
  const s = emotionalize(protectionFixture());
  s.lifeSimulation = { fertilityPolicy: "replacement-2c" };
  s.bodySimulation = { care: true };
  s.dailyLife = { initialPaper: 6, initialInk: 4 };
  s.advancedObjectives = true;
  const { traits, values } = await import("../../data/v2/personality");
  for (const p of s.people) {
    p.traits = {
      ...Object.fromEntries(Object.keys(traits).map((k) => [k, 50])),
      ...p.traits,
    };
    p.values = {
      ...Object.fromEntries(Object.keys(values).map((k) => [k, 0])),
      ...p.values,
    };
    p.skills = { escrita: 0, lideranca: 0 };
    p.born = -25;
    p.values.poder = 0;
    p.values.arte = 0;
  }
  const w = run(s),
    ev = events(w);
  expect(ev.some((e) => e.type === "protection.assessed")).toBe(true);
  expect(
    Object.values(w.entities).some(
      (e) => e.kind === "personalGoal" && e.type === "proteger",
    ),
  ).toBe(true);
  expect(validateCompact(w)).toEqual([]);
});

function evType(w:ReturnType<typeof run>,id?:string){return id?CompactLog.from(w.log).event(Number(id.slice(6))).type:undefined;}
