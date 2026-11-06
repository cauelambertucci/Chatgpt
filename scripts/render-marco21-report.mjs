import { readFileSync, writeFileSync } from "node:fs";
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const r = read("docs/MARCO21-METRICS.json"),
  n = read("docs/MARCO21-BENCHMARK.json"),
  b = read("docs/MARCO21-BROWSER.json"),
  a = read("docs/MARCO21-ACTIVE-BENCHMARK.json"),
  ab = read("docs/MARCO21-ACTIVE-BROWSER.json");
if (r.invalid || Object.values(r.batches).some((b) => b.rows.length !== 100))
  throw Error("Incomplete/invalid cohort");
const f = (x, d = 2) => Number(x).toFixed(d).replace(".", ",");
const med = (v) => [...v].sort((x, y) => x - y)[Math.floor(v.length / 2)];
const keys = ["duelo-2a", "reservado-2a", "novo-21"];
const rows = [
  "# Marco 2.1 — coagulação e encerramento do duelo",
  "",
  "**Suposição de design, não verificado.** Implementados coagulação por vaso/gravidade e rendição, fuga e interrupção por utilidade/estresse. [Regras completas e limites](MARCO21-REGRAS.md). Sem consulta à wiki, ajuste de quotas, linhagens ou publicação.",
  "",
  "## Lotes sem quota",
  "",
  "100 seeds em cada prefixo, sufixos `000..099`: dois lotes preservados e um novo, `novo-21`. Mesmo cenário de quatro pessoas, sete meses e até seis trocas. Nenhuma seed descartada, repetida ou substituída; os pesos não foram recalibrados a partir da distribuição. **300/300 cenários válidos.**",
  "",
  "### Desfecho clínico ao final",
  "",
  "| Desfecho | M2 atual | 2.1 atual | M2 reservado | 2.1 reservado | 2.1 novo |",
  "|---|---:|---:|---:|---:|---:|",
];
for (const outcome of [
  "sem duelo",
  "morte do desafiante",
  "morte do desafiado",
  "morte de ambos",
  "recuperação",
  "sequela permanente",
  "sem ferimento",
])
  rows.push(
    `| ${outcome} | ${r.previous[keys[0]].outcomes[outcome] || 0} | ${r.batches[keys[0]].outcomes[outcome] || 0} | ${r.previous[keys[1]].outcomes[outcome] || 0} | ${r.batches[keys[1]].outcomes[outcome] || 0} | ${r.batches[keys[2]].outcomes[outcome] || 0} |`,
  );
rows.push(
  "",
  "### Motivo de encerramento das trocas",
  "",
  "| Motivo | Atual | Reservado | Novo |",
  "|---|---:|---:|---:|",
);
for (const t of [
  "recusa",
  "rendição",
  "fuga",
  "interrupção por agressor",
  "interrupção por desafiado",
  "interrupção por terceiro",
  "morte durante o duelo",
  "incapacidade ou arma ausente",
  "limite de trocas",
])
  rows.push(
    `| ${t} | ${keys.map((k) => r.batches[k].terminations[t] || 0).join(" | ")} |`,
  );
rows.push(
  "",
  "A regra anterior tinha 8 e 20 rendições por limiar fixo de dor/risco, sem fuga nem interrupção voluntária identificada. Agora o motivo vem da maior utilidade elegível e registra autor, papel, condição de ferido, estresse, observação e causa. Um caso pode terminar as trocas por rendição e morrer depois por hemorragia: as duas tabelas não são categorias intercambiáveis.",
  "",
  "| Leitura qualitativa | Atual | Reservado | Novo |",
  "|---|---:|---:|---:|",
);
const isExit = (x) =>
  ["rendição", "fuga"].includes(x.termination) ||
  x.termination.startsWith("interrupção");
