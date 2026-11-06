import { CompactLog, type CompactWorld } from "../../engine/v2/compact-log";
import { demographicScenario } from "../../engine/v2/demographic-scenario";
import type { Person, SliceEvent } from "../../engine/v2/types";
import type { Life } from "../../engine/v2/life";
import { traits, values } from "../../data/v2/personality";
export const lightScenario = (seed: string) =>
  demographicScenario(seed.trim(), 40, true);
const biographyTypes = new Set([
  "family.founder.registered",
  "person.born",
  "partnership.formed",
  "partnership.ended",
  "guardianship.decided",
  "wound.created",
  "sequela.confirmed",
  "wound.healed",
  "injury.perceived",
  "sequela.perceived",
  "person.transformed",
  "emotion.felt",
  "person.died",
]);
export const date = (month: number) =>
  `ano ${Math.floor(month / 12)}, mês ${(month % 12) + 1}`;
const parts: Record<string, string> = {
  torso: "tronco",
  head: "cabeça",
  "arm.left": "braço esquerdo",
  "arm.right": "braço direito",
  "forearm.left": "antebraço esquerdo",
  "forearm.right": "antebraço direito",
  "hand.left": "mão esquerda",
  "hand.right": "mão direita",
  "leg.left": "perna esquerda",
  "leg.right": "perna direita",
  "foot.left": "pé esquerdo",
  "foot.right": "pé direito",
};
const labels: Record<string, string> = {
  "person.born": "Nascimento",
  "person.died": "Morte",
  "emotion.felt": "Emoção registrada",
  "person.transformed": "Transformação pessoal",
  "wound.created": "Ferimento",
  "sequela.confirmed": "Sequela permanente",
  "wound.healed": "Cicatrização",
  "partnership.formed": "Parceria",
  "partnership.ended": "Fim de parceria",
  "family.founder.registered": "Registro de fundador",
  "guardianship.decided": "Decisão de guarda",
  "injury.perceived": "Percepção de ferimento",
  "sequela.perceived": "Percepção de sequela",
  "needs.period": "Necessidades do período",
  "activity.period": "Atividade do período",
  "decision.made": "Decisão",
  "world.created": "Criação do mundo",
};
export const eventLabel = (e: SliceEvent) =>
  labels[e.type] || `Registro ${e.type}`;
