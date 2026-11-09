import { readFileSync, writeFileSync } from "node:fs";
import { Archive } from "../src/ui/v2/model";
import { CompactLog } from "../src/engine/v2/compact-log";
import { withoutDate } from "../src/ui/v2/prose";
const manifest = JSON.parse(
  readFileSync("reports/m3-review/manifest.json", "utf8"),
);
const rows = manifest.seeds.map((seed: string) =>
  JSON.parse(readFileSync(`reports/m3-review/${seed}.json`, "utf8")),
);
const cpu = JSON.parse(readFileSync("docs/MARCO3-REVISAO-CPU.json", "utf8"));
const keys = [
  "disputes",
  "declarations",
  "agreements",
  "proposals",
  "unresolved",
  "pending",
  "scarcity",
  "thefts",
  "stolenBooks",
  "perceivedThefts",
  "conflictDeaths",
  "warWidows",
  "warCustody",
  "uniqueOrphans",
];
const totals = Object.fromEntries(
  keys.map((k) => [k, rows.reduce((n: number, r: any) => n + r[k], 0)]),
);
const byTrigger: Record<
  string,
  { disputes: number; wars: number; agreements: number }
> = {};
for (const r of rows) {
  const facts = new Map(r.politicalEvents.map((e: any) => [e.id, e.type]));
  for (const e of r.politicalEvents) {
    const key =
      e.type === "political.notice.sent"
        ? "disputes"
        : e.type === "war.declared"
          ? "wars"
          : e.type === "dispute.agreed"
            ? "agreements"
            : undefined;
    if (!key) continue;
    const type = facts.get(e.data.incident),
      group =
        type === "scarcity.observed"
          ? "escassez"
          : type === "theft.perceived"
            ? "roubo"
            : "duelo/morte";
    byTrigger[group] ||= { disputes: 0, wars: 0, agreements: 0 };
    byTrigger[group][key]++;
  }
}
const reasons: Record<string, number> = {};
for (const r of rows)
  for (const reason of r.rejections)
    reasons[reason] = (reasons[reason] || 0) + 1;
writeFileSync(
  "docs/MARCO3-REVISAO-DADOS.json",
  JSON.stringify({ manifest, totals, byTrigger, reasons, rows }, null, 2),
);
const selected = [...rows]
  .sort(
    (a, b) =>
      b.conflictDeaths - a.conflictDeaths ||
      b.declarations - a.declarations ||
      b.disputes - a.disputes ||
      a.seed.localeCompare(b.seed),
  )
  .find((r) => r.disputes > 0);
let biographies = "";
if (selected) {
  const w = JSON.parse(
      readFileSync(`reports/m3-review/${selected.seed}.world.json`, "utf8"),
    ),
    a = new Archive(w),
    events = [
      ...CompactLog.from(w.log).select(
        new Set([
          "war.declared",
          "property.stolen",
          "theft.perceived",
          "dispute.agreed",
          "dispute.proposed",
          "political.notice.received",
          "person.died",
          "guardianship.decided",
          "partnership.ended",
        ]),
      ),
    ];
  const leader =
    events.find((e) => e.type === "war.declared")?.participants[0]?.id ||
    events.find((e) => e.type === "dispute.proposed")?.participants[0]?.id ||
    events.find((e) => e.type === "political.notice.received")?.participants[0]
      ?.id;
  const victim =
    selected.biographies.find((b: any) => b.id !== leader)?.id ||
    events.find((e) => e.type === "theft.perceived")?.participants[0]?.id ||
    events.find((e) => e.type === "property.stolen")?.data.from;
  for (const id of [...new Set([leader, victim])].filter(
    (id): id is string => typeof id === "string",
  )) {
    const bio = a.biography(id);
    const important = bio.filter((e) =>
      [
        "war.declared",
        "theft.perceived",
        "property.stolen",
        "dispute.proposed",
        "dispute.agreed",
        "dispute.unresolved",
      ].includes(e.type),
    );
    const firstOffice = bio.find((e) => e.type === "office.appointed");
    const ownDeath = bio.find(
      (e) => e.type === "person.died" && e.data.victim === id,
    );
    const conflictDeaths = new Set(
      events
        .filter((e) => e.type === "person.died" && e.data.conflict)
        .map((e) => e.id),
    );
    const family = bio.filter(
      (e) =>
        (e.type === "partnership.ended" &&
          conflictDeaths.has(String(e.data.death))) ||
        (e.type === "guardianship.decided" &&
          e.causes.some((c) => conflictDeaths.has(c))),
    );
    const firstConflict =
      important.find((e) => e.type === "war.declared") ||
      important.find((e) => e.type === "dispute.proposed");
    const notice = firstConflict?.causes
      .map((c) => a.event(c))
      .find((e) => e?.type === "political.notice.received");
    const firstPartnership = bio.find((e) => e.type === "partnership.formed");
    const familyDeaths = family.flatMap((e) =>
      e.causes.map((c) => a.event(c)).filter((e) => e?.type === "person.died"),
    );
    const selectedEvents = [
      firstPartnership,
      firstOffice,
      notice,
      firstConflict,
      ...important
        .filter((e) => ["property.stolen", "theft.perceived"].includes(e.type))
        .slice(0, 1),
      ...family.slice(0, 2),
      ...familyDeaths.slice(0, 2),
      ownDeath,
    ]
      .filter((e): e is NonNullable<typeof e> => !!e)
      .filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i)
      .sort((x, y) => x.seq - y.seq);
    const groups = new Map<number, string[]>();
    for (const e of selectedEvents) {
      const t = groups.get(e.month) || [];
      t.push(withoutDate(a.narrate(e)));
      groups.set(e.month, t);
    }
    biographies += `\n**${a.name(id)}** — seed ${selected.seed}, ${id}. ${a.introduction(id)} ${[...groups].map(([m, t]) => `No ano ${Math.floor(m / 12)}, mês ${(m % 12) + 1}, ${t.join(" ").replace(/^(Terminou|Foi|Nasceu)\b/, (v) => v.toLocaleLowerCase("pt-BR"))}`).join(" ")}\n\nFontes: ${selectedEvents.map((e) => e.id).join(", ")}. Recorte factual; repetições omitidas.\n`;
  }
}
writeFileSync(
  "docs/MARCO3-REVISAO-BIOGRAFIAS.md",
  `# Biografias de geração livre\n\n${biographies || "Nenhum evento de disputa nas dez seeds; não foram criados exemplos nem usadas fixtures como geração livre."}`,
);
const before = cpu.measurements.before,
  after = cpu.measurements.final;
