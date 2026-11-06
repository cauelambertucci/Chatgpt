import { mkdirSync, writeFileSync } from "node:fs";
import { advancedScenario } from "../src/engine/v2/scenario";
import { advancedFixture } from "../src/engine/v2/advanced-fixtures";
import { simulateSlice } from "../src/engine/v2/engine";
import { validateSlice } from "../src/engine/v2/validate";
import {
  personalGoals,
  personalStory,
  personalStories,
  type PersonalStory,
} from "../src/engine/v2/personal-report";
const counts: Record<string, Record<string, number>> = {},
  examples: PersonalStory[] = [],
  rows = [];
let invalid = 0,
  maxMs = 0;
const start = performance.now();
for (let i = 0; i < 100; i++) {
  const begin = performance.now(),
    w = simulateSlice(
      advancedScenario(`pessoal-1c-${String(i).padStart(3, "0")}`),
    ),
    errors = validateSlice(w);
  if (errors.length) {
    invalid++;
    console.error(w.scenario.seed, errors.slice(0, 4));
  }
  const gs = personalGoals(w);
  for (const g of gs) {
    counts[g.type] ||= { completed: 0, failed: 0, abandoned: 0 };
    counts[g.type][g.status || "active"] =
      (counts[g.type][g.status || "active"] || 0) + 1;
  }
  for (const [type, status] of [
    ["governar", "completed"],
    ["criar_obra", "completed"],
    ["governar", "failed"],
  ] as const) {
    const g = gs.find((g) => g.type === type && g.status === status);
    if (g && !examples.some((s) => s.type === type && s.status === status)) {
      const s = personalStory(w, g);
      if (s.score > 0) examples.push(s);
    }
  }
  maxMs = Math.max(maxMs, performance.now() - begin);
  rows.push({
    seed: w.scenario.seed,
    events: w.events.length,
    works: Object.values(w.entities).filter((e) => e.kind === "work").length,
    goals: gs.map((g) => ({
      type: g.type,
      status: g.status,
      reason: g.reason,
    })),
    valid: errors.length === 0,
  });
}
const fixtures = ["governar", "criar_obra"].map((type) => {
  const w = simulateSlice(advancedFixture(type as "governar" | "criar_obra")),
    errors = validateSlice(w);
  if (errors.length) invalid++;
  const g = personalGoals(w).find((g) => g.type === type)!;
  return {
    seed: w.scenario.seed,
    errors,
    story: personalStory(w, g),
    world: w,
  };
});
const result = {
  engine: "agents-slice-1c",
  facets: 30,
  values: 20,
  invalid,
  counts,
  maxMs: Math.round(maxMs),
  elapsedMs: Math.round(performance.now() - start),
  examples: examples.slice(0, 3),
  rows,
  fixtures: fixtures.map((f) => ({
    seed: f.seed,
    errors: f.errors,
    story: f.story,
  })),
};
mkdirSync("reports/marco1c", { recursive: true });
writeFileSync("reports/marco1c/results.json", JSON.stringify(result, null, 2));
for (const f of fixtures)
  writeFileSync(`reports/marco1c/${f.seed}.json`, JSON.stringify(f.world));
for (const s of result.examples)
  writeFileSync(
    `reports/marco1c/${s.seed}.json`,
    JSON.stringify(simulateSlice(advancedScenario(s.seed))),
  );
const warnings = Object.entries(counts).flatMap(([type, c]) => {
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  return Object.entries(c)
    .filter(([, n]) => n / total >= 0.7)
    .map(
      ([status, n]) =>
        `${type}: ${status} ${n}/${total}; concentração >=70%, sem quota para corrigir.`,
    );
});
writeFileSync(
  "docs/MARCO1C-REPORT.md",
  `# Marco 1c — personalidade, poder e obra\n\n100 seeds livres: pessoal-1c-000..099; 20 agentes e 240 meses. Catálogo: 30 facetas (0–100) e 20 valores (-100–100), todos com canais de influência em ações, detalhados nos escores.\n\n| Objetivo | Cumprido | Falhou | Abandonado |\n|---|---:|---:|---:|\n${Object.entries(
    counts,
  )
    .map(
      ([type, c]) =>
        `| ${type} | ${c.completed} | ${c.failed} | ${c.abandoned} |`,
    )
    .join(
      "\n",
    )}\n\nSão objetivos, não mundos. ${warnings.join(" ")}\n\nValidação: ${invalid} mundos/fixtures inválidos. Lote: ${result.elapsedMs} ms; maior tempo por mundo/extrator: ${result.maxMs} ms nesta máquina.\n\n## Histórias encontradas, sem preenchimento artificial\n\n${result.examples.map((s) => `### ${s.seed}: ${s.type} — ${s.status}\n\n${s.narrative.join("\n\n")}\n\nProfundidade ${s.depth}, escore ${s.score}; ${s.periodsCollapsed} períodos repetidos colapsados.`).join("\n\n")}\n\n## Fixtures separadas\n\n${fixtures.map((f) => `### ${f.seed}\n\n${f.story.narrative.join("\n\n")}`).join("\n\n")}\n\n## Avaliação das concentrações

Fracasso por candidato não é vacância por mundo: vários agentes disputam uma única coordenação. A próxima avaliação deve medir também vagas e trocas de apoio, sem tentar eleger todos. Para amizade, investigar reação a recusas e afinidade conhecida antes de insistir. Para obras, o critério atual é concluir um livro simples; avaliar qualidade, ambição artística e custos antes de interpretar uma alta conclusão como excelência. Nenhuma falha foi sorteada para equilibrar resultados.

## Escopo\n\nPoder significa coordenar o grupo abstrato por maioria de apoios, não criar governo/civilização. Cada apoiador decide e pode trocar apoio; mortos e ausentes não contam no quórum. Obra é um livro simples que exige papel/tinta e seis períodos, criador, qualidade e tema conhecido; não implementa o sistema amplo de artefatos. A versão 1c não continua checkpoints de regras antigas silenciosamente. Sem corpo, mapa novo, religião nova, estresse clínico ou UI nova.\n\nO ranking penaliza adoção/desfecho no mesmo mês sem decisão intermediária, usa profundidade pós-colapso e retorna menos de dez se faltar material qualificado. Logs completos e fixtures ficam em reports/marco1c, regeneráveis com npm run report:m1c.\n`,
);
console.log(
  JSON.stringify(
    {
      engine: result.engine,
      invalid,
      counts,
      maxMs: result.maxMs,
      elapsedMs: result.elapsedMs,
      warnings,
      examples: result.examples.map((s) => ({
        seed: s.seed,
        type: s.type,
        status: s.status,
        score: s.score,
        narrative: s.narrative,
      })),
      fixtures: fixtures.map((f) => ({
        seed: f.seed,
        status: f.story.status,
        errors: f.errors,
      })),
    },
    null,
    2,
  ),
);
if (invalid) process.exitCode = 1;