rows.push(
  `| Duelo iniciado | ${keys.map((k) => r.batches[k].started).join(" | ")} |`,
);
rows.push(
  `| Saída voluntária (inclui morte posterior) | ${keys.map((k) => r.batches[k].rows.filter(isExit).length).join(" | ")} |`,
);
rows.push(
  `| Saída voluntária sem morte posterior | ${keys.map((k) => r.batches[k].rows.filter((x) => isExit(x) && !x.outcome.includes("morte")).length).join(" | ")} |`,
);
rows.push(
  `| Recuperação/sequela, sem morte de nenhum duelista | ${keys.map((k) => (r.batches[k].outcomes["recuperação"] || 0) + (r.batches[k].outcomes["sequela permanente"] || 0)).join(" | ")} |`,
);
rows.push(
  `| Feridas que coagularam sem cuidado | ${keys.map((k) => r.batches[k].spontaneousClots).join(" | ")} |`,
);
for (const vessel of ["capillary", "vein", "artery"])
  rows.push(
    `| Coagulação sem cuidado — ${({capillary:"capilar",vein:"veia",artery:"artéria"})[vessel]} | ${keys.map((k) => r.batches[k].spontaneousByVessel[vessel]).join(" | ")} |`,
  );
rows.push(
  "",
  "A meta qualitativa foi observada nos três lotes: rendição, fuga e sobrevivência com ferimento aparecem repetidamente, sem depender de uma seed demonstrativa. Nenhuma categoria individual domina mais de 70% dos cenários. A morte entre duelos iniciados passou de 42/51 (82,4%) para 28/51 (54,9%) no atual e de 42/62 (67,7%) para 24/62 (38,7%) no reservado; no novo foi 22/55 (40,0%). Ainda há letalidade relevante, sobretudo em lesões arteriais ou vitais; não fiz nova calibração.",
  "",
  "Exemplos auditáveis: `duelo-2a-005` rende-se mas morre depois; `duelo-2a-006` interrompe e recupera; `duelo-2a-018` tem interrupção pelo agressor e sequela. São resultados livres, não fixtures. [Dados, decisões e todas as seeds](MARCO21-METRICS.json).",
  "",
  "## Verificação e mudanças de contrato",
  "",
  "**110 testes em 14 arquivos passaram (77,55 s de suíte, não tempo do motor)** e build TypeScript/Vite passou. Incluem três lotes, replay/retomada/imutabilidade, vaso leve/médio estancando com dor e incapacidade persistentes, lesão arterial grave, mesma lesão com estresse 0 versus 800 mudando continuar para render-se, ausência/bloqueio de informação do terceiro, perna ausente impedindo fuga, elegibilidade e nenhum golpe após encerramento.",
  "",
  "Os testes antigos que esperavam morte inevitável de qualquer lesão nervosa foram atualizados: a regressão de morte única agora usa uma fixture arterial explicitamente grave (18 mL/min, morte sem cuidado no minuto 115), enquanto a venosa estanca sozinha. A fixture de cuidado continua terminando com 4958 mL. Durante a implementação, TypeScript acusou valores opcionais de solidariedade/honra; o cálculo passou a usar zero quando ausentes. A revisão de conhecimento retirou leitura da dor privada do adversário e passou a registrar perigo observado; a revisão de mobilidade incluiu função nervosa da perna. Não houve falha residual na suíte final.",
  "",
  "Quatro hashes das regras congeladas do 1d continuam iguais: proteção, catálogo de personalidade, amizade e obra. [Conferência](MARCO21-FROZEN-CHECKS.json). Logs 2a são legíveis; continuação de checkpoint incompleto exige versão compatível e não migra regras silenciosamente.",
  "",
  "## Tempo e memória isolados",
  "",
  "100 agentes × 100 anos, mesma seed `benchmark-pre-m2-100x100-v1`, população e agenda. Código 2a preservado antes da edição, três processos novos por versão, aquecimento de 12 meses. Validação, digest e relatório fora dos intervalos cronometrados; nenhum teste ou outro motor simultâneo. Chromium amostrado anualmente e na cópia/exportação, mantendo snapshot, Worker receptor congelado, JSON, UTF-8 e Blob. MB = 10⁶ bytes.",
  "",
  "| Medida | M2 reexecutado | 2.1 |",
  "|---|---:|---:|",
);
const stats = (mode) => {
  const rs = n.rows.filter((x) => x.mode === mode),
    br = b.rows.find((x) => x.mode === mode);
  if (br.error || br.entitiesHash !== rs[0].entitiesHash)
    throw Error("Node/browser mismatch");
  return {
    core: med(rs.map((x) => x.coreMs)) / 1000,
    bytes: rs[0].jsonBytes / 1e6,
    rss: (med(rs.map((x) => x.exportPeakRssKiB)) * 1024) / 1e6,
    browser: br.coreMs / 1000,
    pss: (Math.max(...br.samples.map((x) => x.pssKiB)) * 1024) / 1e6,
    hwm: (Math.max(...br.samples.map((x) => x.rssHighWaterKiB)) * 1024) / 1e6,
  };
};
const old = stats("before"),
  now = stats("after");
