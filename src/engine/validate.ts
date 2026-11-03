import { eventTypes } from "../data/catalog";
import type { World } from "../types";
import { entities, checkParams } from "./world";
export function validateWorld(w: World): string[] {
  const errors: string[] = [];
  const fail = (msg: string) => errors.push(msg);
  try {
    checkParams(w.params);
    if (w.version !== 1) fail("Versão desconhecida");
    const all = entities(w),
      ids = new Set(all.map((e) => e.id));
    if (ids.size !== all.length) fail("IDs duplicados");
    for (const entity of all) {
      if (
        typeof entity.name !== "string" ||
        entity.name.length > 1000 ||
        typeof entity.id !== "string" ||
        !/^[a-z][0-9]+$/.test(entity.id)
      )
        fail("Identidade inválida");
    }
    const strings = (v: unknown) =>
      Array.isArray(v) && v.every((s) => typeof s === "string");
    for (const c of w.cultures)
      if (
        typeof c.name !== "string" ||
        typeof c.race !== "string" ||
        !strings(c.traits) ||
        !strings(c.values) ||
        !Array.isArray(c.preferred) ||
        typeof c.religion !== "string" ||
        typeof c.god !== "string"
      )
        fail("Cultura malformada");
    for (const c of w.civs)
      if (
        !/^#[0-9a-fA-F]{6}$/.test(c.color) ||
        typeof c.government !== "string" ||
        !strings(c.resources)
      )
        fail("Civilização malformada");
    for (const p of w.people)
      if (
        !Number.isInteger(p.born) ||
        p.born > w.params.years ||
        typeof p.role !== "string" ||
        typeof p.race !== "string" ||
        typeof p.ambition !== "string" ||
        !strings(p.traits)
      )
        fail("Pessoa malformada");
    const ref = (id: string) => {
      if (!ids.has(id)) fail(`Referência inexistente: ${id}`);
    };
    const person = (id: string) => w.people.find((p) => p.id === id);
    const eventIds = new Set(w.events.map((e) => e.id));
    if (eventIds.size !== w.events.length) fail("Eventos duplicados");
    const cultureIds = new Set(w.cultures.map((c) => c.id));
    const tile = (n: number) => {
      if (!Number.isInteger(n) || n < 0 || n >= w.geography.tiles.length)
        fail("Local inválido");
    };
    if (
      w.geography.size !== w.params.size ||
      w.geography.tiles.length !== w.params.size ** 2
    )
      fail("Dimensões inválidas");
    for (const t of w.geography.tiles) {
      ref(t.region);
      if (t.owner) ref(t.owner);
      if (
        !Number.isFinite(t.elevation) ||
        !Number.isFinite(t.temperature) ||
        !Number.isFinite(t.rain) ||
        !Number.isInteger(t.biome) ||
        t.biome < 0 ||
        t.biome > 10
      )
        fail("Terreno inválido");
    }
    for (const e of w.events) {
      if (
        !(eventTypes as readonly string[]).includes(e.type) ||
        typeof e.consequences !== "string" ||
        !Number.isInteger(e.variant) ||
        e.variant < 0 ||
        e.variant > 2
      )
        fail("Evento malformado");
      if (!Number.isInteger(e.year) || e.year < 0 || e.year > w.params.years)
        fail("Ano inválido");
      ref(e.location);
      e.participants.forEach((id) => {
        ref(id);
        const p = person(id);
        if (p && (p.born > e.year || (p.died !== undefined && p.died < e.year)))
          fail(`Pessoa fora de sua vida: ${id}`);
        const m = w.creatures.find((m) => m.id === id);
        if (m?.slain !== undefined && m.slain < e.year)
          fail("Criatura morta participa de evento");
      });
      if (e.cause && !eventIds.has(e.cause)) fail("Causa inexistente");
    }
    for (const p of w.people) {
      ref(p.civ);
      if (!cultureIds.has(p.culture)) fail("Cultura inválida");
      if (p.died !== undefined && (p.died < p.born || p.died > w.params.years))
        fail("Morte inválida");
      for (const id of p.parents) {
        ref(id);
        const parent = person(id);
        if (
          !parent ||
          p.born - parent.born < 18 ||
          (parent.died !== undefined && parent.died < p.born) ||
          !parent.children.includes(p.id)
        )
          fail("Parentesco inválido");
      }
      for (const id of p.children) {
        ref(id);
        if (!person(id)?.parents.includes(p.id)) fail("Filiação inválida");
      }
      if (p.spouse) {
        ref(p.spouse);
        if (person(p.spouse)?.spouse !== p.id || p.died !== undefined)
          fail("Casamento inválido");
      }
      Object.keys(p.relations).forEach(ref);
      p.deeds.forEach((id) => {
        if (!eventIds.has(id)) fail("Feito inválido");
      });
      p.possessions.forEach((id) => {
        ref(id);
        if (w.artifacts.find((a) => a.id === id)?.owner !== p.id)
          fail("Posse inválida");
      });
    }
    for (const a of w.artifacts) {
      ref(a.creator);
      const creator = person(a.creator);
      if (
        !creator ||
        creator.born > a.created ||
        (creator.died !== undefined && creator.died < a.created)
      )
        fail("Criação fora da vida do autor");
      if (typeof a.material !== "string" || typeof a.properties !== "string")
        fail("Artefato malformado");
      if (a.owner) {
        ref(a.owner);
        if (
          !person(a.owner)?.possessions.includes(a.id) ||
          person(a.owner)?.died !== undefined
        )
          fail("Proprietário inválido");
      }
      if (a.provenance.length === 0 || a.provenance[0].action !== "criação")
        fail("Proveniência ausente");
      let previous = a.created;
      for (const p of a.provenance) {
        if (p.year < previous) fail("Proveniência fora de ordem");
        previous = p.year;
        if (p.holder) ref(p.holder);
        if (!eventIds.has(p.event)) fail("Evento de posse ausente");
        const change = w.events.find((e) => e.id === p.event);
        if (
          change &&
          (change.year !== p.year ||
            change.type !== p.action ||
            !change.participants.includes(a.id))
        )
          fail("Proveniência diverge do evento");
      }
      if (a.provenance.at(-1)?.holder !== a.owner)
        fail("Proveniência diverge da posse");
      if (a.destroyed !== undefined && a.owner)
        fail("Artefato destruído em posse");
    }
    for (const c of w.civs) {
      ref(c.capital);
      ref(c.leader);
      if (!cultureIds.has(c.culture)) fail("Cultura inválida");
      if (person(c.leader)?.died !== undefined) fail("Líder morto");
      if (
        c.population !==
        w.settlements
          .filter((s) => s.civ === c.id)
          .reduce((n, s) => n + s.population, 0)
      )
        fail("População inconsistente");
      Object.keys(c.relations).forEach((id) => {
        ref(id);
        if (
          w.civs.find((o) => o.id === id)?.relations[c.id] !== c.relations[id]
        )
          fail("Diplomacia assimétrica");
      });
    }
    for (const s of w.settlements) {
      ref(s.civ);
      tile(s.tile);
      if (s.population < 0 || (s.abandoned !== undefined && s.population !== 0))
        fail("População inválida");
    }
    for (const m of w.creatures) {
      tile(m.tile);
      if (m.slayer) ref(m.slayer);
    }
    for (const reg of w.geography.regions) tile(reg.tile);
  } catch {
    fail("Estrutura de mundo inválida");
  }
  return errors;
}
export function parseWorld(text: string): World {
  if (text.length > 50_000_000)
    throw Error("Arquivo muito grande (máximo 50 MB)");
  const w = JSON.parse(text) as World;
  const errors = validateWorld(w);
  if (errors.length)
    throw Error(`Mundo inválido: ${errors.slice(0, 3).join("; ")}`);
  return w;
}
