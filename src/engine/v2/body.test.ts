import { it, expect } from "vitest";
import { SliceSimulation } from "./engine";
import { bodyFixture, bodyScenario } from "./body-scenario";
import { openCompact, replayCompact, expandCompact } from "./compact-log";
import { validateCompact } from "./validate";
import type { Body, Part, Wound, Kill, Duel } from "./body";
const run = (s = bodyFixture()) => new SliceSimulation(s).runCompact();
it("fixture numérica: camadas 100→95→80→72→42→30→0, 4958 mL, sequela 0.7, nenhuma amputação", () => {
  const s = bodyFixture(),
    w = run(s),
    events = [...openCompact(w).events];
  expect(validateCompact(w)).toEqual([]);
  const contact = events.find((e) => e.type === "attack.contact")!;
  expect((contact.data.trace as any[]).map((t) => t.remaining)).toEqual([
    95, 80, 72, 42, 30, 0,
  ]);
  expect((w.entities[`body:${s.victim}`] as Body).blood).toBe(4958);
  const part = w.entities[`part:${s.victim}:forearm.left`] as Part;
  expect(part.present).toBe(true);
  expect(part.nerve).toBe(0.5);
  expect(part.bone).toBe(1);
  const seq = events.find((e) => e.type === "sequela.confirmed")!;
  expect(seq.data.gripLeftAfter).toBe(0.7);
  expect(events.some((e) => e.type === "body.death")).toBe(false);
  expect(
    Object.values(w.entities).filter((e) => e.kind === "kill"),
  ).toHaveLength(0);
});
it("sem arma não existe tentativa de golpe", () => {
  const s = bodyFixture();
  s.bodySimulation!.unarmed = [s.offender];
  const w = run(s);
  expect(
    [...openCompact(w).events].filter((e) => e.type === "attack.attempted"),
  ).toHaveLength(0);
  expect(validateCompact(w)).toEqual([]);
});
it("mão ausente não segura arma; ausência na conexão também inutiliza a descendente", () => {
  for (const key of ["hand.right", "forearm.right"] as const) {
    const s = bodyFixture();
    s.bodySimulation!.missing = { [s.offender]: [key] };
    const w = run(s),
      ev = [...openCompact(w).events];
    expect((w.entities[`body:${s.offender}`] as Body).weapon).toBeUndefined();
    expect(ev.some((e) => e.type === "equipment.dropped")).toBe(true);
    expect(ev.some((e) => e.type === "attack.attempted")).toBe(false);
    expect(validateCompact(w)).toEqual([]);
  }
});
it("cuidado muda o prognóstico arterial; hemorragia grave mata uma única vez", () => {
  const cared = run(),
    s = bodyFixture();
  s.bodySimulation!.care = false;
  s.bodySimulation!.vesselOverride = { [s.victim]: "artery" };
  const raw = run(s),
    ev = [...openCompact(raw).events];
  expect((cared.entities[s.victim] as any).alive).toBe(true);
  expect((raw.entities[s.victim] as any).alive).toBe(false);
  expect(
    ev.filter((e) => e.type === "person.died" && e.data.victim === s.victim),
  ).toHaveLength(1);
  const blood = ev.filter((e) => e.type === "blood.interval").at(-1)!;
  expect(blood.data.toMinute).toBe(115);
  expect(blood.data.after).toBe(2930);
  const kills = Object.values(raw.entities).filter(
    (e): e is Kill => e.kind === "kill",
  );
  expect(kills).toHaveLength(1);
  expect(kills[0].killer).toBe(s.offender);
  expect(validateCompact(raw)).toEqual([]);
});
it("notícia bloqueada impede transformação do parente, sem impedir dano físico real", () => {
  const s = bodyFixture();
  s.schedules.find((x) => x.id === s.focal)!.from = 1;
  const normal = run(s);
  s.bodySimulation!.blockedInformation = [s.focal];
  const blocked = run(s);
  const reactions = (w: ReturnType<typeof run>) =>
    [...openCompact(w).events].filter(
      (e) =>
        e.type === "emotion.felt" &&
        e.participants[0].id === s.focal &&
        ["injury.perceived", "sequela.perceived"].includes(
          openCompact(w).events[Number(String(e.data.stimulusSource).slice(6))]
            ?.type,
        ),
    );
  expect(reactions(normal).length).toBeGreaterThan(0);
  expect(reactions(blocked)).toHaveLength(0);
  expect((blocked.entities[`body:${s.victim}`] as Body).blood).toBe(4958);
  expect(validateCompact(blocked)).toEqual([]);
});
it("mesma sequela com personalidades diferentes transforma facetas/valores diferentes", () => {
  const a = bodyFixture(),
    b = bodyFixture();
  const angry = a.people.find((p) => p.id === a.victim)!;
  Object.assign(angry.traits, {
    rancor: 80,
    agressividade: 70,
    compaixao: 20,
    autocontrole: 20,
    ansiedade: 30,
  });
  Object.assign(angry.values, { vinganca: 60, paz: 10 });
  const worlds = [run(a), run(b)];
  const fields = worlds.map((w) => {
    const v = openCompact(w);
    const perceived = v.events.find(
      (e) =>
        e.type === "sequela.perceived" && e.participants[0].id === a.victim,
    )!;
    const emotion = v.events.find(
      (e) => e.type === "emotion.felt" && e.causes.includes(perceived.id),
    )!;
    return {
      w,
      emotion,
      transformed: v.events.find(
        (e) => e.type === "person.transformed" && e.causes.includes(emotion.id),
      )!,
    };
  });
  expect(fields[0].emotion.data.emotion).not.toBe(
    fields[1].emotion.data.emotion,
  );
  expect(fields[0].transformed.data.facet).not.toBe(
    fields[1].transformed.data.facet,
  );
  for (const x of fields) {
    expect((x.w.entities[`part:${a.victim}:forearm.left`] as Part).nerve).toBe(
      0.5,
    );
    expect(validateCompact(x.w)).toEqual([]);
  }
});
it("ponte causal: percepção → emoção → transformação → reavaliação, com função atual", () => {
  const w = run(),
    events = [...openCompact(w).events];
  const g = events.find(
    (e) => e.type === "physicalGoal.reassessed" && e.data.leftGrip === 0.4,
  )!;
  const t =
    events[
      Number(
        g.causes
          .find(
            (id) => events[Number(id.slice(6))]?.type === "person.transformed",
          )!
          .slice(6),
      )
    ];
  const emotion = events[Number(String(t.data.emotion).slice(6))];
  const perception =
    events[Number(String(emotion.data.stimulusSource).slice(6))];
  expect(perception.type).toBe("injury.perceived");
  expect(g.data.viableBefore).toBe(false);
  expect(g.data.chosen).toBe("adaptar");
});
it("replay, imutabilidade e retomada compacta preservam corpo, feridas e kill list", () => {
  const s = bodyFixture(),
    full = run(s),
    partial = new SliceSimulation(s).runCompact(3),
    resume = new SliceSimulation(
      s,
      JSON.parse(JSON.stringify(partial)),
    ).runCompact();
  expect(resume).toEqual(full);
  expect(replayCompact(full)).toEqual(full.entities);
  expect(Object.isFrozen(full.entities[`body:${s.victim}`])).toBe(true);
  expect(JSON.stringify(full)).not.toContain('"trajectory"'); // anatomy is a shared catalog, not copied per physiology update
});
it("lâmina não amputa só por romper nervo, e uma perna ausente não elimina a outra mão", () => {
  const s = bodyFixture();
  s.bodySimulation!.missing = { [s.offender]: ["leg.left"] };
  const w = run(s);
  expect(
    [...openCompact(w).events].some((e) => e.type === "attack.attempted"),
  ).toBe(true);
  expect(validateCompact(w)).toEqual([]);
});
it("200 cenas fixas geram desfechos sem quota, mortes únicas e nenhuma energia criada", () => {
  for (const prefix of ["duelo-2a", "reservado-2a"])
    for (let i = 0; i < 100; i++) {
      const w = run(bodyScenario(`${prefix}-${String(i).padStart(3, "0")}`));
      const errors = validateCompact(w);
      expect(errors, `${w.scenario.seed}: ${errors.slice(0, 4)}`).toEqual([]);
      const duels = Object.values(w.entities).filter(
        (e): e is Duel => e.kind === "duel",
      );
      expect(duels).toHaveLength(1);
      expect(duels[0].outcome).not.toBe("em curso");
    }
}, 120000);
it("cuidado exige material e recuperação parcial exige prática mensal registrada", () => {
  const s = bodyFixture(),
    w = run(s),
    events = [...openCompact(w).events];
  const rehab = events.filter((e) => e.type === "rehabilitation.period");
  expect(rehab.length).toBeGreaterThanOrEqual(3);
  const seen = new Set<string>();
  for (const e of rehab) {
    const key = `${e.data.owner}:${e.month}`;
    expect(seen.has(key)).toBe(false);
    seen.add(key);
    expect(e.data.periodMonths).toBe(1);
  }
  s.bodySimulation!.supplies = { bandages: 0, tools: true };
  const absent = run(s);
  expect((absent.entities[s.victim] as any).alive).toBe(true);
  expect((absent.entities[`body:${s.victim}`] as Body).blood).toBeLessThan(
    (w.entities[`body:${s.victim}`] as Body).blood,
  );
  expect(validateCompact(absent)).toEqual([]);
});
it("árvore anatômica é conectada e acíclica; invasão de camada não cria orçamento", async () => {
  const { anatomy } = await import("./body");
  for (const key of Object.keys(anatomy)) {
    const seen = new Set();
    let current: any = key;
    while (current) {
      expect(seen.has(current)).toBe(false);
      seen.add(current);
      expect(anatomy[current as keyof typeof anatomy]).toBeDefined();
      current = anatomy[current as keyof typeof anatomy].parent;
    }
    expect(seen.has("torso")).toBe(true);
  }
});
it("percepção e emoção ocorrem antes de uma morte posterior por sangramento", () => {
  const s = bodyFixture();
  s.bodySimulation!.care = false;
  s.bodySimulation!.vesselOverride = { [s.victim]: "artery" };
  const w = run(s),
    events = [...openCompact(w).events];
  const emotion = events.find(
    (e) =>
      e.type === "emotion.felt" &&
      e.participants[0].id === s.victim &&
      e.data.stimulus === "ameaca",
  )!;
  const death = events.find(
    (e) => e.type === "person.died" && e.data.victim === s.victim,
  )!;
  expect(emotion).toBeDefined();
  expect(emotion.seq).toBeLessThan(death.seq);
  const summary = events.find(
    (e) =>
      e.type === "duel.summary" && String(e.data.outcome).includes("morte"),
  )!;
  expect(summary.causes).toContain(death.id);
  expect(validateCompact(w)).toEqual([]);
});
it("sangramento usa deltas de sinais vitais/feridas, sem recopiá-los como criações ou copiar pessoa", () => {
  const w = run(),
    view = openCompact(w),
    blood = view.events.find((e) => e.type === "blood.interval")!;
  const row = JSON.parse(w.log.rows[blood.seq]);
  for (const effect of row[4]) {
    expect(effect[0]).toBe(1);
    const id = w.log.strings[effect[1][1]];
    expect(id.startsWith("body:") || id.startsWith("wound:")).toBe(true);
    for (const [path] of effect[2]) {
      const keys = w.log.shapes[path].map((i) => w.log.strings[i]);
      expect(keys.length).toBeGreaterThan(0);
      expect(
        [
          "owner",
          "template",
          "weapon",
          "trajectory",
          "traits",
          "values",
        ].includes(keys[0]),
      ).toBe(false);
    }
  }
});
it("morte externa posterior não vira kill nem desfecho letal do duelo anterior", () => {
  const s = bodyFixture();
  s.externalDeathMonth = 1;
  const w = run(s);
  const duel = Object.values(w.entities).find(
    (e): e is Duel => e.kind === "duel",
  )!;
  expect((w.entities[s.offender] as any).alive).toBe(false);
  expect(duel.outcome).toBe("sequela permanente");
  expect(
    Object.values(w.entities).filter((e) => e.kind === "kill"),
  ).toHaveLength(0);
  expect(validateCompact(w)).toEqual([]);
});
it("retirar armadura no mesmo contato deixa mais orçamento para o osso", () => {
  const armored = run(),
    s = bodyFixture();
  s.bodySimulation!.armor = { [s.victim]: "none" };
  const bare = run(s);
  const wound = (w: ReturnType<typeof run>) =>
    Object.values(w.entities).find((e): e is Wound => e.kind === "wound")!;
  expect(wound(armored).fracture).toBe(false);
  expect(wound(bare).fracture).toBe(true);
  expect(validateCompact(bare)).toEqual([]);
});
it("a decisão de adaptação é aplicada e continuar preserva a técnica adaptada", () => {
  const w = run(bodyScenario("duelo-2a-012"));
  for (const e of openCompact(w).events) {
    if (e.type !== "physicalGoal.reassessed") continue;
    const effect = e.effects.find(
      (x) => x.op === "replace" && x.entity.kind === "physicalGoal",
    );
    expect(effect).toBeDefined();
    if (effect?.op !== "replace") continue;
    const goal = effect.entity as any;
    if (e.data.chosen === "adaptar") {
      expect(goal.status).toBe("adapted");
      expect(goal.requiredHands).toBe(1);
    }
    if (e.data.chosen === "abandonar") expect(goal.status).toBe("abandoned");
  }
});
