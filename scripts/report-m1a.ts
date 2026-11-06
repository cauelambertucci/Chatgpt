import { readFileSync, writeFileSync } from "node:fs";
import { simulateSlice } from "../src/engine/v2/engine";
import { freeScenario } from "../src/engine/v2/scenario";
import { story, distribution } from "../src/engine/v2/report";
import { validateSlice } from "../src/engine/v2/validate";
const baseline = JSON.parse(readFileSync("docs/MARCO1A-BASELINE.json", "utf8")),
  batches: Record<string, unknown> = {},
  tables: string[] = [];
let errors = 0;
for (const prefix of ["livre", "reservado-1a"]) {
  const stories = [];
  for (let i = 0; i < 100; i++) {
    const w = simulateSlice(
      freeScenario(`${prefix}-${String(i).padStart(3, "0")}`),
    );
    const invalid = validateSlice(w);
    if (invalid.length) {
      errors++;
      console.error(w.scenario.seed, invalid.slice(0, 3));
    }
    stories.push(story(w));
  }
  const after = distribution(stories),
    before = baseline.batches[prefix].distribution;
  batches[prefix] = {
    before,
    after,
    outcomes: stories.map((s) => ({
      seed: s.seed,
      outcome: s.outcome,
      depth: s.chain.length,
      rawDepth: s.rawDepth,
    })),
    example: stories.find((s) => s.outcome === "reconciliação"),
  };
  tables.push(
    `## ${prefix}: 100 seeds\n\n| Desfecho | Antes | Depois |\n|---|---:|---:|\n` +
      Object.keys(after.counts)
        .map((k) => `| ${k} | ${before.counts[k]} | ${after.counts[k]} |`)
        .join("\n") +
      `\n\n${after.warning || "Nenhum desfecho atingiu 70%."}\n`,
  );
}
writeFileSync(
  "docs/MARCO1A-COMPARISON.json",
  JSON.stringify({ engine: "agents-slice-1a", errors, batches }, null, 2),
);
writeFileSync(
  "docs/MARCO1A-REPORT.md",
  `# Condições antes do Marco 1b\n\n${tables.join("\n")}\nErros de validação: ${errors}. Parâmetros da separação foram definidos antes de inspecionar os resultados reservados; nenhum desfecho foi selecionado por quota. Lote atual: livre-000..099; reservado: reservado-1a-000..099.\n\nBuscar acordo cria intenção persistente: ausência não equivale a recusa. Oferta só ocorre em presença mútua, resposta é do alvo e fica registrada. Perdão é uma renúncia unilateral, mesmo que o outro aceitasse conversar. Uma resposta negativa não fecha o objetivo automaticamente; as ações são reavaliadas.\n\nRotinas consecutivas do mesmo agente/ação viram um episódio antes de calcular profundidade. Eventos significativos interrompem o agrupamento. Causas externas são preservadas no DAG, ciclos são rejeitados e o log bruto permanece imutável. A profundidade bruta é mostrada separadamente, nunca usada para ordenar histórias.\n`,
);
console.log(
  JSON.stringify(
    {
      errors,
      batches: Object.fromEntries(
        Object.entries(batches).map(([k, v]) => [
          k,
          {
            before: (v as any).before.counts,
            after: (v as any).after.counts,
            example: (v as any).example?.seed,
          },
        ]),
      ),
    },
    null,
    2,
  ),
);
if (errors) process.exitCode = 1;
