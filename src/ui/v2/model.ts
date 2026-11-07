import { CompactLog, type CompactWorld } from "../../engine/v2/compact-log";
import { dailyScenario } from "../../engine/v2/daily-scenario";
import type { Person, SliceEvent } from "../../engine/v2/types";
import {
  FamilyHistory,
  familyTypes,
  stringIds,
  type Partnership,
} from "./family";
import { eventLabel, eventLabels, routineTypes, readable } from "./labels";
export { eventLabel } from "./labels";
import { traits, values } from "../../data/v2/personality";
export const lightScenario = (seed: string) => dailyScenario(seed.trim(), 40);
const biographyTypes = new Set([
  "occupation.changed",
  "occupation.care.offered",
  "care.requested",
  "care.compression",
  "care.controlled",
  "work.started",
  "work.created",
  "work.blocked",
  "work.transferred",
  "work.estate.recorded",
  "friendship.formed",
  "leadership.changed",
  "personalGoal.closed",
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
  "information.received",
  "family.loss.perceived",
  "pregnancy.lost",
  "duel.agreed",
  "duel.ended",
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
  readonly family: FamilyHistory;
  readonly children: Map<string, string[]>;
  readonly missing = new Set<string>();
  readonly highlights: number[] = [];
  readonly displayNames = new Map<string, string>();
  constructor(readonly world: CompactWorld) {
    this.log = CompactLog.from(world.log);
    this.people = Object.values(world.entities).filter(
      (p): p is Person => p.kind === "person",
    );
    this.family = new FamilyHistory(this.log.select(familyTypes));
    this.children = this.family.children;
    const counts = new Map<string, number>();
    for (const p of this.people)
      counts.set(p.name, (counts.get(p.name) || 0) + 1);
    for (const p of this.people) {
      const source = this.family.births.get(p.id)?.source;
      this.displayNames.set(
        p.id,
        (counts.get(p.name) || 0) > 1
          ? `${p.name} (registro ${source?.replace("event:", "") || p.id})`
          : p.name,
      );
    }
    for (const e of Object.values(world.entities))
      if (e.kind === "bodyPart" && !e.present) this.missing.add(e.owner);
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
    return e?.kind === "person"
      ? this.displayNames.get(e.id) || e.name
      : "Pessoa não identificada";
  }
  life(id: string) {
    return this.family.births.get(id);
  }
  isAlive(id: string) {
    return this.family.isAlive(id);
  }
  lifeSpan(id: string) {
    const b = this.life(id),
      d = this.family.deaths.get(id),
      born =
        b?.month === undefined
          ? "nascimento não registrado"
          : `nascimento: ano ${Math.floor(b.month / 12)}`;
    if (!d)
      return `${born} · ${this.isAlive(id) ? "viva" : "situação não registrada"}`;
    const age = this.family.age(id, d.month);
    return `${born} · morta: ano ${Math.floor(d.month / 12)}${age === undefined ? "" : `, aos ${age} anos`}`;
  }
  partnershipReason(p: Partnership) {
    if (p.end === undefined)
      return p.people.some((id) => this.family.deaths.has(id))
        ? "fim não registrado"
        : "vigente";
    if (p.reason === "morte") return "morte";
    if (p.reason && /ruptura|separação|separacao/.test(p.reason))
      return "ruptura";
    return p.reason ? readable(p.reason) : "motivo não registrado";
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
  generation(id: string) {
    return this.family.generation(id);
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
        (!f.status ||
          (f.status === "alive"
            ? this.isAlive(p.id)
            : this.family.deaths.has(p.id))) &&
        (!f.mutilated || (f.mutilated === "yes") === this.missing.has(p.id)) &&
        (!f.generation || String(this.generation(p.id)) === f.generation),
    );
  }
  relation(observer: string, subject: string, month: number) {
    if (this.family.parents(observer).includes(subject))
      return "um de seus pais biológicos";
    if ((this.children.get(observer) || []).includes(subject))
      return "um de seus descendentes diretos";
    if (this.family.siblings(observer).includes(subject))
      return "alguém com quem compartilhava ao menos um progenitor";
    if (
      this.family
        .partners(observer)
        .some(
          (p) =>
            p.people.includes(subject) &&
            (p.start ?? 0) <= month &&
            (p.end === undefined || p.end >= month),
        )
    )
      return "com quem mantinha parceria";
    return "";
  }
  introduction(id: string) {
    const b = this.life(id);
    if (!b)
      return `${this.name(id)} não tem nascimento documentado neste arquivo.`;
    if (b.founder)
      return `${this.name(id)} integrava o grupo fundador${b.month === undefined ? "" : `, com ${Math.floor(-b.month / 12)} anos no início`}. Não há infância simulada nem ancestrais registrados para os fundadores.`;
    return `${this.name(id)} nasceu${b.month === undefined ? "" : ` no ${date(b.month)}`}${b.parents.length ? `, com parentesco biológico registrado com ${b.parents.map((p) => this.name(p)).join(" e ")}` : ""}.`;
  }
  biography(id: string) {
    const ids = new Set(this.facts.get(id) || []),
      death = this.family.deaths.get(id);
    for (const n of [...ids]) {
      const e = this.event(n)!;
      if (e.type === "partnership.ended" && typeof e.data.death === "string") {
        const d = this.event(e.data.death);
        if (d?.type === "person.died") ids.add(d.seq);
      }
    }
    for (const relative of [
      ...this.family.parents(id),
      ...(this.children.get(id) || []),
    ]) {
      const d = this.family.deaths.get(relative);
      if (d) ids.add(d.seq);
    }
    const personalEmotions = [...ids]
      .map((n) => this.event(n)!)
      .filter(
        (e) =>
          e.type === "emotion.felt" &&
          e.participants.some((p) => p.id === id && p.role === "actor"),
      );
    return [...ids]
      .sort((a, b) => a - b)
      .map((n) => this.event(n)!)
      .filter((e) => {
        if (death && e.month > death.month) return false;
        if (
          [
            "information.received",
            "injury.perceived",
            "sequela.perceived",
            "family.loss.perceived",
            "emotion.felt",
            "person.transformed",
          ].includes(e.type) &&
          !e.participants.some((p) => p.id === id && p.role === "actor")
        )
          return false;
        if (e.type === "information.received") {
          const fact =
            typeof e.data.offense === "string"
              ? this.event(e.data.offense)
              : undefined;
          const subject =
            typeof fact?.data.victim === "string"
              ? fact.data.victim
              : undefined;
          return (
            !!(subject && this.relation(id, subject, e.month)) ||
            personalEmotions.some((x) => x.data.stimulusSource === e.id)
          );
        }
        return true;
      });
  }
  paragraphs(id: string) {
    const birth = this.life(id),
      result = [
        { text: this.introduction(id), sources: birth ? [birth.source] : [] },
      ];
    const events = this.biography(id).filter((e) => e.id !== birth?.source);
    for (let i = 0; i < events.length; i += 4) {
      const group = events.slice(i, i + 4);
      result.push({
        text: group.map((e) => this.narrate(e)).join(" "),
        sources: group.map((e) => e.id),
      });
    }
    return result;
  }
  factDescription(e: SliceEvent, observer?: string) {
    const subject =
      typeof e.data.victim === "string"
        ? e.data.victim
        : typeof e.data.subject === "string"
          ? e.data.subject
          : e.participants.find((p) => p.role === "victim")?.id;
    const relation =
      observer && subject ? this.relation(observer, subject, e.month) : "";
    if (e.type === "person.died")
      return `a morte de ${this.name(subject)}${relation ? `, ${relation}` : ""}`;
    if (e.type === "pregnancy.lost") return "a perda de uma gestação";
    if (
      [
        "wound.created",
        "injury.perceived",
        "sequela.perceived",
        "sequela.confirmed",
      ].includes(e.type)
    )
      return `${e.type.startsWith("sequela") ? "a sequela" : "o ferimento"}${subject ? ` de ${this.name(subject)}` : ""}`;
    return `o acontecimento “${eventLabel(e)}”`;
  }
  sourceDescription(e: SliceEvent) {
    const source =
      typeof e.data.source === "string" ? this.event(e.data.source) : undefined;
    if (e.data.channel === "testemunho")
      return "testemunho do acontecimento registrado";
    if (
      source?.type === "information.shared" &&
      typeof source.data.sender === "string"
    )
      return `relato de ${this.name(source.data.sender)}, compartilhado no ${date(source.month)}`;
    return source
      ? `registro “${eventLabel(source)}”, no ${date(source.month)}`
      : "fonte não especificada";
  }
  stimulusDescription(e: SliceEvent, observer?: string) {
    if (e.type === "information.received") {
      const fact =
        typeof e.data.offense === "string"
          ? this.event(e.data.offense)
          : undefined;
      return fact
        ? `receber notícia sobre ${this.factDescription(fact, observer)} (fonte: ${this.sourceDescription(e)})`
        : "uma notícia cujo conteúdo não foi registrado";
    }
    if (e.type === "family.loss.perceived")
      return "a percepção registrada de uma perda gestacional";
    return this.factDescription(e, observer);
  }
  causalPresentation(e: SliceEvent, limit = 24) {
    const chain: SliceEvent[] = [],
      routine = new Map<string, SliceEvent>(),
      other = new Map<string, SliceEvent>(),
      seen = new Set<string>();
    let current: SliceEvent | undefined = e;
    while (current && seen.size < limit && !seen.has(current.id)) {
      seen.add(current.id);
      if (routineTypes.has(current.type)) routine.set(current.id, current);
      else chain.push(current);
      const causes: SliceEvent[] = current.causes
        .map((id) => this.event(id))
        .filter((v): v is SliceEvent => !!v && v.seq < current!.seq);
      for (const c of causes)
        if (routineTypes.has(c.type)) routine.set(c.id, c);
        else other.set(c.id, c);
      const explicit = [
        "emotion",
        "stimulusSource",
        "knowledgeSource",
        "source",
        "death",
        "offense",
      ]
        .map((k) => current!.data[k])
        .find((id) => typeof id === "string" && current!.causes.includes(id));
      const preferred: SliceEvent | undefined =
        typeof explicit === "string"
          ? causes.find((c) => c.id === explicit)
          : undefined;
      const score = (c: SliceEvent) =>
        routineTypes.has(c.type)
          ? 0
          : [
                "world.created",
                "people.created",
                "family.founder.registered",
              ].includes(c.type)
            ? 1
            : [
                  "person.died",
                  "information.received",
                  "information.shared",
                  "wound.created",
                  "attack.contact",
                  "sequela.confirmed",
                  "emotion.felt",
                  "family.loss.perceived",
                ].includes(c.type)
              ? 3
              : 2;
      const preferredTypes: Record<string, string[]> = {
        "work.created": ["work.started"],
        "person.born": ["pregnancy.conceived"],
        "pregnancy.conceived": ["partnership.formed"],
        "sequela.confirmed": ["wound.created"],
        "wound.created": ["attack.contact"],
        "guardianship.decided": ["person.died"],
        "person.died": ["body.death", "natural.death", "mortality.condition"],
      };
      const semantic: SliceEvent | undefined = (
        preferredTypes[current.type] || []
      )
        .map((type) => causes.find((c) => c.type === type))
        .find(Boolean);
      current =
        preferred ||
        semantic ||
        causes.sort((a, b) => score(b) - score(a) || b.seq - a.seq)[0];
    }
    for (const c of chain) other.delete(c.id);
    return {
      chain: chain.reverse(),
      routine: [...routine.values()].sort((a, b) => a.seq - b.seq),
      other: [...other.values()].sort((a, b) => a.seq - b.seq),
      continuation: current?.id,
    };
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
    const location = part
      ? ` ${/^(head|hand|leg)/.test(part) ? "na" : "no"} ${parts[part] || "local corporal não identificado"}`
      : "";
    let text: string;
    switch (e.type) {
      case "information.received": {
        const fact =
          typeof d.offense === "string" ? this.event(d.offense) : undefined;
        text = `${this.name(actor)} soube ${fact ? this.factDescription(fact, actor).replace(/^a /, "da ").replace(/^o /, "do ") : "de um fato cujo conteúdo não foi registrado"}. Fonte: ${this.sourceDescription(e)}.`;
        break;
      }
      case "family.loss.perceived":
        text = `${this.name(actor)} percebeu a perda de uma gestação registrada no arquivo.`;
        break;
      case "pregnancy.lost":
        text = `Uma gestação foi encerrada por perda${typeof d.cause === "string" ? `; causa registrada: ${d.cause}` : ""}.`;
        break;
      case "duel.agreed":
        text = `Foi avaliado um duelo entre ${names(e.participants.map((p) => p.id)) || "participantes não identificados"}${d.started === true ? "; o duelo foi iniciado" : d.started === false ? "; o duelo não foi iniciado" : ""}.`;
        break;
      case "duel.ended":
        text = `O duelo terminou${typeof d.termination === "string" ? `; motivo registrado: ${d.termination}` : ""}.`;
        break;
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
        text = `${this.name(actor)} percebeu ${e.type === "sequela.perceived" ? "a sequela" : "o ferimento"}${d.subject === actor ? " no próprio corpo" : ` de ${this.name(d.subject)}`}.`;
        break;
      case "emotion.felt": {
        const source =
          typeof d.stimulusSource === "string" &&
          e.causes.includes(d.stimulusSource)
            ? this.event(d.stimulusSource)
            : undefined;
        const trigger = source ? this.stimulusDescription(source, actor) : "";
        const response = trigger.startsWith("a ")
          ? `à ${trigger.slice(2)}`
          : trigger.startsWith("o ")
            ? `ao ${trigger.slice(2)}`
            : `a ${trigger}`;
        text = `Foi registrada para ${this.name(actor)} uma emoção${typeof d.emotion === "string" ? `: “${d.emotion}”` : ""}${source ? `, em resposta ${response}` : ""}.${typeof d.stressBefore === "number" && typeof d.stressAfter === "number" ? ` O estresse passou de ${d.stressBefore} para ${d.stressAfter}.` : ""}`;
        break;
      }
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
      case "occupation.changed":
        text = `${this.name(actor)} ${d.previous ? `deixou o ofício ${d.previous} e passou a` : "passou a"} ${d.occupation}. Motivo registrado: ${d.reason}`;
        break;
      case "occupation.care.offered":
        text = `${this.name(actor)} ofereceu cuidado a ${this.name(d.patient)} após observar uma ferida; a avaliação de tratamento está ligada a este registro.`;
        break;
      case "care.requested":
        text = `O tratamento de ${this.name(actor)} foi ${d.accepted ? "aceito" : "recusado ou inviável"} após avaliação de capacidade, consentimento e recursos.`;
        break;
      case "care.compression":
      case "care.controlled":
        text = `${this.name(actor)} ${e.type === "care.compression" ? "aplicou compressão à ferida de" : "controlou o sangramento de"} ${this.name(e.participants.find((p) => p.role === "beneficiary")?.id)}.`;
        break;
      case "work.started": {
        const fact =
          typeof d.theme === "string" ? this.event(d.theme) : undefined;
        text = `${this.name(actor)} iniciou um livro${fact ? ` sobre ${this.factDescription(fact, actor)}` : ""}, consumindo ${d.paper} unidades de papel e ${d.ink} de tinta do domicílio. ${typeof d.knowledgeSource === "string" && this.event(d.knowledgeSource) ? "Fonte: " + this.sourceDescription(this.event(d.knowledgeSource)!) + "." : "A notícia que fundamenta o tema está nas causas."}`;
        break;
      }
      case "work.created": {
        const work = this.world.entities[String(d.work)];
        text = `${this.name(actor)} concluiu ${work?.kind === "work" ? work.name : "um livro"}, com qualidade registrada ${d.quality}/100.${work?.kind === "work" && work.owner ? " A obra pertencia inicialmente ao criador." : ""}`;
        break;
      }
      case "work.transferred":
        text = `${this.name(d.from)} entregou a obra a ${this.name(d.to)}, que passou a ser seu dono. Motivo registrado: ${d.reason}`;
        break;
      case "work.estate.recorded":
        text = `A obra passou ao espólio de ${this.name(d.owner)}, sem herdeiro definido.`;
        break;
      case "work.blocked":
        text = `${this.name(actor)} tentou trabalhar em uma obra, mas não conseguiu: ${d.reason}`;
        break;
      case "personalGoal.closed":
        text = `Um objetivo de ${this.name(actor ?? e.participants[0]?.id)} foi encerrado. Motivo registrado: ${d.reason}`;
        break;
      case "person.died":
        text = `${this.name(d.victim ?? victim)} morreu${this.family.age(String(d.victim ?? victim), e.month) === undefined ? "" : `, aos ${this.family.age(String(d.victim ?? victim), e.month)} anos`}${typeof d.cause === "string" ? `; causa registrada: ${d.cause}` : ""}${typeof d.killer === "string" ? `. A autoria da morte foi atribuída a ${this.name(d.killer)}` : ""}.`;
        break;
      default:
        text = `${eventLabel(e)}.${e.participants.length ? ` Participantes registrados: ${names(e.participants.map((p) => p.id))}.` : ""}`;
    }
    return readable(
      `No ${date(e.month)}, ${text.replace(/^(Nasceu|Foi|O arquivo|O duelo|Em|Terminou|Uma)\b/, (v) => v.toLocaleLowerCase("pt-BR"))}`,
    );
  }
}
