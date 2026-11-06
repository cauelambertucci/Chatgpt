import { collapsedCausality, type CausalEpisode } from "./causal";
import { goals, getPerson } from "./engine";
import type { Outcome, SliceWorld } from "./types";
import { outcomes } from "./types";
export interface Story {
  seed: string;
  mode: "free" | "fixture";
  outcome: Outcome;
  reason: string;
  months: number;
  events: number;
  agent: string;
  target: string;
  victim: string;
  offenseMonth?: number;
  adoptedMonth?: number;
  closedMonth?: number;
  trainingPeriods: number;
  skillGained: number;
  communications: number;
  chain: string[];
  rawDepth: number;
  episodes: CausalEpisode[];
  causalEvents: string[];
  narrative: string[];
}
export function rawCausalChain(w: SliceWorld, end: string): string[] {
  const best = new Map<string, { depth: number; parent?: string }>();
  for (const e of w.events) {
    let parent: string | undefined,
      depth = 0;
    for (const id of e.causes) {
      const prev = best.get(id);
      if (prev && prev.depth > depth) {
        depth = prev.depth;
        parent = id;
      }
    }
    best.set(e.id, { depth: depth + 1, parent });
  }
  const chain: string[] = [];
  let id: string | undefined = end;
  while (id) {
    chain.push(id);
    id = best.get(id)?.parent;
  }
  return chain.reverse();
}
export const causalChain = (w: SliceWorld, end: string) =>
  collapsedCausality(w, end).chain;
export function causalAncestors(w: SliceWorld, end: string): string[] {
  const lookup = new Map(w.events.map((e) => [e.id, e])),
    seen = new Set<string>(),
    pending = [end];
  while (pending.length) {
    const id = pending.pop()!;
    if (seen.has(id)) continue;
    const e = lookup.get(id);
    if (!e) throw Error(`Missing causal event ${id}`);
    seen.add(id);
    pending.push(...e.causes);
  }
  return [...seen].sort((a, b) => lookup.get(a)!.seq - lookup.get(b)!.seq);
}
const when = (month: number) =>
  `ano ${Math.floor(month / 12)}, mês ${(month % 12) + 1}`;
export function story(w: SliceWorld): Story {
  const p = getPerson(w, w.scenario.focal),
    g = goals(w).find((g) => g.owner === p.id),
    target = getPerson(w, w.scenario.offender),
    victim = getPerson(w, w.scenario.victim);
  const close = w.events.find(
    (e) => e.type === "goal.closed" && e.data.goal === g?.id,
  );
  const offense = g ? w.events.find((e) => e.id === g.offense) : undefined;
  const actions = w.events.filter((e) => e.decision?.actor === p.id),
    practice = actions.filter(
      (e) => e.type === "activity.period" && e.data.action === "treinar",
    );
  const outcome = g?.outcome || "objetivo frustrado";
  const reason = close
    ? String(close.data.reason)
    : p.alive
      ? "Nenhum objetivo de vingança foi formado: não houve ofensa conhecida elegível."
      : "O personagem morreu sem encerrar um objetivo de vingança.";
  const trainingPeriods = practice.filter(
      (e) =>
        g &&
        e.month >= g.adopted &&
        (g.closed === undefined || e.month <= g.closed),
    ).length,
    skillGained = practice
      .filter(
        (e) =>
          g &&
          e.month >= g.adopted &&
          (g.closed === undefined || e.month <= g.closed),
      )
      .reduce((n, e) => n + Number(e.data.gain), 0);
  const narrative = [
    `${p.name} e ${victim.name} começaram como familiares; ${target.name} tinha uma rivalidade conhecida com ${victim.name}.`,
  ];
  if (offense)
    narrative.push(
      `No ${when(offense.month)}, ${victim.name} morreu em confronto abstrato, com responsabilidade atribuída a ${getPerson(w, String(offense.data.killer)).name}.`,
    );
  const info = w.events.find(
    (e) =>
      e.type === "information.received" &&
      e.participants.some((x) => x.id === p.id && x.role === "actor") &&
      e.data.offense === offense?.id,
  );
  if (info)
    narrative.push(
      `No ${when(info.month)}, ${p.name} soube por ${info.data.channel}; a notícia deu origem à memória e à avaliação de vingança.`,
    );
  if (g)
    narrative.push(
      `A resposta foi avaliada no ${when(g.adopted)}. Até o desfecho houve ${trainingPeriods} períodos mensais de treino, com ganho de ${skillGained} pontos de habilidade.`,
    );
  const communication = actions.filter(
    (e) => e.decision?.chosen === "comunicar",
  );
  for (const e of communication.slice(0, 2))
    narrative.push(
      `No ${when(e.month)}, ${p.name} escolheu comunicar/pedir ajuda a ${getPerson(w, e.decision!.target!).name}, em vez de impor confronto imediato.`,
    );
  const targetDeath = target.death
    ? w.events.find((e) => e.id === target.death)
    : undefined;
  if (
    targetDeath &&
    close &&
    targetDeath.month <= close.month &&
    targetDeath.data.killer
  )
    narrative.push(
      `No ${when(targetDeath.month)}, ${target.name} morreu em confronto com ${getPerson(w, String(targetDeath.data.killer)).name}; atribuição registrada em ${targetDeath.id}.`,
    );
  if (close)
    narrative.push(`No ${when(close.month)}, desfecho: ${outcome}. ${reason}`);
  else narrative.push(reason);
  const end = close?.id || w.events.at(-1)!.id;
  const collapsed = collapsedCausality(w, end);
  return {
    seed: w.scenario.seed,
    mode: w.scenario.mode,
    outcome,
    reason,
    months: w.nextMonth,
    events: w.events.length,
    agent: p.name,
    target: target.name,
    victim: victim.name,
    offenseMonth: offense?.month,
    adoptedMonth: g?.adopted,
    closedMonth: g?.closed,
    trainingPeriods,
    skillGained,
    communications: communication.length,
    chain: collapsed.chain,
    rawDepth: rawCausalChain(w, end).length,
    episodes: collapsed.episodes,
    causalEvents: causalAncestors(w, end),
    narrative,
  };
}
export function distribution(stories: Story[]) {
  const counts = Object.fromEntries(
    outcomes.map((o) => [o, stories.filter((s) => s.outcome === o).length]),
  ) as Record<Outcome, number>;
  const dominant = outcomes.filter(
    (o) => stories.length > 0 && counts[o] / stories.length >= 0.7,
  );
  return {
    total: stories.length,
    counts,
    dominant,
    warning: dominant.length
      ? `Concentração no limiar de 70% ou acima: ${dominant.join(", ")}. Proposta: inspecionar escores e oportunidades; revisar pesos de paz/vingança, disponibilidade de ajuda e limiares do resolvedor, um fator por vez, sem selecionar desfechos por quota.`
      : null,
  };
}
export function selectStories(stories: Story[]): Story[] {
  const chosen: Story[] = [];
  for (const outcome of [
    "vingança cumprida",
    "reconciliação",
    "alvo morto por outra causa",
    "fuga",
    "desistência",
    "objetivo frustrado",
  ] as Outcome[]) {
    const options = stories
      .filter(
        (s) =>
          s.mode === "free" &&
          s.outcome === outcome &&
          s.offenseMonth !== undefined,
      )
      .sort(
        (a, b) =>
          (b.closedMonth || 0) -
            (b.offenseMonth || 0) -
            ((a.closedMonth || 0) - (a.offenseMonth || 0)) ||
          b.chain.length - a.chain.length,
      );
    if (options[0]) chosen.push(options[0]);
    if (chosen.length === 3) break;
  }
  return chosen;
}
