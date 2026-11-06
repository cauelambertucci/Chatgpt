import {
  protectionFixture,
  friendshipFixture,
} from "../src/engine/v2/personal-fixtures";
import { writeFileSync, mkdirSync } from "node:fs";
import { personalScenario } from "../src/engine/v2/scenario";
import { simulateSlice } from "../src/engine/v2/engine";
import { validateSlice } from "../src/engine/v2/validate";
import {
  personalGoals,
  personalStory,
  type PersonalStory,
} from "../src/engine/v2/personal-report";
const start = performance.now(),
  counts = {
    amizade: { completed: 0, failed: 0, abandoned: 0 },
    proteger: { completed: 0, failed: 0, abandoned: 0 },
  },
  examples: PersonalStory[] = [],
  rows = [];
let invalid = 0,
  maxMs = 0;
for (let i = 0; i < 100; i++) {
  const begin = performance.now(),
    w = simulateSlice(
      personalScenario(`pessoal-1b-${String(i).padStart(3, "0")}`),
    ),
    errors = validateSlice(w);
  if (errors.length) {
    invalid++;
    console.error(w.scenario.seed, errors.slice(0, 4));
  }
  const gs = personalGoals(w);
  for (const g of gs) if (g.status) counts[g.type][g.status]++;
  const candidates = [
    gs.find((g) => g.type === "proteger" && g.status === "completed"),
    gs.find((g) => g.type === "amizade" && g.status === "completed"),
    gs.find((g) => g.type === "proteger" && g.status === "failed"),
  ];
  for (const g of candidates)
    if (g && !examples.some((s) => s.type === g.type && s.status === g.status))
      examples.push(personalStory(w, g));
  const elapsed = performance.now() - begin;
  maxMs = Math.max(maxMs, elapsed);
  rows.push({
    seed: w.scenario.seed,
    events: w.events.length,
    goals: gs.map((g) => ({
      id: g.id,
      type: g.type,
      status: g.status,
      interventions: g.interventions,
    })),
    elapsedMs: Math.round(elapsed),
  });
}
const selected = examples
    .sort(
      (a, b) =>
        Number(b.type === "proteger" && b.status === "completed") -
        Number(a.type === "proteger" && a.status === "completed"),
    )
    .slice(0, 3),
  warnings = Object.entries(counts).flatMap(([type, c]) => {
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    return Object.entries(c)
      .filter(([, n]) => total && n / total >= 0.7)
      .map(
        ([status, n]) =>
          `${type}: ${status} = ${n}/${total} (${Math.round((n / total) * 100)}%). Investigar capacidades, oportunidades e aceitação; sem quota.`,
      );
  });
const fixtures = [protectionFixture(), friendshipFixture()].map((s) => {
  const w = simulateSlice(s),
    errors = validateSlice(w);
  if (errors.length) invalid++;
  const g = personalGoals(w).find(
    (g) =>
      g.type === (s.seed === "fixture-proteger" ? "proteger" : "amizade") &&
      g.owner === (s.seed === "fixture-proteger" ? s.people[3].id : s.focal),
  )!;
  return { seed: s.seed, errors, story: personalStory(w, g), world: w };
});
const result = {
  engine: "agents-slice-1b",
  invalid,
  fixtures: fixtures.map((f) => ({
    seed: f.seed,
    errors: f.errors,
    story: f.story,
  })),
  counts,
  warnings,
  maxMs: Math.round(maxMs),
  elapsedMs: Math.round(performance.now() - start),
  examples: selected,
  rows,
};
mkdirSync("reports/marco1b", { recursive: true });
writeFileSync("reports/marco1b/results.json", JSON.stringify(result, null, 2));
for (const f of fixtures)
  writeFileSync(`reports/marco1b/${f.seed}.json`, JSON.stringify(f.world));
for (const s of selected)
  writeFileSync(
    `reports/marco1b/${s.seed}.json`,
    JSON.stringify(simulateSlice(personalScenario(s.seed))),
  );
const table = Object.entries(counts)
  .map(
    ([type, c]) =>
      `| ${type} | ${c.completed} | ${c.failed} | ${c.abandoned} |`,
  )
  .join("\n");
writeFileSync(
  "docs/MARCO1B-REPORT.md",
  `# Marco 1b — proteção e amizade\n\n100 seeds livres fixas: pessoal-1b-000..099. Cada cenário tem 20 pessoas e 240 meses. Atributos e agendas são seedados; nenhum desfecho é escolhido por quota. As contagens abaixo são **objetivos**, não mundos: uma pessoa pode ter mais de um compromisso.\n\n| Objetivo | Cumprido | Frustrado/falhou | Abandonado |\n|---|---:|---:|---:|\n${table}\n\n${warnings.join("\n\n") || "Nenhuma categoria atingiu 70%."}\n\nErros de validação: ${invalid}. Tempo total do lote: ${result.elapsedMs} ms; maior geração/validação/extrator por mundo: ${result.maxMs} ms nesta máquina.\n\n## Três histórias realmente encontradas\n\n${selected.map((s) => `### ${s.seed}: ${s.type} — ${s.status}\n\n${s.narrative.join("\n\n")}\n\nProfundidade após colapso: ${s.depth}; períodos repetidos removidos da contagem: ${s.periodsCollapsed}. IDs do caminho: ${s.chain.join(" → ")}.\n`).join("\n")}\n\n## Fixtures separadas do lote livre

${fixtures.map((f) => `### ${f.seed}\n\n${f.story.narrative.join("\n\n")}`).join("\n\n")}

## Escopo e limites\n\nAmizade exige encontro conhecido, convites aceitos e confiança bilateral; após três recusas o agente desiste de insistir. Proteção exige testemunho local de ameaça, decisão por utilidade e capacidade de intervenção. O objetivo de proteção é monitorado até o horizonte ou a morte de um envolvido; não é declarado cumprido só por adotar o compromisso. Uma intervenção abstrata pode dissuadir uma rivalidade imediata, sem corpo ou física de combate. Relações e objetivos são persistidos por eventos e replay.\n\nFicam fora desta etapa corpo, romance, mapa novo, instituições e personalidade completa. A UI v1 não foi migrada. O lote reservado da condição 1a não foi usado para calibrar o 1b. Testes, fixtures e falhas de implementação estão em MARCO1B-EXECUTION-NOTES.md.\n`,
);
console.log(
  JSON.stringify(
    {
      ...result,
      rows: undefined,
      examples: selected.map((s) => ({
        seed: s.seed,
        type: s.type,
        status: s.status,
        depth: s.depth,
        narrative: s.narrative,
      })),
    },
    null,
    2,
  ),
);
if (invalid || selected.length < 3) process.exitCode = 1;
