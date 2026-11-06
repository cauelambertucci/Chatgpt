import { CompactLog, openCompact, type CompactWorld } from "./compact-log";
import type { SliceWorld, Person, SliceEvent } from "./types";
import type { Life, Pregnancy } from "./life";
export function auditLife(w: SliceWorld) { return auditLifeEvents(w, w.events); }
export function auditLifeCompact(w: CompactWorld) {
  return auditLifeEvents(openCompact(w), CompactLog.from(w.log).select(new Set([
    "person.born", "person.died", "pregnancy.conceived", "population.balance", "attack.attempted",
  ])));
}
function auditLifeEvents(w: SliceWorld, events: Iterable<SliceEvent>) {
  if (!w.scenario.lifeSimulation) return [];
  const errors: string[] = [],
    people = Object.values(w.entities).filter(
      (e): e is Person => e.kind === "person",
    ),
    life = Object.values(w.entities).filter(
      (e): e is Life => e.kind === "life",
    ),
    by = new Map(life.map((l) => [l.owner, l]));
  const visiting = new Set<string>(),
    done = new Set<string>();
  const dfs = (id: string) => {
    if (visiting.has(id)) {
      errors.push(`ascendência cíclica: ${id}`);
      return;
    }
    if (done.has(id)) return;
    visiting.add(id);
    for (const p of by.get(id)?.parents || []) dfs(p);
    visiting.delete(id);
    done.add(id);
  };
  for (const l of life) {
    dfs(l.owner);
    const p = w.entities[l.owner];
    if (p?.kind !== "person") errors.push(`vida sem pessoa: ${l.id}`);
    if (w.entities[l.household]?.kind !== "household")
      errors.push(`domicílio inválido: ${l.id}`);
    if (w.scenario.people.some((p) => p.id === l.owner) && l.parents.length)
      errors.push(`ancestral fabricado: ${l.owner}`);
    for (const parent of l.parents)
      if (!by.has(parent) || by.get(parent)!.birthMonth + 216 > l.birthMonth)
        errors.push(`pai ausente/menor: ${l.id}`);
    for (const guardian of l.guardians)
      if (!by.has(guardian)) errors.push(`responsável ausente: ${l.id}`);
    if (l.partner && by.get(l.partner)?.partner !== l.owner)
      errors.push(`parceria unilateral: ${l.id}`);
    if (w.entities[`body:${l.owner}`]?.kind !== "body")
      errors.push(`pessoa sem corpo: ${l.id}`);
  }
  const born = new Set<string>(),
    deaths = new Set<string>();
  let live = w.scenario.people.length;
  for (const e of events) {
    if (e.type === "person.born") {
      const id = e.participants[0].id;
      if (born.has(id)) errors.push(`nascimento duplicado: ${id}`);
      born.add(id);
      live++;
      const g = w.entities[String(e.data.pregnancy)] as Pregnancy;
      if (
        g?.kind !== "pregnancy" ||
        g.child !== id ||
        g.status !== "born" ||
        g.due !== e.month ||
        e.month - g.conceived !== 9
      )
        errors.push(`gestação inválida: ${e.id}`);
      if (e.data.memoriesCreated !== 0)
        errors.push(`infância inventada: ${e.id}`);
      for (const [trait, v] of Object.entries(
        e.data.inheritance as Record<string, any>,
      )) {
        if (
          by.get(g.parents[0])?.genes[trait] !== v.maternal ||
          by.get(g.parents[1])?.genes[trait] !== v.paternal ||
          by.get(id)?.genes[trait] !== v.genetic
        )
          errors.push(`herança sem procedência: ${e.id}`);
      }
    }
    if (e.type === "person.died") {
      const id = String(e.data.victim);
      if (deaths.has(id)) errors.push(`morte duplicada: ${id}`);
      deaths.add(id);
      live--;
      if (
        e.data.natural &&
        (e.data.killer !== null || w.entities[`kill:${id}`])
      )
        errors.push(`morte natural atribuída: ${id}`);
    }
    if (e.type === "pregnancy.conceived") {
      const g = w.entities[String(e.data.pregnancy)] as Pregnancy;
      for (const p of g.parents)
        if (deaths.has(p) || e.month - by.get(p)!.birthMonth < 216)
          errors.push(`concepção inelegível: ${e.id}`);
    }
    if (
      e.type === "population.balance" &&
      (e.data.living !== live ||
        e.data.initial !== w.scenario.people.length ||
        e.data.births !== born.size ||
        e.data.deaths !== deaths.size)
    )
      errors.push(`balanço não fecha: ${e.id}`);
    if (e.type === "attack.attempted") {
      const id = e.participants[0].id;
      if (e.month - by.get(id)!.birthMonth < 216)
        errors.push(`menor combate: ${e.id}`);
    }
  }
  if (
    live !== people.filter((p) => p.alive).length ||
    people.length !== w.scenario.people.length + born.size
  )
    errors.push("balanço final não fecha");
  if (life.length !== people.length)
    errors.push("cadastros de vida incompletos");
  return errors;
}
export function lineageDepth(entities: SliceWorld["entities"]) {
  const memo = new Map<string, number>();
  const visit = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    const l = entities[`life:${id}`] as Life;
    const n = 1 + Math.max(0, ...l.parents.map(visit));
    memo.set(id, n);
    return n;
  };
  for (const e of Object.values(entities))
    if (e.kind === "life") visit(e.owner);
  return memo;
}
