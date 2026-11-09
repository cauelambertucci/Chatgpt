import { withoutDate } from "../src/ui/v2/prose";
import { readFileSync, writeFileSync } from "node:fs";
import { Archive } from "../src/ui/v2/model";
import { CompactLog } from "../src/engine/v2/compact-log";
const seeds = ["reservado-2b-006", "reservado-2b-011", "reservado-2b-028"];
const rows = seeds.map((seed) =>
  JSON.parse(readFileSync(`reports/m3/${seed}.json`, "utf8")),
);
writeFileSync(
  "docs/MARCO3-DADOS.json",
  JSON.stringify(
    {
      method:
        "40 fundadores, 100 anos. Mesmas três seeds. Um processo por seed; aquecimento de 12 meses; GC antes do motor; construção e avanço cronometrados sem validação ou relatório concorrentes. RSS Node é distinto de memória de aba. Validação, replay, biografia e gzip fora do cronômetro.",
      node: process.version,
      rows,
    },
    null,
    2,
  ),
);
const fixture = JSON.parse(
  readFileSync("reports/m3/marco3-fixture-guerra.json", "utf8"),
);
writeFileSync("docs/MARCO3-FIXTURE.json", JSON.stringify(fixture, null, 2));
const chosen = rows.find((r) => r.biographies.length === 2) || fixture;
let bios = "";
if (chosen) {
  const w = JSON.parse(
      readFileSync(`reports/m3/${chosen.seed}.world.json`, "utf8"),
    ),
    a = new Archive(w),
    log = CompactLog.from(w.log);
  for (const [i, b] of chosen.biographies.entries()) {
    const es = a.biography(b.id);
    const firstOffice = es.find((e) => e.type === "office.appointed");
    const salient = es.filter(
      (e) =>
        [
          "war.declared",
          "political.notice.received",
          "war.rejected",
          "person.died",
        ].includes(e.type) &&
        (e.type !== "person.died" || e.data.victim === b.id),
    );
    const causes = new Set(
      chosen.politicalEvents
        .filter((e: any) => e.type === "person.died" && e.data.conflict)
        .map((e: any) => e.id),
    );
    const family = es.filter(
      (e) =>
        (e.type === "partnership.ended" && causes.has(e.data.death)) ||
        (e.type === "guardianship.decided" &&
          e.causes.some((c) => causes.has(c))),
    );
    const partnership = es.find((e) => e.type === "partnership.formed");
    const born = es.find(
      (e) => e.type === "person.born" && e.participants[0]?.id === b.id,
    );
    const selected = [
      partnership,
      firstOffice,
      ...salient,
      ...family,
      ...family.flatMap((e) =>
        e.causes
          .map((id) => a.event(id))
          .filter((e) => e?.type === "person.died"),
      ),
    ]
      .filter((e): e is NonNullable<typeof e> => !!e)
      .filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i)
      .sort((x, y) => x.seq - y.seq);
    const grouped = new Map<number, string[]>();
    for (const e of selected.slice(0, 10)) {
      const group = grouped.get(e.month) || [];
      group.push(withoutDate(a.narrate(e)));
      grouped.set(e.month, group);
    }
    const texts = [...grouped].map(
      ([month, texts]) =>
        `No ano ${Math.floor(month / 12)}, mês ${(month % 12) + 1}, ${texts.join(" ").replace(/^(Foi|Nasceu)\b/, (v) => v.toLocaleLowerCase("pt-BR"))}`,
    );
    bios += `\n**${i === 0 ? "Líder" : "Pessoa afetada"} — ${b.name}** (${chosen.seed}; ${b.id}). ${a.introduction(b.id)} ${texts.join(" ")}\n\nFontes: ${selected
      .slice(0, 10)
      .map((e) => e.id)
      .join(
        ", ",
      )}. Recorte biográfico; a ficha no navegador conserva a vida completa.\n`;
  }
}
writeFileSync(
  "docs/MARCO3-BIOGRAFIAS.md",
  `# Duas biografias registradas\n\nFixture controlada: 40 fundadores, horizonte de 15 anos; temperamentos favoráveis ao confronto e duelo no ano 10 declarados na configuração. Sorteios de mortalidade e consequências familiares não foram forçados. As três seeds livres não produziram guerra.\n${bios || "Nenhuma guerra nessas três seeds; não foi fabricada uma biografia afetada."}`,
);
const times = rows.map((r) => (r.coreMs / 1000).toFixed(1));
const mem = rows.map((r) => (r.coreRss / 1e6).toFixed(0));
const logs = rows.map((r) => (r.jsonBytes / 1e6).toFixed(1));
writeFileSync(
  "docs/MARCO3-REPORT.md",
  `# Marco 3 mínimo — relatório\n\n[Diagnóstico demográfico em cinco linhas](MARCO3-DEMOGRAFIA.md). Corrigida somente a precedência de recuperação frente ao ofício, com exceção para comida urgente. Sem alterar fertilidade.\n\nPerfil Leve: 40 fundadores, 100 anos, três assentamentos nomeados. Líderes reais, mandato de cinco anos, sucessão por apoio/parentesco, relatos e campanhas com viagem abstrata. Guerra exige incidente conhecido e autoridade vigente; mudança de mandato cancela a campanha. Mortes passam pelo fluxo familiar existente, sem atribuir executor desconhecido. Os gatilhos desta fatia são golpes e mortes com autoria conhecida; não foram acrescentados roubo ou guerra por escassez. [Regras e limites](MARCO3-REGRAS.md).\n\nSeeds 006/011/028: declarações **${rows.map((r) => r.declarations).join("/")}**; mortes em conflito **${rows.map((r) => r.conflictDeaths).join("/")}**; términos por viuvez **${rows.map((r) => r.warWidows).join("/")}**; decisões de guarda ligadas ao conflito **${rows.map((r) => r.warCustody).join("/")}**, das quais sem responsável sobrevivente **${rows.map((r) => r.fullOrphans).join("/")}**. Sem quota ou seleção adicional.\n\nMotor Node: **${times.join("/")} s**, pico RSS **${mem.join("/")} MB**, JSON compacto **${logs.join("/")} MB** (gzip ${rows.map((r) => (r.gzipBytes / 1e6).toFixed(1)).join("/")} MB). Um ensaio isolado por seed, com aquecimento; relatório/validação fora do cronômetro. A referência de ~60 s ${rows.some((r) => r.coreMs > 60000) ? "foi ultrapassada; não declaro o orçamento de tempo cumprido" : "foi atendida nesses ensaios"}. RSS Node não certifica o teto da aba; não houve novo benchmark de memória do navegador.\n\nValidação causal, conservação e replay: **${rows.reduce((n, r) => n + r.errors.length, 0)} erros**. Testes metamórficos cobrem líder, incidente, notícia, autoridade e sucessão em viagem. 57 testes e build aprovados; 7 verificações de interface. Apenas o teste unitário de mortalidade controla o sorteio; a fixture biográfica e os mundos livres usam o sorteio normal. [Dados auditáveis](MARCO3-DADOS.json) · [Duas biografias da fixture](MARCO3-BIOGRAFIAS.md). A fixture produziu ${fixture.conflictDeaths} mortes, ${fixture.warWidows} términos por viuvez e ${fixture.warCustody} decisões de guarda (${fixture.fullOrphans} sem responsável sobrevivente); esses números não entram na distribuição livre. Parada nesta fatia.\n`,
);
console.log({
  times,
  mem,
  biographySeed: chosen?.seed,
  errors: rows.map((r) => r.errors.length),
});