for (const [label, key, unit] of [
  ["Motor Node, mediana", "core", "s"],
  ["JSON exportável", "bytes", "MB"],
  ["RSS Node na exportação, mediana", "rss", "MB"],
  ["Motor Chromium, uma execução", "browser", "s"],
  ["PSS máximo amostrado da árvore Chromium", "pss", "MB"],
  ["Soma conservadora de máximos RSS por processo", "hwm", "MB"],
])
  rows.push(`| ${label} | ${f(old[key])} ${unit} | ${f(now[key])} ${unit} |`);
rows.push(
  "",
  `A baseline aprovada tinha 34,54 s Node, 68,65 MB de JSON e 906 MB PSS Chromium. A reexecução preservou exatamente o hash dos eventos aprovado; cada modelo repetiu seu próprio hash nas três execuções, e Node/Chromium reproduziram o mesmo estado por modelo. O cenário comparativo tem **zero duelos espontâneos**, medindo manutenção de 100 corpos, não combate em massa.`,
  "",
  "### Comparação ativa suplementar",
  "",
  "Mesma seed e 100 agentes × 100 anos, com um duelo agendado, alterações idênticas de habilidade/personalidade/presença e cuidado desligado. Escolhas sociais habilitadas (não é a fixture numérica que as desliga). Uma execução por modelo; resultados clínicos podem mudar a carga restante, portanto a diferença não é uma medida pura de overhead.",
  "",
  "| Modelo | Node | JSON | Chromium | PSS máximo | Duelo/feridas/mortes | Escolhas sociais |",
  "|---|---:|---:|---:|---:|---|---:|",
);
for (const x of a.rows) {
  const br = ab.rows.find((v) => v.mode === x.mode);
  if (br.error || br.entitiesHash !== x.entitiesHash)
    throw Error("Active Node/browser mismatch");
  rows.push(
    `| ${x.mode} | ${f(x.coreMs / 1000)} s | ${f(x.jsonBytes / 1e6)} MB | ${f(br.coreMs / 1000)} s | ${f((Math.max(...br.samples.map((v) => v.pssKiB)) * 1024) / 1e6)} MB | ${x.duels}/${x.wounds}/${x.deaths} | ${x.types["duel.choice"] || 0} |`,
  );
}
rows.push(
  "",
  `O pico PSS amostrado do 2.1 no cenário comparativo foi ${f(now.pss / 1000, 3)} GB; com margem estimativa de 20%, ${f((now.pss * 1.2) / 1000, 3)} GB. Isso não garante teto rígido de 1 GB: amostragem pode perder transientes; soma dos máximos RSS inclui memória compartilhada e picos não simultâneos. Memória de uma interface v2 futura e combate em massa não foram medidos. A meta de ~60 s deve ser lida nos números medidos acima, sem extrapolar para outras máquinas.`,
  "",
  "Reprodução, sequencial e sem carga concorrente: `npm run report:m21`; `npm run benchmark:m21`; `node scripts/benchmark-marco21-active.mjs`; `npm run benchmark:m21:browser`; `node scripts/benchmark-marco21-browser.mjs --active`. Chromium requer Playwright e `CHRONICLE_PLAYWRIGHT_MODULE` quando não instalado no projeto. [Node](MARCO21-BENCHMARK.json), [Chromium](MARCO21-BROWSER.json), [ativo Node](MARCO21-ACTIVE-BENCHMARK.json), [ativo Chromium](MARCO21-ACTIVE-BROWSER.json).",
  "",
  "## Parada",
  "",
  "Encerrado no Marco 2.1. Sem perseguição, disputa física da interrupção, infecção ou nova calibração de proteção/amizade/obra. Rendição e interrupção são respeitadas por convenção deste duelo consentido; fuga é afastamento local, não viagem no mapa. Nenhuma linhagem, nascimento, envelhecimento ou implementação do 2b.",
);
writeFileSync("docs/MARCO21-REPORT.md", rows.join("\n") + "\n");
console.log({ old, now });