export interface PeopleFilter {
  query?: string;
  status?: string;
  mutilated?: string;
  generation?: string;
}
/** UI projections only: no mutation, simulation decisions, effect expansion or invented history. */
export class Archive {
  readonly log: CompactLog;
  readonly people: Person[];
  readonly facts = new Map<string, number[]>();
  readonly generations = new Map<string, number | null>();
  readonly children = new Map<string, string[]>();
  readonly missing = new Set<string>();
  readonly highlights: number[] = [];
  constructor(readonly world: CompactWorld) {
    this.log = CompactLog.from(world.log);
    this.people = Object.values(world.entities).filter(
      (p): p is Person => p.kind === "person",
    );
    for (const e of Object.values(world.entities)) {
      if (e.kind === "life")
        for (const parent of e.parents)
          this.children.set(parent, [
            ...(this.children.get(parent) || []),
            e.owner,
          ]);
      if (e.kind === "bodyPart" && !e.present) this.missing.add(e.owner);
    }
    for (const p of this.people) this.generation(p.id);
    for (const e of this.log.select(biographyTypes)) {
      this.highlights.push(e.seq);
      for (const id of new Set(e.participants.map((p) => p.id))) {
        let ids = this.facts.get(id);
        if (!ids) {
          ids = [];
          this.facts.set(id, ids);
        }
        ids.push(e.seq);
      }
    }
  }
  name(id: unknown) {
    const e = typeof id === "string" ? this.world.entities[id] : undefined;
    return e?.kind === "person" ? e.name : "Pessoa não identificada";
  }
  life(id: string): Life | undefined {
    const e = this.world.entities[`life:${id}`];
    return e?.kind === "life" ? e : undefined;
  }
  event(id: string | number) {
    const n =
      typeof id === "number"
        ? id
        : /^event:\d+$/.test(id)
          ? Number(id.slice(6))
          : -1;
    return Number.isInteger(n) && n >= 0 && n < this.world.log.rows.length
      ? this.log.event(n)
      : undefined;
  }
  generation(id: string, path = new Set<string>()): number | null {
    if (this.generations.has(id)) return this.generations.get(id)!;
    if (path.has(id)) return null;
    const life = this.life(id);
    if (!life) return null;
    if (!life.parents.length) {
      const g = this.world.scenario.people.some((p) => p.id === id) ? 0 : null;
      this.generations.set(id, g);
      return g;
    }
    const next = new Set(path).add(id),
      gs = life.parents.map((p) => this.generation(p, next));
    const g = gs.some((g) => g === null)
      ? null
      : 1 + Math.max(...(gs as number[]));
    this.generations.set(id, g);
    return g;
  }
  filter(f: PeopleFilter) {
    const normalize = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR");
    return this.people.filter(
      (p) =>
        (!f.query ||
          normalize(`${p.name} ${p.id}`).includes(normalize(f.query))) &&
        (!f.status || (f.status === "alive") === p.alive) &&
        (!f.mutilated || (f.mutilated === "yes") === this.missing.has(p.id)) &&
        (!f.generation || String(this.generation(p.id)) === f.generation),
    );
  }
  introduction(id: string) {
    const p = this.world.entities[id];
    if (p?.kind !== "person") return "Pessoa não registrada.";
    const l = this.life(id),
      founder = this.world.scenario.people.some((p) => p.id === id);
    const origin = founder
      ? `${p.name} integrava o grupo fundador${l ? `, com ${Math.floor(-l.birthMonth / 12)} anos no início` : ""}. Não há infância simulada nem ancestrais registrados para os fundadores.`
      : `${p.name} nasceu durante a simulação${l ? `, no ${date(l.birthMonth)}` : ""}.`;
    return `${origin} ${p.alive ? "Permanecia com vida ao fim do período gerado." : "Há registro de sua morte no período gerado."} Geração ${this.generation(id) ?? "não determinada"} (fundadores = 0).`;
  }
  biography(id: string) {
    const ids = new Set(this.facts.get(id) || []);
    for (const n of [...ids]) {
      const e = this.event(n)!;
      if (e.type === "partnership.ended" && typeof e.data.death === "string") {
        const death = this.event(e.data.death);
        if (death?.type === "person.died") ids.add(death.seq);
      }
    }
    // Deaths of directly registered biological relatives are facts, not inferred perceptions.
    for (const relative of [
      ...(this.life(id)?.parents || []),
      ...(this.children.get(id) || []),
    ]) {
      const p = this.world.entities[relative];
      if (p?.kind === "person" && p.death) {
        const e = this.event(p.death);
        if (e) ids.add(e.seq);
      }
    }
    return [...ids].sort((a, b) => a - b).map((n) => this.event(n)!);
  }
  narrate(e: SliceEvent): string {
    const d = e.data,
      actor = e.participants.find((p) => p.role === "actor")?.id,
      victim = e.participants.find((p) => p.role === "victim")?.id;
    const names = (ids: unknown) =>
      Array.isArray(ids)
        ? ids
            .filter((id): id is string => typeof id === "string")
            .map((id) => this.name(id))
            .join(" e ")
        : "";
    const wound =
      typeof d.wound === "string" ? this.world.entities[d.wound] : undefined;
    const part =
      typeof d.part === "string"
        ? d.part
        : wound?.kind === "wound"
          ? wound.part
          : undefined;
    const location = part ? ` em ${parts[part] || part}` : "";
    let text: string;
    switch (e.type) {
      case "family.founder.registered":
        text = `O arquivo incluiu ${this.name(e.participants[0]?.id)} no grupo fundador; a história anterior não foi simulada.`;
        break;
      case "person.born":
        text = `Nasceu ${this.name(e.participants[0]?.id)}${names(d.parents) ? `, com parentesco biológico registrado com ${names(d.parents)}` : ""}.`;
        break;
      case "partnership.formed":
        text = `${names(e.participants.map((p) => p.id))} formaram parceria.`;
        break;
      case "partnership.ended":
        text = `Terminou a parceria registrada entre ${names(e.participants.map((p) => p.id))}${typeof d.cause === "string" ? `; motivo registrado: ${d.cause}` : ""}.`;
        break;
      case "guardianship.decided":
        text = `Foi decidida a guarda de ${this.name(d.child)}${names(d.guardians) ? `; responsáveis registrados: ${names(d.guardians)}` : ""}${typeof d.reason === "string" ? `. Motivo: ${d.reason}` : ""}.`;
        break;
      case "wound.created":
        text = `${this.name(victim)} sofreu um ferimento${location}${d.amputation === true ? ", com amputação registrada" : ""}${d.fracture === true ? ", com fratura registrada" : ""}${d.nerve === true ? ", com lesão nervosa registrada" : ""}.`;
        break;
      case "sequela.confirmed":
        text = `Foi confirmada uma sequela permanente de ${this.name(actor)}${location}.`;
        break;
      case "wound.healed":
        text = `Foi registrada a cicatrização do ferimento de ${this.name(actor)}${location}.`;
        break;
      case "injury.perceived":
      case "sequela.perceived":
        text = `${this.name(actor)} recebeu informação sobre ${e.type === "sequela.perceived" ? "a sequela" : "o ferimento"} de ${this.name(d.subject)}.`;
        break;
      case "emotion.felt":
        text = `Foi registrada para ${this.name(actor)} uma emoção${typeof d.emotion === "string" ? `: “${d.emotion}”` : ""}.${typeof d.stressBefore === "number" && typeof d.stressAfter === "number" ? ` O estresse passou de ${d.stressBefore} para ${d.stressAfter}.` : ""}`;
        break;
      case "person.transformed": {
        const changes: string[] = [];
        for (const [key, before, after, dict] of [
          ["facet", "facetBefore", "facetAfter", traits],
          ["value", "valueBefore", "valueAfter", values],
        ] as const) {
          if (
            typeof d[key] === "string" &&
            typeof d[before] === "number" &&
            typeof d[after] === "number"
          )
            changes.push(
              `${(dict as Record<string, string>)[d[key] as string] || d[key]} passou de ${d[before]} para ${d[after]}`,
            );
        }
        text = changes.length
          ? `Em ${this.name(actor)}, ${changes.join("; ")}.`
          : `Foi registrada uma transformação de ${this.name(actor)}; os valores não estão informados.`;
        break;
      }
      case "person.died":
        text = `${this.name(d.victim ?? victim)} morreu${typeof d.cause === "string" ? `; causa registrada: ${d.cause}` : ""}${typeof d.killer === "string" ? `. A autoria da morte foi atribuída a ${this.name(d.killer)}` : ""}.`;
        break;
      default:
        text = `${eventLabel(e)}.${e.participants.length ? ` Participantes registrados: ${names(e.participants.map((p) => p.id))}.` : ""}`;
    }
    return `No ${date(e.month)}: ${text}`;
  }
}
