import { mkdirSync, writeFileSync } from "node:fs";
import { freeScenario, fixtureScenario } from "../src/engine/v2/scenario";
import { simulateSlice } from "../src/engine/v2/engine";
import { validateSlice } from "../src/engine/v2/validate";
import { story, distribution, selectStories } from "../src/engine/v2/report";
const start = performance.now(),
  all = [],
  durations: number[] = [];
const invalid = [];
for (let i = 0; i < 100; i++) {
  const begin = performance.now();
  const w = simulateSlice(freeScenario(`livre-${String(i).padStart(3, "0")}`));
  const errors = validateSlice(w);
  if (errors.length) invalid.push({ seed: w.scenario.seed, errors });
  const result = story(w);
  all.push(result);
  durations.push(performance.now() - begin);
}
const fixture = simulateSlice(fixtureScenario()),
  fixtureErrors = validateSlice(fixture);
durations.sort((a, b) => a - b);
const timings = {
  p50: Math.round(durations[49]),
  p95: Math.round(durations[94]),
  max: Math.round(durations[99]),
};
const summary = {
  timings,
  distribution: distribution(all),
  invalid,
  fixtureErrors,
  elapsedMs: Math.round(performance.now() - start),
  fixture: story(fixture),
  stories: all,
};
const chosen = selectStories(all);
mkdirSync("reports/marco1", { recursive: true });
writeFileSync(
  "reports/marco1/distribution.json",
  JSON.stringify(summary, null, 2),
);
writeFileSync("reports/marco1/fixture.json", JSON.stringify(fixture));
for (const s of chosen)
  writeFileSync(
    `reports/marco1/${s.seed}.json`,
    JSON.stringify(simulateSlice(freeScenario(s.seed))),
  );
const block = (s: ReturnType<typeof story>) =>
  `### ${s.seed} — ${s.outcome}\n\nModo: ${s.mode}. ${s.events} eventos; ${s.chain.length} elos na maior cadeia causal até o desfecho.\n\n${s.narrative.map((x) => `- ${x}`).join("\n")}\n\nMaior caminho causal (os demais ramos também são preservados): ${s.chain.join(" → ")}\n\nGrafo completo de apoio: ${s.causalEvents.length} eventos; IDs e arestas estão nos arquivos JSON.\n`;
const counts = Object.entries(summary.distribution.counts)
  .map(([o, n]) => `| ${o} | ${n} | ${n}% |`)
  .join("\n");
const markdown = `# Marco 1 — relatório da fatia de vingança\n\nExecução reproduzível: \`npm run report:m1\`. Lote fixo \`livre-000\` a \`livre-099\`; 20 pessoas, 240 meses por mundo. **Geração livre dentro de um cenário de rivalidade e parentesco:** não é ainda um mundo com geografia/população. Desfechos são resultados das ações, nunca categorias sorteadas por seed. A fixture é separada do lote.\n\n## Distribuição de 100 seeds\n\n| Desfecho focal por mundo | Quantidade | Percentual |\n|---|---:|---:|\n${counts}\n\n${summary.distribution.warning || "Nenhum desfecho atingiu 70%."}\n\nValidação: ${invalid.length} mundos inválidos; fixture: ${fixtureErrors.length} erros. Tempo total de geração e validação do lote: ${summary.elapsedMs} ms nesta máquina.\n\nTempo por mundo (geração, validação e extração): p50 ${timings.p50} ms; p95 ${timings.p95} ms; máximo ${timings.max} ms. São medições locais, não do computador da faculdade.\n\n## Três histórias encontradas no lote livre\n\n${chosen.map(block).join("\n")}\n## Fixture controlada\n\n${block(summary.fixture)}\n\n## Avaliação de qualidade e proposta\n\nO lote inicial teve 70% de desistências e zero reconciliações. Se esses valores persistirem, há concentração relevante no limiar e a reconciliação livre não está demonstrada. O teste positivo controlado prova apenas possibilidade. Proposta para revisão posterior: separar a intenção de buscar acordo do perdão unilateral e permitir aguardar o próximo reencontro antes de encerrar o objetivo; medir novamente no mesmo lote e em seeds reservadas. Não alterar os desfechos por quota, nem afrouxar os testes para esconder o resultado.\n\nFalhas iniciais e correções estão em [MARCO1-EXECUTION-NOTES.md](MARCO1-EXECUTION-NOTES.md). A distribuição inclui todos os seis rótulos, inclusive contagens zero. Os resultados dos testes são registrados após a suíte completa.\n\n## Limites\n\nConfronto é escalar e abstrato, sem corpo, arma, mapa, senescência ou novos sistemas de pessoa profunda. A agenda de presença é exógena e declarada na origem. Relatos propagam apenas mortes conhecidas; pedir ajuda pode liberar treino assistido. Perdão unilateral é desistência; reconciliação exige presença e aceitação do alvo. Fuga significa que o alvo abandonou este cenário após escolher escapar. Horizonte sem resolução, ausência de objetivo ou morte do vingador são objetivo frustrado, com motivo distinguido nos dados.\n\nOs arquivos JSON completos e a distribuição por seed ficam em \`reports/marco1/\` e são regeneráveis; não devem ser confundidos com a antiga UI v1.\n`;
writeFileSync("docs/MARCO1-REPORT.md", markdown);
console.log(
  JSON.stringify(
    {
      ...summary,
      stories: undefined,
      fixture: summary.fixture.narrative,
      selected: chosen.map((s) => ({
        seed: s.seed,
        outcome: s.outcome,
        narrative: s.narrative,
      })),
    },
    null,
    2,
  ),
);
if (invalid.length || fixtureErrors.length || chosen.length < 3)
  process.exitCode = 1;
