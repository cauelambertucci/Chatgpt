import { readFileSync, writeFileSync } from "node:fs";
const m = JSON.parse(readFileSync("docs/MEMORY-BENCHMARK.json", "utf8")),
  b = JSON.parse(readFileSync("docs/MEMORY-BROWSER.json", "utf8"));
const rows = (mode) => m.rows.filter((r) => r.mode === mode),
  med = (mode, key) =>
    rows(mode)
      .map((r) => r[key])
      .sort((a, b) => a - b)[1];
const n = (v, d = 2) => v.toFixed(d).replace(".", ","),
  s = (v) => n(v / 1000) + " s",
  mb = (v) => n(v / 1e6, 1) + " MB",
  mib = (v) => n(v / 1024, 1) + " MiB";
const old = b.rows.find((r) => r.mode === "before"),
  now = b.rows.find((r) => r.mode === "after");
const peak = (r, key) => Math.max(...r.samples.map((x) => x[key] || 0));
const reduction =
  100 * (1 - med("after", "jsonBytes") / med("before", "jsonBytes"));
const lines = [
  "# Memória do 1d — antes/depois, mesma seed",
  "",
  "**Escopo concluído:** efeitos por deltas e rotina mensal em linhas compactas imutáveis. Nenhum índice de agentes, cache de decisões ou corpo implementado. Meta atual: até ~60 s para 100 agentes/100 anos, priorizando ~1 GB no navegador e exportação menor. A meta antiga de 10 s foi substituída.",
  "",
  "## Resultado principal",
  "",
  "| Medida | Antes | Depois |",
  "|---|---:|---:|",
  `| Núcleo Node, mediana de três rodadas aquecidas | ${s(med("before", "coreMs"))} | ${s(med("after", "coreMs"))} |`,
  `| Núcleo + entrega do snapshot pela API | ${s(med("before", "apiTotalMs"))} | ${s(med("after", "apiTotalMs"))} |`,
  `| Codificar JSON depois, mediana separada | ${s(med("before", "jsonEncodeMs"))} | ${s(med("after", "jsonEncodeMs"))} |`,
  `| JSON bruto do mundo exportável | ${mb(med("before", "jsonBytes"))} | **${mb(med("after", "jsonBytes"))}** |`,
  `| RSS Node no núcleo, mediana dos máximos por processo | ${mib(med("before", "corePeakRssKiB"))} | ${mib(med("after", "corePeakRssKiB"))} |`,
  `| RSS Node incluindo JSON de exportação retido | ${mib(med("before", "exportPeakRssKiB"))} | ${mib(med("after", "exportPeakRssKiB"))} |`,
  `| Núcleo no Chromium, diagnóstico separado | ${s(old.coreMs)} | ${s(now.coreMs)} |`,
  `| Maior PSS amostrado de todo o Chromium, incluindo receptor/exportação | ${mb(peak(old, "pssKiB") * 1024)} | **${mb(peak(now, "pssKiB") * 1024)}** |`,
  "",
  `Redução do JSON: **${n(reduction, 1)}%**, sem gzip/Brotli. A simulação ficou mais lenta (${s(med("before", "coreMs"))}→${s(med("after", "coreMs"))}), mas dentro dos ~60 s aceitos. O ganho foi em memória/exportação, não em velocidade do núcleo. Medianas de fases separadas não são uma soma estatística garantida.`,
  "",
  "## Memória no navegador: medida e estimativa",
  "",
  `Chromium ${now.version}, headless, mesmo ambiente, limite V8 de 4 GiB por isolate. Diagnóstico separado, sem testes/validador/relatório concorrente. A simulação cede entre anos para amostrar memória; esse tempo de instrumentação não entra na soma do núcleo. O produtor fica vivo; há **um Worker receptor real**, não só structuredClone no mesmo contexto. Mantêm-se simultaneamente snapshot, payload recebido/congelado, string JSON, bytes UTF-8 e Blob. O diagnóstico não usa a UI/mapa real do produto.`,
  "",
  "| Fase | PSS antes | PSS depois |",
  "|---|---:|---:|",
];
for (const stage of [
  "month-1200",
  "snapshot",
  "receiver-clone-and-freeze",
  "JSON-and-UTF8-held",
]) {
  const a = old.samples.find((x) => x.stage === stage),
    c = now.samples.find((x) => x.stage === stage);
  lines.push(`| ${stage} | ${mib(a.pssKiB)} | ${mib(c.pssKiB)} |`);
}
lines.push(
  "",
  `O maior PSS amostrado depois é **${mb(peak(now, "pssKiB") * 1024)} (${mib(peak(now, "pssKiB"))})**. Isso é uma medida do conjunto de processos do Chromium, não RSS do Node nem apenas heap da página. O heap medido pelo CDP na página não inclui o isolate receptor; por isso não foi usado sozinho para afirmar consumo total.`,
  "",
  `**Estimativa para planejamento:** aplicar 20% de margem ao maior PSS amostrado dá aproximadamente **${n((peak(now, "pssKiB") * 1024 * 1.2) / 1e9, 2)} GB**. É uma heurística explícita, não medição de pico contínuo ou da futura UI. O observado está abaixo de ~1 GB; com margem, fica próximo e ligeiramente acima. **Não afirmo um teto absoluto de 1 GB com folga.** A interface real, o dispositivo do usuário e corpos futuros ainda precisam de medição.`,
  "",
  `Como limite conservador adicional, a soma dos máximos RSS por processo chegou a ${mib(peak(now, "rssHighWaterKiB"))} depois (${mib(peak(old, "rssHighWaterKiB"))} antes). Essa soma duplica páginas compartilhadas e soma máximos que podem ocorrer em momentos diferentes; não é um pico físico simultâneo nem deve substituir o PSS. A amostragem anual/final pode perder transitórios entre amostras.`,
  "",
  "## Mesma simulação, armazenamento diferente",
  "",
  "Cenário idêntico à baseline: `benchmark-pre-m2-100x100-v1`, 100 agentes detalhados em um lugar, 1.200 meses, cinco grupos de origem interagindo juntos, mesmos estoques e agendas. Hash do cenário: `" +
    m.rows[0].scenarioHash +
    "`. Os 100 continuam vivos; não há nascimento, envelhecimento funcional ou corpo. Houve 21 ameaças; este não é um ensaio de guerra ou pior caso.",
  "",
  "A API nativa mantém o horizonte de 240 meses e teto de 100.000 eventos. Como no ensaio anterior, cópias temporárias de **ambos** os motores ampliam apenas essas guardas para 1.200 meses/1.000.000 eventos. O jogo não ganhou suporte demográfico a 100 anos por esta alteração.",
  "",
  `Os dois formatos conservam **${m.rows[0].events} eventos lógicos e ${m.rows[0].decisions} decisões**. Todos os eventos completos expandidos, incluindo efeitos, fatores, alternativas, evidências e causas, produziram o mesmo SHA-256 canônico: ${m.rows[0].eventHash}. A projeção final também tem hash igual em todas as seis rodadas. A canonicalização ordena chaves de objetos; não remove valores, efeitos ou causas.`,
  "",
  "O hash é calculado **fora** de todas as fases cronometradas e amostras de memória do Node. Não é uma comparação somente de contagens. Os dados das seis rodadas estão em [MEMORY-BENCHMARK.json](MEMORY-BENCHMARK.json). A baseline de três processos isolados foi medida nesta revisão e reutilizada após rejeitar representações intermediárias; não foi trocada por mínimo ou por uma seed mais fácil. Não há p95 com três repetições.",
  "",
  "### O que mudou",
  "",
  "- Efeitos de substituição guardam caminhos alterados e remoções, em vez de uma pessoa inteira a cada atualização. Replay aplica esses deltas em ordem, sem RNG.",
  "- Cada mês continua presente. Linhas numéricas derivam ID/calendário/localização e os campos constantes de rotina; textos e nomes de campos usam dicionários de representação. Cada linha é uma string imutável, evitando reter milhões de pequenas arrays no heap.",
  "- Histórico é lido por campos: consultar um ID não materializa candidatos e fatores de uma decisão. Não há reutilização de utilidade entre meses ou agentes.",
  "- Snapshots compactos compartilham apenas linhas já imutáveis e copiam/congelam contêineres/projeção. Continuar a simulação não altera snapshots anteriores. Transporte entre contextos continua tendo custo, medido separadamente.",
  "- O formato antigo permanece para compatibilidade; retorná-lo explicitamente evita compactar e expandir de novo. **Usar `runCompact()` ou a saída compacta padrão do Worker 1d para obter os ganhos**; `run()`, `simulateSlice()` e `expandCompact()` podem materializar o log grande.",
  "",
  "## Verificação e falhas",
  "",
  "- Suíte final: **88 testes em 12 arquivos**, 0 falhas/ignorados, sem erro interno; 66,94 s. Build TypeScript/Vite passou.",
  "- Replay, checkpoint antigo/compacto, imutabilidade, remoções, causas futuras adulteradas e equivalência de ranking são cobertos. Pesos de proteção, catálogo de personalidade, amizade e obra: **4/4 hashes preservados**.",
  "- As primeiras tentativas não foram escondidas: arrays aninhadas pioraram memória; strings com leitura ansiosa passaram de 60 s; houve falhas de checkpoint, falsa divergência por ordem de chaves e timeouts. Correções e medições descartadas estão em [MEMORY-EXECUTION-NOTES.md](MEMORY-EXECUTION-NOTES.md).",
  "",
  "## Reprodução",
  "",
  "```sh",
  "npm test -- --maxWorkers=2",
  "npm run build",
  "# Depois de terminarem os testes/build:",
  "node scripts/benchmark-memory.mjs",
  "# Depois de terminar o benchmark Node:",
  "CHRONICLE_PLAYWRIGHT_MODULE=/caminho/para/playwright/index.mjs node scripts/benchmark-browser-memory.mjs",
  "node scripts/render-memory-report.mjs",
  "```",
  "",
  "O script do navegador requer Playwright e Chromium (`CHRONICLE_CHROMIUM`, padrão `/usr/bin/chromium`), como ferramentas de diagnóstico, não dependências do site. A medição desta revisão usou `--reuse-before` com a baseline já medida no mesmo ambiente; executar sem essa opção refaz as seis rodadas. Não executar testes, outro motor ou geração de relatório em paralelo às medições. [Formato/API](MEMORY-FORMAT.md), [dados do navegador](MEMORY-BROWSER.json) e [hashes congelados](MEMORY-FROZEN-CHECKS.json).",
  "",
  "## Wiki e exemplo numérico, após as medições",
  "",
  "As 20 páginas pertinentes da wiki foram tentadas diretamente: **zero páginas recebidas**, todas com `403 Forbidden` do proxy antes do HTML. A bibliografia continua **pendente**, não apresentada como consulta concluída. [Registro](MEMORY-WIKI-ACCESS.json) e [fontes planejadas](MARCO2-FONTES.md).",
  "",
  "O [exemplo numérico do golpe](MARCO2-EXEMPLO-GOLPE.md) mostra contato/defesa, consumo de 100 U por camadas, ferida sem amputação automática, sangue/cuidado, sequela, transformação do 1d e contraprova de kill list. Seus coeficientes corporais são propostas de jogo; a parte emocional usa a fórmula já existente. **Não é saída de corpo implementado nem fórmula atribuída à wiki.**",
  "",
  "**Parada:** memória/log otimizados; nenhum corpo, índice de agentes, cache de decisões, push ou publicação. A pesquisa da wiki permanece tecnicamente bloqueada.",
  "",
);
writeFileSync("docs/MEMORY-REPORT.md", lines.join("\n"));
