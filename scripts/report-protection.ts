import { gunzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { simulateSlice } from "../src/engine/v2/engine";
import { personalScenario } from "../src/engine/v2/scenario";
import { personalGoals } from "../src/engine/v2/personal-report";
import { validateSlice } from "../src/engine/v2/validate";
import { collapsedCausality } from "../src/engine/v2/causal";
const baseline = JSON.parse(
    readFileSync("docs/PROTECTION-BASELINE.json", "utf8"),
  ),
  batches: Record<string, unknown> = {},
  tables = [];
let invalid = 0;
for (const prefix of ["pessoal-1b", "reservado-protecao"]) {
  const rows = [];
  for (let i = 0; i < 100; i++) {
    const w = simulateSlice(
        personalScenario(`${prefix}-${String(i).padStart(3, "0")}`),
      ),
      errors = validateSlice(w);
    if (errors.length) {
      invalid++;
      console.error(w.scenario.seed, errors.slice(0, 2));
    }
    const gs = personalGoals(w).filter((g) => g.type === "proteger");
    rows.push({
      seed: w.scenario.seed,
      adopted: gs.length,
      completed: gs.filter((g) => g.status === "completed").length,
      failed: gs.filter((g) => g.status === "failed").length,
      declined: w.events.filter((e) => e.type === "protection.declined").length,
      failedNoOwnActionButAlive: gs.filter(
        (g) =>
          g.status === "failed" &&
          g.interventions === 0 &&
          (w.entities[g.target] as any).alive &&
          (w.entities[g.owner] as any).alive,
      ).length,
      deaths: w.events.filter((e) => e.type === "person.died").length,
      threats: w.events.filter((e) => e.type === "threat.announced").length,
      actions: Object.fromEntries(
        ["proteger", "avisar_alvo", "pedir_aliados", "afastar_alvo"].map(
          (a) => [a, w.events.filter((e) => e.decision?.chosen === a).length],
        ),
      ),
    });
  }
  const sum = (rs: any[]) =>
    Object.fromEntries(
      ["adopted", "completed", "failed", "declined", "deaths", "threats"].map(
        (k) => [k, rs.reduce((n, r) => n + r[k], 0)],
      ),
    );
  const before = sum(baseline.batches[prefix]),
    after = sum(rows);
  batches[prefix] = {
    before,
    after,
    failedNoOwnActionButAlive: rows.reduce(
      (n, r) => n + r.failedNoOwnActionButAlive,
      0,
    ),
    failureBefore: before.failed / before.adopted,
    failureAfter: after.adopted ? after.failed / after.adopted : 0,
    rows,
  };
  tables.push(
    `## ${prefix} — 100 seeds\n\n| Métrica | Antes | Depois |\n|---|---:|---:|\n${Object.keys(
      before,
    )
      .map((k) => `| ${k} | ${before[k]} | ${after[k]} |`)
      .join(
        "\n",
      )}\n\nFalhas por compromisso: ${((before.failed / before.adopted) * 100).toFixed(1)}% → ${((after.failed / after.adopted) * 100).toFixed(1)}%. Recusas de adoção e mortes também são mostradas para não ocultar mudanças de denominador.\n`,
  );
}
const oldWorld = JSON.parse(
    gunzipSync(
      readFileSync("docs/reference-baselines/marco1b-audit.json.gz"),
    ).toString("utf8"),
  ),
  example = JSON.parse(
    readFileSync(
      "docs/reference-baselines/marco1b-audit-metadata.json",
      "utf8",
    ),
  ),
  end = example.rawEvents.at(-1),
  newGraph = collapsedCausality(oldWorld, end);
const audit = {
  before: example.depth,
  after: newGraph.depth,
  oldRoutineNodes: 44,
  monitoringPeriods: newGraph.episodes.reduce(
    (n, e) => n + (e.monitoringPeriods || 0),
    0,
  ),
};
writeFileSync(
  "docs/PROTECTION-COMPARISON.json",
  JSON.stringify({ invalid, batches, audit }, null, 2),
);
writeFileSync(
  "docs/PROTECTION-REPORT.md",
  `# Proteção antes do 1c\n\n${tables.join("\n")}\nErros de validação: ${invalid}. O novo lote reservado não foi usado para escolher pesos; não há quota de sucesso. Estimativas são heurísticas registradas, não probabilidades calibradas.\n\nAntes da adoção cada interessado compara capacidade própria, ameaça observada e planos disponíveis; registra estimativas e pode recusar compromisso inviável. Novas respostas: avisar, solicitar apoio conhecido e afastar com consentimento. Apoio depende da resposta do aliado, aviso/afastamento da resposta do alvo. Permanência em abrigo dura três meses e o retorno é explícito.\n\n## Auditoria de profundidade\n\nNo log histórico pessoal-1b-000, os 49 elos incluíam 44 blocos de rotina, não 44 fatos importantes. Com agregação da alternância treino/espera, a mesma história tem ${newGraph.depth} elos. O motor anterior não emitia monitoramento periódico separado. Agora a rotina agrega também os objetivos monitorados; quantidade de períodos e IDs são preservados e uma sequência de monitoramento não aumenta a profundidade por passar o tempo. Novas ameaças e decisões concretas continuam sendo fatos separados.\n\nFalhas residuais também incluem compromissos redundantes sem contribuição própria com envolvidos vivos; essa contagem está no JSON por lote. Não é equivalente a mortalidade. Uma próxima revisão deve coordenar responsabilidades, em vez de conceder sucesso a espectadores.

O ranking subtrai uma penalidade explícita quando adoção e desfecho são no mesmo mês e não há decisão intermediária. Não completa a lista com casos abaixo do limiar; retorna até dez.\n`,
);
console.log(
  JSON.stringify(
    {
      invalid,
      batches: Object.fromEntries(
        Object.entries(batches).map(([k, v]) => [
          k,
          {
            before: (v as any).before,
            after: (v as any).after,
            failureBefore: (v as any).failureBefore,
            failureAfter: (v as any).failureAfter,
            failedNoOwnActionButAlive: (v as any).failedNoOwnActionButAlive,
          },
        ]),
      ),
      audit,
    },
    null,
    2,
  ),
);
if (invalid) process.exitCode = 1;