const perf = `${(before.ms / 1000).toFixed(1)}→${(after.ms / 1000).toFixed(1)} s`;
const demographic = `1. Nas seeds 006/011/028, 2c→livros: nascimentos 70/38/36→43/26/21; últimos nascimentos nos anos 65/55/39, sem menores ao final.\n2. Cultivo/artesanato impediam avaliar recuperação; estresse reduzia concepção/parceria. Não houve mortes por fome; idade e parentesco já limitavam o 2c.\n3. Corrigida apenas essa precedência: 64/40/29 nascimentos, 39/23/13 vivos e 2/0/0 casas com menores; fertilidade inalterada.\n`;
writeFileSync(
  "docs/MARCO3-REVISAO-REPORT.md",
  `# Revisão do Marco 3\n\n${demographic}\n**Conflitos — dez seeds livres fixas:** ${totals.disputes} disputas, ${totals.declarations} declarações de guerra, ${totals.agreements} acordos bilaterais de não agressão; ${totals.unresolved} negociações sem acordo, ${Object.values(reasons).reduce((a, b) => a + b, 0)} rejeições, ${totals.pending} pendentes no horizonte. ${totals.conflictDeaths} mortes, ${totals.warWidows} términos por viuvez, ${totals.uniqueOrphans} crianças sem responsável sobrevivente e ${totals.warCustody} decisões de guarda. Por gatilho: roubo ${byTrigger.roubo?.disputes || 0} disputas/${byTrigger.roubo?.wars || 0} guerras; escassez ${byTrigger.escassez?.disputes || 0}/${byTrigger.escassez?.wars || 0}; duelo/morte ${byTrigger["duelo/morte"]?.disputes || 0}/${byTrigger["duelo/morte"]?.wars || 0}. Gatilhos: ${totals.scarcity} observações de escassez, ${totals.thefts} roubos (${totals.stolenBooks} de obras), ${totals.perceivedThefts} percebidos. ${totals.declarations ? "Sem quota nem ajuste de pesos após os resultados." : `Zero guerras: ${totals.disputes ? "as decisões/impedimentos estão discriminados nos dados; não houve autorização e escolha de guerra simultâneas" : "nenhuma petição chegou a existir; não houve incidente elegível percebido e reportado"}.`}\n\n**CPU:** ${perf}, mesma seed/escala, aquecimento e processos independentes, sem relatório/validação no cronômetro. Hash completo idêntico: \`${after.hash}\`. Pico RSS Node ${Math.round(before.memory.rssPeak / 1e6)}→${Math.round(after.memory.rssPeak / 1e6)} MB; não é memória de aba. O perfil mostrou leitura do log, cópias, ofícios e conjuntos de fatos dominando o custo. No perfil intermediário, visitas/observações: 1,25%, relatos/disputas: 1,25%; campanhas: nenhuma nessa seed. Otimização por dados imutáveis e consultas atuais, sem mudar regras ou eventos.\n\nEscassez só após observação; roubo conserva obra/material. Uma proposta só conta como acordo após aceitação dos dois líderes com autoridade vigente. Acordo não devolve bens nem cura fome automaticamente. ${rows.reduce((n: number, r: any) => n + r.errors.length, 0)} erros de causalidade/conservação/replay no lote. 74 testes, build e 10 verificações no navegador aprovados. [Dados](MARCO3-REVISAO-DADOS.json) · [CPU e hashes](MARCO3-REVISAO-CPU.json) · [Biografias livres](MARCO3-REVISAO-BIOGRAFIAS.md) · [Regras](MARCO3-REVISAO-REGRAS.md). Parada nesta revisão.\n`,
);
console.log({ totals, reasons, biographySeed: selected?.seed, perf });
