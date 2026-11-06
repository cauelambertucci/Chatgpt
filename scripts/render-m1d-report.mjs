import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const statusLabels = {
  completed: "cumprido",
  failed: "falha",
  abandoned: "abandono",
  resolved_by_other: "resolvido por outro",
};
const labels = {
  proteger: "Proteção",
  amizade: "Amizade",
  governar: "Coordenação",
  criar_obra: "Obra",
};
const count = (x, status) => x?.[status] || 0;
const total = (x) => Object.values(x || {}).reduce((s, n) => s + n, 0);
const pct = (a, b) =>
  b ? `${((100 * a) / b).toFixed(1).replace(".", ",")}%` : "—";
export function renderM1dReport(r) {
  const lines = [
    "# Marco 1d — necessidades, estresse e consequências",
    "",
    "**Concluído e parado antes do Marco 2.** Dois lotes fixos de 100 seeds, sem quotas, descarte de seeds ou recalibração de proteção, amizade e obra. Atributos/agendas iniciais são iguais aos do perfil 1c. As novas regras emocionais e sociais podem mudar as decisões e os desfechos.",
    "",
    "## Verificação",
    "",
    `- Mundos inválidos: **${r.invalid}/200**; fixtures validadas separadamente.`,
    `- Regras congeladas: **${Object.values(r.frozenChecks).filter(Boolean).length}/${Object.keys(r.frozenChecks).length} hashes conferem** (estimativas de proteção, catálogo/pesos de personalidade, amizade e obra).`,
    "- Testes e build: consultar a verificação final em [MARCO1D-EXECUTION-NOTES.md](MARCO1D-EXECUTION-NOTES.md); o gerador de relatório não executa a suíte.",
    "- Os erros encontrados, inclusive uma falha real no teste de adulteração e um timeout do Vitest, estão registrados nas notas.",
    "",
    "## Distribuição completa dos objetivos pessoais",
    "",
    "Contagens absolutas. “Por outro” é uma categoria separada: não entra como êxito próprio nem como falha. O denominador inclui todas as adoções. Atual = `pessoal-1c-000..099`; reservado = `reservado-1d-000..099`.",
    "",
    "| Lote | Motor | Objetivo | Total | Cumprido | Falha | Abandono | Por outro |",
    "|---|---|---|---:|---:|---:|---:|---:|",
  ];
  for (const [prefix, b] of Object.entries(r.batches))
    for (const phase of ["before", "after"])
      for (const type of Object.keys(labels)) {
        const c = b[phase].counts[type] || {};
        lines.push(
          `| ${prefix === "pessoal-1c" ? "Atual" : "Reservado"} | ${phase === "before" ? "1c" : "1d"} | ${labels[type]} | ${total(c)} | ${count(c, "completed")} | ${count(c, "failed")} | ${count(c, "abandoned")} | ${count(c, "resolved_by_other")} |`,
        );
      }
  lines.push(
    "",
    "| Lote | Falhas de proteção antes | Falhas de proteção depois | Mortes antes → depois | Ameaças antes → depois |",
    "|---|---:|---:|---:|---:|",
  );
  for (const [prefix, b] of Object.entries(r.batches)) {
    const old = b.before.counts.proteger,
      now = b.after.counts.proteger;
    lines.push(
      `| ${prefix === "pessoal-1c" ? "Atual" : "Reservado"} | ${count(old, "failed")}/${total(old)} (${pct(count(old, "failed"), total(old))}) | ${count(now, "failed")}/${total(now)} (${pct(count(now, "failed"), total(now))}) | ${b.before.deaths} → ${b.after.deaths} | ${b.before.threats} → ${b.after.threats} |`,
    );
  }
  lines.push(
    "",
    "A diferença não mede apenas a correção de classificação: necessidades, transformações e consequências também alteram as trajetórias. Os números de adoções e mortes são mostrados para evitar atribuir toda mudança da taxa a uma melhoria do protetor.",
    "",
    "## Emoções, crise e reincidência",
    "",
    "| Medida no 1d | Atual | Reservado |",
    "|---|---:|---:|",
  );
  const batches = Object.values(r.batches).map((b) => b.after);
  for (const [title, key, field] of [
    ["Emoções por perda", "emotions", "perda"],
    ["Emoções por ameaça sofrida", "emotions", "ameaca"],
    ["Emoções por vitória", "emotions", "vitoria"],
    ["Emoções por traição percebida", "emotions", "traicao"],
    ["Emoções por fracasso", "emotions", "fracasso"],
    ["Recuperação escolhida", "responses", "recuperar"],
    ["Isolamento escolhido", "responses", "isolar"],
    ["Hostilidade verbal escolhida", "responses", "hostilizar"],
    ["Abandono de posto escolhido", "responses", "abandonar_posto"],
    ["Confronto ao reincidente", "sanctions", "confronto"],
    ["Expulsão", "sanctions", "expulsao"],
    ["Perdão condicional", "sanctions", "perdao"],
    ["Pedido de acordo", "sanctions", "acordo"],
  ])
    lines.push(
      `| ${title} | ${batches[0][key][field] || 0} | ${batches[1][key][field] || 0} |`,
    );
  for (const [title, key] of [
    ["Transformações efetivas", "transformations"],
    [
      "Pessoa-meses com estresse ≥650 na atualização mensal",
      "highStressPersonMonths",
    ],
    ["Máximo de ameaças por agressor", "maxThreatsPerAggressor"],
    ["Eventos no lote", "totalEvents"],
    ["Maior tempo por mundo, com validação/ranking (ms)", "maxMs"],
    ["Seeds sem história qualificada no ranking", "emptyRanks"],
  ])
    lines.push(`| ${title} | ${batches[0][key]} | ${batches[1][key]} |`);
  lines.push(
    "",
    "O lote reservado revelou a falha de relatório da seed 096, agora incorporada à regressão; não foi utilizado para calibrar pesos ou taxas. Concentrações superiores a 70% foram mantidas:",
    "",
  );
  let dominant = 0;
  for (const [prefix, b] of Object.entries(r.batches))
    for (const [type, c] of Object.entries(b.after.counts))
      for (const [status, n] of Object.entries(c))
        if (n / total(c) > 0.7) {
          dominant++;
          lines.push(
            `- ${prefix === "pessoal-1c" ? "Atual" : "Reservado"}, ${labels[type]}: ${statusLabels[status] || status} = ${n}/${total(c)} (${pct(n, total(c))}).`,
          );
        }
  if (!dominant)
    lines.push("- Nenhum desfecho de objetivo pessoal superou 70%.");
  lines.push(
    "",
    "Não houve ajuste para distribuir esses resultados. Recuperação não exige crise; as outras três respostas exigem estresse alto. Zeros na geração livre são mostrados, mesmo quando uma ação funciona nas fixtures. Fracassos no fim do horizonte também geram emoção, mas não há meses posteriores para observar suas consequências neste lote.",
    "",
    "## Três casos reais de geração livre",
    "",
    "São exemplos diagnósticos encontrados após gerar as seeds, não três posições garantidas no ranking. Um fechamento imediato continua penalizado e pode ser excluído do ranking.",
  );
  for (const [index, example] of r.examples.entries()) {
    const w = JSON.parse(
      readFileSync(`reports/marco1d/${example.seed}.json`, "utf8"),
    );
    const e = w.events[Number(example.event.split(":")[1])];
    const name = (id) => w.entities[id]?.name || id;
    const when = `ano ${Math.floor(e.month / 12)}, mês ${(e.month % 12) + 1}`;
    lines.push(
      "",
      `### ${index + 1}. ${example.seed} — ${example.category}`,
      "",
    );
    if (example.category === "transformacao") {
      const emotion = w.events[Number(String(e.data.emotion).split(":")[1])];
      const source =
        w.events[Number(String(emotion.data.stimulusSource).split(":")[1])];
      lines.push(
        `${name(e.participants[0].id)}, no ${when}, reagiu a ${emotion.data.stimulus} com ${emotion.data.emotion}. ${e.data.facet}: ${e.data.facetBefore} → ${e.data.facetAfter}; ${e.data.value}: ${e.data.valueBefore} → ${e.data.valueAfter}; estresse: ${emotion.data.stressBefore} → ${emotion.data.stressAfter}. Cadeia: ${source.id} (${source.type}) → ${emotion.id} (emoção) → ${e.id} (transformação).`,
      );
    } else if (example.category === "consequencia") {
      lines.push(
        `${name(e.participants[0].id)} respondeu à ${e.data.count}ª ameaça de ${name(e.data.aggressor)}, no ${when}, com **${e.data.response}**. Utilidades: ${Object.entries(
          e.data.utilities,
        )
          .map(([k, v]) => `${k} ${v}`)
          .join(
            ", ",
          )}. O agressor ${e.data.complies ? "aceitou cessar" : "não recebeu obediência automática"}; o registro distingue perdão de acordo. Evento ${e.id}, causado pela ameaça ${e.data.threat} e pelo registro de reincidência.`,
      );
    } else {
      const g = w.entities[String(e.data.goal)];
      const resolution = e.causes
        .map((id) => w.events[Number(id.split(":")[1])])
        .find(
          (x) =>
            x.type === "confrontation.prevented" ||
            x.type === "aggressor.consequence" ||
            x.type === "confrontation.resolved",
        );
      const success = w.events.find(
        (x) =>
          x.type === "protection.succeeded" &&
          x.seq < (resolution?.seq || e.seq) &&
          x.effects.some(
            (effect) =>
              effect.entity.kind === "personalGoal" &&
              effect.entity.threat === g.threat,
          ),
      );
      const helper = success
        ? name(success.participants.find((p) => p.role === "actor").id)
        : "outro agente";
      lines.push(
        `${name(g.owner)} assumiu proteger ${name(g.target)}, mas ${helper} resolveu a ameaça. ${name(g.owner)} presenciou o resultado e encerrou **resolvido por outro**, com **${g.interventions} intervenções próprias**, no ${when}. Percepção ${g.perception}; resolução ${resolution?.id}; fechamento ${e.id}. Como adoção e desfecho ocorreram no mesmo mês, sem decisão intermediária própria, este caso recebe a penalidade do ranking.`,
      );
    }
  }
  lines.push(
    "",
    "## Fixture metamórfica — mesma perda, personalidades diferentes",
    "",
  );
  for (const [index, f] of r.fixtures.slice(0, 2).entries()) {
    const loss = f.emotions.find((e) => e.stimulus === "perda");
    const fixture = JSON.parse(
      readFileSync(`reports/marco1d/fixture-${index}.json`, "utf8"),
    );
    const felt = fixture.events.find(
      (e) =>
        e.type === "emotion.felt" &&
        e.participants[0].id === fixture.scenario.focal &&
        e.data.stimulus === "perda",
    );
    const transformed = fixture.events.find(
      (e) => e.type === "person.transformed" && e.causes.includes(felt.id),
    ).data;
    lines.push(
      `- ${index === 0 ? "Personalidade irada" : "Personalidade solidária"}: ${loss.emotion}; estresse ${loss.stressBefore} → ${loss.stressAfter}; ${transformed.facet} ${transformed.facetBefore} → ${transformed.facetAfter}; ${transformed.value} ${transformed.valueBefore} → ${transformed.valueAfter}, após notícia própria.`,
    );
  }
  lines.push(
    "",
    "Os testes comparam a mesma morte real, verificam alterações numéricas distintas e demonstram que bloquear a notícia elimina o luto por essa perda. Outras fixtures cobrem crise, promessa quebrada, quatro respostas à reincidência e proteção redundante. São intervenções identificadas de teste, não histórias livres.",
    "",
    "## Limites e parada",
    "",
    "Há quatro necessidades e uma avaliação emocional inicial; não é psicologia completa. Consequências sociais são locais e abstratas: terceira ameaça recebe uma resposta; reincidir após uma consequência leva à expulsão. Assim o limite de quatro ameaças é uma regra explícita do cenário, não evidência de justiça social emergente. Isolamento dura dois meses, expulsão persiste.",
    "",
    "O relatório levou " +
      Math.round(r.elapsedMs / 1000) +
      " s nesta execução. A duração inclui validação e ranking e parte do lote teve carga concorrente; não é benchmark isolado. O perfil segue em 20 pessoas/240 meses, sem ensaio v2 de 300 anos. Logs completos são grandes porque guardam os efeitos completos para replay.",
    "",
    "**Pesos de proteção, amizade e obra preservados. Marco 2 não iniciado. Nenhum push ou publicação.**",
    "",
    "Arquivos: [métricas](MARCO1D-METRICS.json), [baseline](MARCO1D-BASELINE.json), [falhas e reprodução](MARCO1D-EXECUTION-NOTES.md), [modelo em uma página](DESIGN-RESUMO.md). Logs e fixtures regeneráveis: `npm run report:m1d`.",
    "",
  );
  writeFileSync("docs/MARCO1D-REPORT.md", lines.join("\n"));
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  renderM1dReport(
    JSON.parse(readFileSync("docs/MARCO1D-METRICS.json", "utf8")),
  );
