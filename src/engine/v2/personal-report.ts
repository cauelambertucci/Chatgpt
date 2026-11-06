import type { SliceWorld, PersonalGoal } from "./types";
import { getPerson } from "./engine";
import { collapsedCausality, prepareCausality } from "./causal";
import { causalAncestors } from "./report";
export interface PersonalStory {
  seed: string;
  goal: string;
  type: PersonalGoal["type"];
  status: string;
  owner: string;
  target: string;
  depth: number;
  score: number;
  intermediateDecisions: number;
  sameMonthNoDecision: boolean;
  rawEvents: string[];
  chain: string[];
  periodsCollapsed: number;
  narrative: string[];
}
const date = (m: number) => `ano ${Math.floor(m / 12)}, mês ${(m % 12) + 1}`;
export const personalGoals = (w: SliceWorld) =>
  Object.values(w.entities).filter(
    (x): x is PersonalGoal => x.kind === "personalGoal",
  );
export function personalStory(
  w: SliceWorld,
  g: PersonalGoal,
  prepared?: ReturnType<typeof prepareCausality>,
): PersonalStory {
  const owner = getPerson(w, g.owner),
    target = getPerson(w, g.target),
    end =
      w.events.find(
        (e) => e.type === "personalGoal.closed" && e.data.goal === g.id,
      )?.id || g.lastEvent,
    graph = prepared ? prepared(end) : collapsedCausality(w, end);
  const narrative = [
    `${owner.name} assumiu o objetivo de ${g.type === "amizade" ? "construir amizade com " + target.name : g.type === "proteger" ? "proteger " + target.name : g.type === "governar" ? "conquistar a coordenação do grupo" : "criar uma obra"} no ${date(g.adopted)}.`,
  ];
  if (g.type === "amizade") {
    const replies = w.events.filter(
      (e) => e.type === "social.responded" && e.data.goal === g.id,
    );
    narrative.push(
      `Foram ${replies.filter((e) => e.data.accepted).length} convites aceitos e ${replies.filter((e) => !e.data.accepted).length} recusados; amizade só foi reconhecida após confiança recíproca.`,
    );
  } else if (g.type === "governar") {
    const election = w.events.find(
      (e) => e.type === "leadership.changed" && e.data.goal === g.id,
    );
    narrative.push(
      election
        ? `Conquistou a coordenação com ${(election.data.voters as string[]).length} apoios públicos; quórum exigido: ${election.data.majority}.`
        : `Solicitou apoio; não obteve a maioria necessária no horizonte.`,
    );
  } else if (g.type === "criar_obra") {
    const work = Object.values(w.entities).find(
      (x) => x.kind === "work" && x.goal === g.id,
    );
    narrative.push(
      work?.kind === "work"
        ? `Concluiu ${work.name}, qualidade ${work.quality}/100, consumindo papel e tinta em seis períodos; tema referenciado: ${work.theme || "expressão pessoal"}.`
        : `Progresso: ${g.progress || 0} períodos; ${g.reason || "obra ainda não concluída"}.`,
    );
  } else {
    const adoption = w.events[Number(g.source.split(":")[1])],
      seen = adoption.causes
        .map((id) => w.events[Number(id.split(":")[1])])
        .find((e) => e.type === "threat.perceived"),
      threat = seen
        ? w.events[Number(String(seen.data.threat).split(":")[1])]
        : undefined;
    if (threat)
      narrative.push(
        `O compromisso nasceu de uma ameaça de ${getPerson(w, String(threat.data.aggressor)).name} que ${owner.name} presenciou, sem notícia global automática.`,
      );
    narrative.push(
      `Respostas de proteção bem-sucedidas: ${g.interventions}. ${target.name} terminou o horizonte ${target.alive ? "vivo" : "morto"}.`,
    );
  }
  narrative.push(
    `Desfecho no ${date(g.closed ?? w.nextMonth - 1)}: ${g.status === "resolved_by_other" ? "resolvido por outro" : g.status || "em andamento"}. ${g.reason || ""}`,
  );
  const adoption = w.events[Number(g.source.split(":")[1])],
    closure = w.events.find((e) => e.id === end)!;
  const rawEvents = causalAncestors(w, end),
    relevant = new Set(rawEvents);
  const decisions = w.events.filter(
    (e) =>
      relevant.has(e.id) &&
      e.seq > adoption.seq &&
      e.seq < closure.seq &&
      (e.decision?.actor === g.owner ||
        (e.type.endsWith(".responded") &&
          typeof e.data.accepted === "boolean" &&
          e.participants.some((p) => p.id === g.owner && p.role === "actor"))),
  );
  const decisionKinds = new Set(
    decisions.map((e) => e.decision?.chosen || e.type),
  ).size;
  const sameMonthNoDecision = g.closed === g.adopted && decisions.length === 0;
  const score =
    graph.depth * 2 +
    Math.min(24, (g.closed ?? g.adopted) - g.adopted) +
    decisionKinds * 4 +
    (g.status === "completed" ? 20 : 0) -
    (sameMonthNoDecision ? 1000 : 0);
  return {
    score,
    intermediateDecisions: decisions.length,
    sameMonthNoDecision,
    seed: w.scenario.seed,
    goal: g.id,
    type: g.type,
    status: g.status || "active",
    owner: owner.name,
    target: target.name,
    depth: graph.depth,
    rawEvents,
    chain: graph.chain,
    periodsCollapsed: graph.episodes.reduce(
      (n, e) => n + Math.max(0, e.periods - 1),
      0,
    ),
    narrative,
  };
}
export function personalStories(w: SliceWorld, limit = 10): PersonalStory[] {
  const prepared = prepareCausality(w);
  return personalGoals(w)
    .map((g) => personalStory(w, g, prepared))
    .filter((s) => s.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || (a.goal < b.goal ? -1 : a.goal > b.goal ? 1 : 0),
    )
    .slice(0, Math.min(10, Math.max(0, limit)));
}
