import { auditLife } from "./life-audit";
import { CompactLog, type CompactWorld } from "./compact-log";
import {
  traits as traitCatalog,
  values as valueCatalog,
} from "../../data/v2/personality";
import type { Entity, Person, SliceWorld, PersonalGoal } from "./types";
import { applyEvent, goals } from "./engine";
import { outcomes } from "./types";
export function validateSlice(w: SliceWorld): string[] {
  const errors: string[] = [];
  const fail = (m: string) => errors.push(m);
  const state: Record<string, Entity> = {},
    ids = new Set<string>();
  const refs = (id: string, at: string) => {
    if (!state[id]) fail(`${at}: referência inexistente ${id}`);
  };
  try {
    if (
      w.version !== 2 ||
      ![
        "revenge-slice-1",
        "agents-slice-1a",
        "agents-slice-1b",
        "agents-slice-protection2",
        "agents-slice-1c",
        "agents-slice-1d",
        "agents-slice-2a",
        "agents-slice-2.1",
        "agents-slice-2b",
        "agents-slice-2c",
        "agents-slice-2d1",
      ].includes(w.engine)
    )
      fail("Versão inválida");
    let month = -1;
    const stoppedDuels = new Set<string>();
    for (let i = 0; i < w.events.length; i++) {
      const e = w.events[i];
      if (e.id !== `event:${i}` || e.seq !== i || ids.has(e.id))
        fail(`${e.id}: ordem/ID inválido`);
      if (
        e.month < month ||
        e.month < 0 ||
        e.month >= w.scenario.months ||
        e.ano !== Math.floor(e.month / 12) ||
        e.dia !== (e.month % 12) * 30
      )
        fail(`${e.id}: tempo inválido`);
      month = e.month;
      if (
        !Array.isArray(e.causes) ||
        (i !== 0 && e.causes.length === 0) ||
        (i === 0 && (e.type !== "world.created" || e.causes.length !== 0))
      )
        fail(`${e.id}: causas ausentes`);
      for (const cause of e.causes || [])
        if (!ids.has(cause)) fail(`${e.id}: causa futura/inexistente ${cause}`);
      for (const effect of e.effects)
        if (effect.op === "create" && state[effect.entity.id])
          fail(`${e.id}: entidade duplicada`);
      const created = new Set(
        e.effects.filter((f) => f.op === "create").map((f) => f.entity.id),
      );
      for (const p of e.participants) {
        if (!state[p.id] && !created.has(p.id))
          fail(`${e.id}: participante inexistente ${p.id}`);
        const person = state[p.id];
        if (
          person?.kind === "person" &&
          ["actor", "target", "witness"].includes(p.role) &&
          !person.alive
        )
          fail(`${e.id}: morto agiu ${p.id}`);
        if (person?.kind === "person" && person.born > e.ano)
          fail(`${e.id}: pessoa antes de nascer`);
      }
      if (!state[e.location] && !created.has(e.location))
        fail(`${e.id}: local inválido`);
      if (e.decision) {
        const p = state[e.decision.actor];
        if (p?.kind !== "person" || !p.alive || !p.present)
          fail(`${e.id}: decisão inelegível`);
        const best = e.decision.candidates[0];
        if (!best || best.action !== e.decision.chosen)
          fail(`${e.id}: utilidade não venceu`);
        for (const c of e.decision.candidates) {
          if (
            c.score !== c.base + c.noise ||
            Math.abs(c.noise) > 25 ||
            c.base !== Object.values(c.factors).reduce((a, b) => a + b, 0)
          )
            fail(`${e.id}: escore inválido`);
          if (c.score > best.score) fail(`${e.id}: ação inferior escolhida`);
          for (const evidence of c.evidence)
            if (!ids.has(evidence)) fail(`${e.id}: evidência futura`);
        }
        if (
          e.decision.chosen === "treinar" &&
          p?.kind === "person" &&
          !p.trainAccess
        )
          fail(`${e.id}: treino sem acesso`);
      }
      if (e.type === "person.died") {
        const p = state[String(e.data.victim)];
        if (p?.kind !== "person" || !p.alive)
          fail(`${e.id}: morte duplicada/inválida`);
        if (
          !e.causes.some((id) =>
            [
              "confrontation.resolved",
              "external.incident",
              "natural.death",
              "body.death",
            ].includes(w.events[Number(id.split(":")[1])]?.type),
          )
        )
          fail(`${e.id}: morte sem resolução`);
      }
      if (e.type === "information.received") {
        const offense = w.events[Number(String(e.data.offense).split(":")[1])];
        if (offense?.type !== "person.died" || offense.seq >= e.seq)
          fail(`${e.id}: informação inválida`);
        const origin = w.events[Number(String(e.data.source).split(":")[1])];
        if (!origin || !e.causes.includes(origin.id))
          fail(`${e.id}: notícia sem fonte`);
        if (origin && origin.id !== offense?.id) {
          const sender = state[String(origin.data.sender)];
          if (
            origin.type !== "information.shared" ||
            origin.data.offense !== offense?.id ||
            sender?.kind !== "person" ||
            !sender.informed.includes(String(e.data.offense))
          )
            fail(`${e.id}: informação sem canal conhecido`);
        }
      }
      if (e.type === "activity.period") {
        if (e.data.periodMonths !== 1) fail(`${e.id}: rotina não mensal`);
        if (
          Number(e.data.skillAfter) !==
          Number(e.data.skillBefore) + Number(e.data.gain)
        )
          fail(`${e.id}: ganho incoerente`);
      }
      if (
        [
          "person.met",
          "social.invited",
          "social.responded",
          "relationship.strengthened",
          "friendship.formed",
          "agreement.offered",
          "agreement.responded",
          "reconciliation.agreed",
          "threat.announced",
          "threat.perceived",
          "protection.intervened",
          "protection.failed",
        ].includes(e.type)
      )
        for (const p of e.participants) {
          const person = state[p.id];
          if (
            person?.kind === "person" &&
            p.role !== "reference" &&
            (!person.alive || !person.present)
          )
            fail(`${e.id}: interação sem presença`);
        }
      if (e.type === "friendship.formed") {
        const a = state[String(e.data.first)] as Person,
          b = state[String(e.data.second)] as Person;
        if (
          (a?.bonds?.[b?.id]?.trust || 0) < 60 ||
          (b?.bonds?.[a?.id]?.trust || 0) < 60
        )
          fail(`${e.id}: amizade unilateral`);
      }
      if (e.type === "reconciliation.agreed" && e.data.accepted !== true)
        fail(`${e.id}: reconciliação unilateral`);
      if (e.type === "leadership.changed") {
        const candidate = e.participants.find((p) => p.role === "actor")?.id,
          eligible = Object.values(state).filter(
            (x): x is Person => x.kind === "person" && x.alive && x.present && (!w.scenario.dailyLife || ["adult", "elder"].includes(x.lifeStage || "adult")),
          ),
          voters = eligible.filter((p) => p.supportFor === candidate);
        if (voters.length < Math.max(3, Math.floor(eligible.length / 2) + 1))
          fail(`${e.id}: liderança sem maioria`);
      }
      if (e.type === "work.started") {
        const p = state[e.participants[0].id] as Person,
          theme = e.data.theme;
        if (
          theme &&
          !p.informed.includes(String(theme)) &&
          !Object.values(p.acquaintances || {}).includes(String(theme))
        )
          fail(`${e.id}: tema não conhecido`);
        const place = state["place:void"];
        if (
          place?.kind !== "place" ||
          !place.supplies ||
          place.supplies.paper < 3 ||
          place.supplies.ink < 2
        )
          fail(`${e.id}: obra sem materiais`);
      }
      if (w.scenario.emotionalDynamics) {
        if (e.type === "emotion.felt") {
          const p = state[e.participants[0].id] as Person;
          const source =
            w.events[Number(String(e.data.stimulusSource).split(":")[1])];
          if (!source || !e.causes.includes(source.id))
            fail(`${e.id}: emoção sem estímulo causal`);
          if (
            e.data.stimulus === "perda" &&
            (![
              "information.received",
              "sequela.perceived",
              "family.loss.perceived",
            ].includes(source?.type) ||
              source.participants[0]?.id !== p.id)
          )
            fail(`${e.id}: luto sem notícia própria`);
          if (
            e.data.stimulus === "ameaca" &&
            (!["threat.announced", "injury.perceived"].includes(source?.type) ||
              (source.type === "threat.announced"
                ? source.data.target !== p.id
                : source.participants[0]?.id !== p.id))
          )
            fail(`${e.id}: ameaça desconhecida`);
          if (
            e.data.stimulus === "traicao" &&
            (source?.type !== "betrayal.perceived" ||
              source.participants[0]?.id !== p.id)
          )
            fail(`${e.id}: traição sem percepção`);
          if (
            e.data.stressBefore !== p.psychology?.stress ||
            e.data.stressAfter !==
              Math.max(
                0,
                Math.min(
                  1000,
                  Number(e.data.stressBefore) + Number(e.data.stressDelta),
                ),
              )
          )
            fail(`${e.id}: estresse sem cálculo consistente`);
        }
        if (e.type === "person.transformed") {
          const emotion =
            w.events[Number(String(e.data.emotion).split(":")[1])];
          if (
            emotion?.type !== "emotion.felt" ||
            emotion.participants[0].id !== e.participants[0].id ||
            !e.causes.includes(emotion.id)
          )
            fail(`${e.id}: transformação sem emoção própria`);
        }
        if (e.type === "stress.response") {
          if (
            e.data.action !== "recuperar" &&
            Number(e.data.stressBefore) < 650
          )
            fail(`${e.id}: resposta de crise sem estresse alto`);
          if (
            e.data.action === "abandonar_posto" &&
            (state["place:void"] as import("./types").Place).leader !==
              e.participants[0].id
          )
            fail(`${e.id}: abandono sem posto`);
        }
        if (e.type === "aggressor.consequence") {
          const source = e.causes
            .map((id) => w.events[Number(id.split(":")[1])])
            .find((x) => x?.type === "incident.recorded");
          if (
            !source ||
            Number(source.data.count) < 3 ||
            source.data.aggressor !== e.data.aggressor
          )
            fail(`${e.id}: consequência sem reincidência`);
        }
        if (
          e.type === "personalGoal.closed" &&
          e.data.status === "resolved_by_other"
        ) {
          const g = state[String(e.data.goal)] as PersonalGoal;
          const owner = state[g.owner] as Person;
          const closed = e.effects.find((f) => f.entity.id === g.id)?.entity as
            PersonalGoal | undefined;
          const resolution = e.causes
            .map((id) => w.events[Number(id.split(":")[1])])
            .find((x) =>
              [
                "confrontation.prevented",
                "confrontation.resolved",
                "aggressor.consequence",
              ].includes(x?.type),
            );
          if (
            g.type !== "proteger" ||
            g.interventions !== 0 ||
            closed?.interventions !== 0 ||
            !(state[g.target] as Person).alive ||
            !owner.alive ||
            !owner.present ||
            !g.perception ||
            !resolution
          )
            fail(`${e.id}: resolvido por outro sem testemunho ou resolução`);
        }
      }
      if (w.scenario.bodySimulation) {
        if (e.type === "duel.choice") {
          const utilities = e.data.utilities as Record<string, number>,
            eligible = e.data.eligible as string[];
          const chosen = String(e.data.chosen);
          if (
            !eligible.includes(chosen) ||
            Object.values(utilities).some((v) => !Number.isFinite(v)) ||
            eligible.some((k) => utilities[k] > utilities[chosen])
          )
            fail(`${e.id}: saída não maximiza utilidade elegível`);
          if (chosen === "fugir" && !e.data.mobile)
            fail(`${e.id}: fuga sem mobilidade`);
          if (
            !e.causes.some(
              (id) => w.events[Number(id.slice(6))]?.type === "duel.observed",
            )
          )
            fail(`${e.id}: escolha sem observação`);
          if (e.data.stopped) stoppedDuels.add(String(e.data.duel));
        }
        if (e.type === "attack.attempted") {
          if (stoppedDuels.has(String(e.data.duel)))
            fail(`${e.id}: golpe após encerramento consentido`);
          const actor = state[e.participants[0].id] as Person;
          const body = state[`body:${actor.id}`];
          if (body?.kind !== "body" || !body.weapon || !body.conscious)
            fail(`${e.id}: golpe sem arma ou capacidade`);
        }
        if (e.type === "attack.contact") {
          const trace = e.data.trace as {
            entering: number;
            spent: number;
            remaining: number;
          }[];
          let residual = Number(e.data.budget);
          for (const layer of trace) {
            if (
              layer.entering !== residual ||
              layer.spent < 0 ||
              Math.abs(layer.entering - layer.spent - layer.remaining) > 1e-8 ||
              layer.remaining < 0
            )
              fail(`${e.id}: orçamento de contato inválido`);
            residual = layer.remaining;
          }
        }
        if (["injury.perceived", "sequela.perceived"].includes(e.type)) {
          const observer = state[e.participants[0].id] as Person;
          if (
            !observer?.alive ||
            !observer.present ||
            w.scenario.bodySimulation.blockedInformation?.includes(observer.id)
          )
            fail(`${e.id}: notícia de ferimento inelegível`);
          const wound = state[String(e.data.wound)];
          if (wound?.kind !== "wound" || wound.owner !== e.data.subject)
            fail(`${e.id}: lesão percebida inexistente`);
          if (
            e.data.channel === "relato" &&
            !e.causes.some(
              (id) => w.events[Number(id.slice(6))]?.type === "injury.news",
            )
          )
            fail(`${e.id}: notícia sem emissor`);
        }
        if (
          e.type === "physicalGoal.reassessed" &&
          !e.causes.some((id) =>
            ["person.transformed", "emotion.felt"].includes(
              w.events[Number(id.slice(6))]?.type,
            ),
          )
        )
          fail(`${e.id}: reavaliação sem emoção/transformação`);
      }
      for (const effect of e.effects) {
        const before = state[effect.entity.id],
          after = effect.entity;
        if (
          effect.op === "replace" &&
          before?.kind === "person" &&
          after.kind === "person"
        ) {
          for (const key of Object.keys(after) as (keyof Person)[]) {
            if (key === "lastBy") continue;
            if (
              JSON.stringify(before[key]) !== JSON.stringify(after[key]) &&
              after.lastBy[key] !== e.id
            )
              fail(`${e.id}: mudança sem procedência do campo ${key}`);
          }
          if (before.alive !== after.alive && e.type !== "person.died")
            fail(`${e.id}: morte fora do evento de morte`);
          if (
            before.skill !== after.skill &&
            e.type !== "activity.period" &&
            e.type !== "development.period"
          )
            fail(`${e.id}: habilidade fora de prática`);
        }
      }
      applyEvent(state, e);
      ids.add(e.id);
      for (const effect of e.effects) {
        const x = effect.entity;
        for (const k of Object.keys(x))
          if (
            !Number.isFinite(
              typeof (x as unknown as Record<string, unknown>)[k] === "number"
                ? (x as unknown as Record<string, number>)[k]
                : 0,
            )
          )
            fail(`${e.id}: número inválido`);
        if (x.kind === "person") {
          if (w.scenario.emotionalDynamics) {
            const psy = x.psychology;
            if (
              !psy ||
              !Number.isInteger(psy.stress) ||
              psy.stress < 0 ||
              psy.stress > 1000 ||
              Object.values(psy.needs).some(
                (n) => !Number.isInteger(n) || n < 0 || n > 100,
              )
            )
              fail(`${e.id}: psicologia inválida`);
            if (psy?.lastEmotion && !ids.has(psy.lastEmotion))
              fail(`${e.id}: emoção futura`);
            if (x.expelled && (!ids.has(x.expelled) || x.present))
              fail(`${e.id}: expulso presente ou sem origem`);
            if (x.pledge && !ids.has(x.pledge.source))
              fail(`${e.id}: promessa sem origem`);
          }
          if (x.skill < 0 || x.skill > 1000)
            fail(`${e.id}: habilidade inválida`);
          for (const n of Object.values(x.traits))
            if (n < 0 || n > 100) fail(`${e.id}: traço inválido`);
          for (const n of Object.values(x.values))
            if (n === undefined || n < -100 || n > 100)
              fail(`${e.id}: valor inválido`);
          for (const id of x.kin)
            if (!state[id]) fail(`${e.id}: parentesco inválido`);
          for (const id of x.informed)
            if (!ids.has(id)) fail(`${e.id}: conhecimento futuro`);
          for (const id of [x.rival, x.helpFrom, x.helpedBy, x.killer])
            if (id) refs(id, e.id);
          if (x.kin.some((id) => !(state[id] as Person)?.kin?.includes(x.id)))
            fail(`${e.id}: parentesco assimétrico`);
          if (w.scenario.advancedObjectives) {
            for (const key of Object.keys(traitCatalog))
              if (!Number.isInteger(x.traits[key]))
                fail(`${e.id}: faceta ausente ${key}`);
            for (const key of Object.keys(valueCatalog))
              if (!Number.isInteger(x.values[key]))
                fail(`${e.id}: valor ausente ${key}`);
          }
          if (
            x.skills &&
            (!Number.isInteger(x.skills.escrita) ||
              x.skills.escrita < 0 ||
              x.skills.escrita > 100 ||
              x.skills.lideranca < 0 ||
              x.skills.lideranca > 100)
          )
            fail(`${e.id}: habilidade avançada inválida`);
          for (const id of x.works || []) refs(id, e.id);
          if (x.supportFor) refs(x.supportFor, e.id);
          for (const id of x.personalGoals || []) refs(id, e.id);
          for (const [id, source] of Object.entries(x.acquaintances || {})) {
            refs(id, e.id);
            if (!ids.has(source)) fail(`${e.id}: conhecimento social futuro`);
          }
          for (const [id, bond] of Object.entries(x.bonds || {})) {
            refs(id, e.id);
            if (
              !ids.has(bond.source) ||
              bond.trust < 0 ||
              bond.trust > 100 ||
              bond.interactions < 1
            )
              fail(`${e.id}: vínculo inválido`);
          }
          if (x.goal) refs(x.goal, e.id);
          if (x.memory) refs(x.memory, e.id);
          if (x.death && !ids.has(x.death)) fail(`${e.id}: morte futura`);
          for (const by of Object.values(x.lastBy))
            if (!ids.has(by)) fail(`${e.id}: alteração sem procedência`);
        }
        if (x.kind === "memory") {
          refs(x.owner, e.id);
          refs(x.offender, e.id);
          refs(x.victim, e.id);
          if (!ids.has(x.source)) fail(`${e.id}: memória sem percepção`);
          const source = w.events[Number(x.source.split(":")[1])];
          if (
            source?.type !== "information.received" ||
            !source.participants.some(
              (p) => p.id === x.owner && p.role === "actor",
            )
          )
            fail(`${e.id}: memória onisciente`);
        }
        if (x.kind === "personalGoal") {
          refs(x.owner, e.id);
          refs(x.target, e.id);
          if (!ids.has(x.source) || !ids.has(x.lastEvent))
            fail(`${e.id}: objetivo pessoal sem procedência`);
          const creation = w.events[Number(x.source.split(":")[1])];
          if (creation?.type !== "personalGoal.adopted")
            fail(`${e.id}: origem pessoal inválida`);
          if (x.lastMonitored && !ids.has(x.lastMonitored))
            fail(`${e.id}: monitoramento futuro`);
          if (
            [
              "agents-slice-protection2",
              "agents-slice-1c",
              "agents-slice-1d",
            ].includes(w.engine) &&
            x.type === "proteger" &&
            e.type === "personalGoal.adopted" &&
            (!x.estimate ||
              x.estimate.best < 40 ||
              !e.causes.includes(x.estimate.assessedAt))
          )
            fail(`${e.id}: compromisso sem estimativa viável anterior`);
          if (x.estimate) {
            if (!ids.has(x.estimate.assessedAt))
              fail(`${e.id}: estimativa futura`);
            if (x.estimate.ally) refs(x.estimate.ally, e.id);
          }
          if (x.type === "amizade") {
            const met = (state[x.owner] as Person).acquaintances?.[x.target];
            if (!met || !ids.has(met))
              fail(`${e.id}: amizade sem encontro conhecido`);
            if (
              x.status === "completed" &&
              e.type === "personalGoal.closed" &&
              !e.causes.some(
                (id) =>
                  w.events[Number(id.split(":")[1])]?.type ===
                  "friendship.formed",
              )
            )
              fail(`${e.id}: amizade sem aceitação recíproca`);
          } else if (x.type === "proteger") {
            if (x.aggressor) refs(x.aggressor, e.id);
            const perceived = x.perception
              ? w.events[Number(x.perception.split(":")[1])]
              : undefined;
            if (
              perceived?.type !== "threat.perceived" ||
              perceived.data.observer !== x.owner ||
              perceived.data.threat !== x.threat ||
              (perceived.seq >= e.seq && e.type !== "threat.perceived")
            )
              fail(`${e.id}: proteção sem percepção local`);
            if (
              x.status === "completed" &&
              e.type === "personalGoal.closed" &&
              (!(state[x.owner] as Person).alive ||
                !(state[x.target] as Person).alive ||
                x.interventions < 1)
            )
              fail(`${e.id}: proteção não cumprida`);
          } else if (x.type === "governar") {
            if (x.target !== x.owner) fail(`${e.id}: candidatura inválida`);
            for (const id of Object.keys(x.solicited || {})) refs(id, e.id);
            if (
              x.status === "completed" &&
              e.type === "personalGoal.closed" &&
              !e.causes.some(
                (id) =>
                  w.events[Number(id.split(":")[1])]?.type ===
                  "leadership.changed",
              )
            )
              fail(`${e.id}: poder sem eleição`);
          } else if (x.type === "criar_obra") {
            if (x.theme && !ids.has(x.theme)) fail(`${e.id}: tema futuro`);
            if (x.workStarted && !ids.has(x.workStarted))
              fail(`${e.id}: obra sem início`);
            if (
              x.status === "completed" &&
              e.type === "personalGoal.closed" &&
              !e.causes.some(
                (id) =>
                  w.events[Number(id.split(":")[1])]?.type === "work.created",
              )
            )
              fail(`${e.id}: obra sem criação`);
          } else fail(`${e.id}: tipo de objetivo desconhecido`);
          if (
            x.closed !== undefined &&
            (x.closed < x.adopted ||
              ![
                "completed",
                "failed",
                "abandoned",
                "resolved_by_other",
              ].includes(x.status || ""))
          )
            fail(`${e.id}: encerramento pessoal inválido`);
        }
        if (x.kind === "place") {
          if (
            x.medical &&
            (x.medical.bandages < 0 || !Number.isInteger(x.medical.bandages))
          )
            fail(`${e.id}: material médico inválido`);
          if (x.leader) {
            refs(x.leader, e.id);
            if (!(state[x.leader] as Person).alive)
              fail(`${e.id}: líder morto`);
          }
          if (x.supplies && (x.supplies.paper < 0 || x.supplies.ink < 0))
            fail(`${e.id}: estoque negativo`);
        }
        if (x.kind === "body") {
          refs(x.owner, e.id);
          if (
            x.blood < 0 ||
            x.blood > 5000 ||
            !Number.isFinite(x.blood) ||
            x.pain < 0 ||
            x.pain > 100
          )
            fail(`${e.id}: fisiologia inválida`);
          if (!ids.has(x.lastEvent)) fail(`${e.id}: corpo sem causa`);
        }
        if (x.kind === "bodyPart") {
          refs(x.owner, e.id);
          if (x.nerve < 0 || x.nerve > 1 || x.bone < 0 || x.bone > 1)
            fail(`${e.id}: função corporal inválida`);
        }
        if (x.kind === "wound") {
          refs(x.owner, e.id);
          refs(x.aggressor, e.id);
          refs(x.duel, e.id);
          if (
            !ids.has(x.source) ||
            !ids.has(x.lastEvent) ||
            x.rate < 0 ||
            x.bloodLoss < 0
          )
            fail(`${e.id}: ferimento inválido`);
        }
        if (x.kind === "kill") {
          refs(x.victim, e.id);
          if (x.killer) refs(x.killer, e.id);
          refs(x.wound, e.id);
          const death = w.events[Number(x.source.slice(6))];
          if (
            death?.type !== "person.died" ||
            death.data.victim !== x.victim ||
            death.data.killer !== x.killer ||
            (state[x.victim] as Person).alive
          )
            fail(`${e.id}: kill sem morte única atribuída`);
        }
        if (x.kind === "duel") {
          refs(x.a, e.id);
          refs(x.b, e.id);
          for (const id of x.wounds) refs(id, e.id);
        }
        if (x.kind === "physicalGoal") {
          refs(x.owner, e.id);
          if (!ids.has(x.source) || !ids.has(x.lastEvent))
            fail(`${e.id}: objetivo físico sem causa`);
        }
        if (x.kind === "work") {
          refs(x.creator, e.id);
          refs(x.goal, e.id);
          if (!ids.has(x.source) || (x.theme && !ids.has(x.theme)))
            fail(`${e.id}: obra com fonte futura`);
          if (
            x.quality < 0 ||
            x.quality > 100 ||
            (state[x.goal] as PersonalGoal).progress! < 6
          )
            fail(`${e.id}: obra incompleta`);
        }
        if (x.kind === "goal") {
          refs(x.owner, e.id);
          refs(x.target, e.id);
          refs(x.memory, e.id);
          for (const source of [x.accordIntent, x.accordRejected])
            if (source && !ids.has(source))
              fail(`${e.id}: acordo sem causa válida`);
          if (!ids.has(x.offense) || !ids.has(x.source))
            fail(`${e.id}: objetivo sem ofensa/origem`);
          if (
            x.closed !== undefined &&
            (x.closed < x.adopted || !outcomes.includes(x.outcome!))
          )
            fail(`${e.id}: conclusão inválida`);
          if (x.outcome === "vingança cumprida") {
            const target = state[x.target] as Person;
            if (target.alive || target.killer !== x.owner)
              fail(`${e.id}: vingança sem autoria`);
          }
          if (x.outcome === "alvo morto por outra causa") {
            const target = state[x.target] as Person;
            if (target.alive || target.killer === x.owner)
              fail(`${e.id}: outra causa inválida`);
          }
        }
      }
    }
    if (
      JSON.stringify(state, canonicalKeys) !==
      JSON.stringify(w.entities, canonicalKeys)
    )
      fail("Replay diverge do estado");
    for (const g of goals(w))
      if (w.complete && g.closed === undefined)
        fail("Objetivo não encerrado no horizonte");
    for (const pg of Object.values(w.entities).filter(
      (e): e is PersonalGoal => e.kind === "personalGoal",
    ))
      if (w.complete && pg.closed === undefined)
        fail("Objetivo pessoal não encerrado no horizonte");
    const killVictims = new Set<string>();
    for (const x of Object.values(state))
      if (x.kind === "kill") {
        if (killVictims.has(x.victim)) fail("Kill list duplicada");
        killVictims.add(x.victim);
      }
    const periods = new Set<string>();
    for (const e of w.events.filter((e) => e.type === "activity.period")) {
      const key = `${e.month}:${e.decision?.actor}`;
      if (periods.has(key)) fail("Rotina duplicada no mês");
      periods.add(key);
    }
  } catch (error) {
    fail(`Estrutura inválida: ${(error as Error).message}`);
  }
  errors.push(...auditLife(w));
  return errors;
}
// v2-specific entry point; v1 worlds must still use the legacy validator.
export { validateSlice as validateWorld };

// Object member order is not state: deltas may reconstruct equal objects in a different insertion order.
function canonicalKeys(_key: string, value: unknown): unknown {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      )
    : value;
}
export function validateCompact(world: CompactWorld): string[] {
  try {
    if (world.version !== 3 || world.log.format !== "delta-routine-v1")
      return ["Versão compacta inválida"];
    const log = CompactLog.from(world.log);
    log.replay();
    return validateSlice({
      version: 2,
      engine: world.engine,
      scenario: world.scenario,
      entities: world.entities,
      nextMonth: world.nextMonth,
      complete: world.complete,
      events: log.view(true),
    });
  } catch (e) {
    return [`Estrutura compacta inválida: ${String(e)}`];
  }
}
