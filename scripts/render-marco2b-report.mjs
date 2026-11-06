import { readFileSync, writeFileSync } from "node:fs";
const read = (name) => JSON.parse(readFileSync(`docs/${name}.json`, "utf8"));
const m = read("MARCO2B-METRICS"),
  b = read("MARCO2B-BENCHMARK"),
  initial = read("MARCO2B-BENCHMARK-INITIAL"),
  browser = read("MARCO2B-BROWSER");
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const fmt = (n) => n.toFixed(2).replace(".", ",");
const sum = (r, k) => r.reduce((s, x) => s + x[k], 0);
let text = `# Marco 2b — entrega mínima e avaliação\n\nImplementado no motor experimental v2; UI/mapa continuam v1. Parada ao final desta etapa, sem civilizações ou publicação. Regras: [modelo e limites](MARCO2B-MODELO.md). Todas as escolhas demográficas são **suposição de design, não verificado**; a pesquisa da wiki está dispensada.\n\n## Escopo entregue\n\nParentesco biológico separado de guarda, parceria e domicílio; concepção/gestação/nascimento/perda agendados; corpo e capacidades por idade; desenvolvimento vivido sem infância inventada; genótipo separado de experiência e RNG; envelhecimento e morte natural sem kill credit; reações familiares pelo 1d; decisões de guarda e genealogia auditável. Efeitos continuam como deltas imutáveis, com replay e checkpoint.\n\n## Geração livre, sem quota\n\nCada lote contém 100 seeds, 12 fundadores e 100 anos. Prefixos: \`linhagem-2b-000..099\` e \`reservado-2b-000..099\`. Um duelo é agendado por cenário com participantes, mês e resultado livres; sem forçar sobrevivência, sequela ou filhos. Nenhum override de fixture entra nesses lotes. Objetivos pessoais/avançados estão desligados nesses cenários familiares mínimos; o benchmark de 100 fundadores mantém os objetivos da baseline original.\n\n| Medida | Livre | Reservado |\n|---|---:|---:|\n`;
const free = m.rows.filter((r) => r.seed.startsWith("linhagem")),
  reserved = m.rows.filter((r) => r.seed.startsWith("reservado"));
for (const [label, key] of [
  ["Fundadores", "initial"],
  ["Nascimentos vivos", "births"],
  ["Mortes totais", "deaths"],
  ["Mortes naturais", "naturalDeaths"],
  ["Vivos ao final", "living"],
  ["Concepções", "pregnancies"],
  ["Perdas gestacionais", "losses"],
  ["Gestações pendentes no fim", "pending"],
  ["Decisões de guarda de órfão", "orphanDecisions"],
])
  text += `| ${label} | ${sum(free, key)} | ${sum(reserved, key)} |\n`;
for (const [label, pred] of [
  ["Seeds com ≥3 gerações", (r) => r.maxGeneration >= 3],
  ["Seeds com linhagem ligada a sequela de duelo", (r) => r.duelSequelaLineage],
  ["Seeds sem sobreviventes ao final", (r) => r.living === 0],
])
  text += `| ${label} | ${free.filter(pred).length}/100 | ${reserved.filter(pred).length}/100 |\n`;
text += `\nBalanços fechados: **1200 + 354 − 1447 = 107** e **1200 + 334 − 1452 = 82**. Auditoria integral: **${m.invalid}/200 inválidos**. Perdas gestacionais não entram como mortes populacionais.\n\n| Maior geração alcançada por seed | Livre | Reservado |\n|---|---:|---:|\n`;
for (let g = 1; g <= 4; g++)
  text += `| ${g} | ${free.filter((r) => r.maxGeneration === g).length} | ${reserved.filter((r) => r.maxGeneration === g).length} |\n`;
text += `\n**Limitação observada:** a população cai fortemente: 62% e 66% dos cenários terminam extintos. O modelo demonstra linhagens, mas não uma demografia sustentável. Preferências reprodutivas, poucos fundadores e valores iniciais dos filhos contribuem; não houve experimento de ablação que permita atribuir uma causa única. Não ajustei fertilidade ou selecionei seeds para corrigir essa distribuição.\n\n**Guarda:** nenhum órfão apareceu nos 200 cenários livres. A decisão de guarda foi demonstrada nas fixtures de morte antecipada, não estimada como frequência natural. O campo \`unassigned\` conta decisões sem aceitação, não crianças distintas. Picos populacionais nos dados são amostras anuais, não máximos instantâneos.\n\nDados por seed e cronologias: [MARCO2B-METRICS.json](MARCO2B-METRICS.json). Os logs completos das histórias são regeneráveis em \`reports/marco2b/\`, diretório ignorado pelo Git.\n\n## Três histórias reais encontradas\n\nSeleção posterior à geração: primeira candidata com ancestral lesionado e descendente de terceira geração, mais duas candidatas distintas. Isto seleciona histórias para leitura; não altera os resultados dos lotes. Não são fixtures. Meses abaixo são contados desde o início da simulação, a partir de zero.\n`;
const descriptions = {
  "linhagem-2b-031":
    "Elian e Doran tiveram Thorin 3 no mês 45; Tala e Bram tiveram Neris 3 no mesmo mês. No mês 172, Elian sofreu amputação no antebraço esquerdo em duelo. O cuidado permitiu sobrevivência e a sequela foi confirmada no mês 178. Thorin, então com 11 anos, percebeu a perda: sua cautela passou de 67 para 70 e o valor de paz de 3 para 6 (`event:4834`, causado pela emoção `event:4833`). Thorin e Neris mais tarde tiveram Mael 26, no mês 321. Mael permanece vivo no fim. O ramo mostrado tem três gerações; o cenário inteiro alcançou quatro.",
  "linhagem-2b-007":
    "Bram e Vela tiveram Mira 1; Alda e Neris tiveram Syl 1, ambos no mês 21. Mira e Syl tiveram Luma 26 no mês 321. A morte natural de Bram no mês 458 foi seguida por luto em Mira: rancor 58→61 e valor de vingança 0→3 (`event:11435`). Isso é transformação emocional, sem inventar um assassino ou objetivo de vingança contra a morte natural. Luma está viva no encerramento.",
  "linhagem-2b-009":
    "Vela e Orin tiveram Mael 0; Neris e Iven tiveram Corin 0, ambos no mês 9. Mael e Corin tiveram Doran 19 no mês 237. Após a morte natural de Vela no mês 526, Mael apresentou luto irado: rancor 68→71 e valor de vingança 0→3 (`event:15456`). Doran sobrevive ao horizonte. As mudanças vieram de notícias simuladas, não de memórias herdadas.",
};
for (const s of m.stories) {
  const names = Object.fromEntries(s.genealogy.map((p) => [p.id, p.name]));
  text += `\n### ${s.seed}\n\n${descriptions[s.seed]}\n\n| Pessoa | Geração | Pais biológicos | Nascimento (mês) |\n|---|---:|---|---:|\n`;
  for (const p of s.genealogy)
    text += `| ${p.name} | ${p.generation} | ${p.parents.map((id) => names[id] || id).join(" + ") || "Desconhecidos — fundador"} | ${p.birthMonth} |\n`;
  text +=
    "\nMeses negativos são apenas idades iniciais dos fundadores, sem acontecimentos ou ancestrais criados retroativamente.\n";
}
const birth = m.stories[0].timeline.find((e) => e.type === "person.born");
const h = birth.data.inheritance.rancor;
text += `\n## Herança auditada e fixtures separadas\n\nExemplo real, ${m.stories[0].seed}, ${birth.id}: rancor tem parâmetros parentais ${h.maternal} e ${h.paternal}, segregação ${h.segregation}, genótipo resultante ${h.genetic}, RNG de desenvolvimento ${h.developmentRng}, experiência inicial ${h.experience} e fenótipo ${h.phenotype}. Cada faceta guarda esses componentes; aprendizado posterior não reescreve os genes.\n\nAs fixtures controlam concepção/perda, papéis reprodutivos, prazo de morte ou contato do golpe apenas para verificar contratos: nascimento nove meses após concepção; bloquear concepção remove aquela descendência; perda não cria pessoa; morte da gestante encerra gestação; morte dos responsáveis produz guarda sem reescrever pais; guarda termina aos 18; sequela gera notícia/emoção familiar; bloquear notícia impede conhecimento; genealogia sem ciclos; filho não copia os pais; replay e retomada de checkpoint preservam resultado.\n\n117 testes em 15 arquivos passaram, incluindo sete testes demográficos e regressões anteriores. Build TypeScript/Vite passou. Falhas encontradas e corrigidas estão em [notas de execução](MARCO2B-EXECUTION-NOTES.md): contrato de desenvolvimento infantil no validador, treino que alterava a fixture do golpe, tipagem, guarda na maioridade e encerramento de gestação na morte. Nenhuma falha conhecida foi omitida.\n\n## Tempo, memória e log\n\nMesma seed \`benchmark-pre-m2-100x100-v1\`, mesmos 100 fundadores e 1200 meses da baseline 2.1, três processos independentes por versão, aquecimento de 12 meses e GC antes do cronômetro. Cronometrado apenas construtor + avanço; validação, hashing, exportação e relatórios fora do trecho medido. Não houve outro teste/relatório concorrente. Baseline de sessão reaproveitada após a otimização; dados brutos preservados.\n\nA primeira implementação demorou cerca de 102 s. O perfil apontou reconstrução/ordenação da lista de pessoas dentro do laço de cada notícia conhecida (68,5 s de CPU própria). Agora a lista transitória de ouvintes é criada uma vez por avaliação; não há índice persistente nem cache de decisões. A leitura de um evento que não era usado foi removida. Ordem de candidatos, decisões e causalidade foram preservadas.\n\n| Medida | 2.1 baseline | 2b inicial | 2b final |\n|---|---:|---:|---:|\n`;
const sets = [
  b.rows.filter((r) => r.mode === "before"),
  initial.rows.filter((r) => r.mode === "after"),
  b.rows.filter((r) => r.mode === "after"),
];
for (const [label, fn] of [
  ["Motor, mediana (s)", (r) => median(r.map((x) => x.coreMs)) / 1000],
  [
    "Pico RSS motor, maior repetição (MB)",
    (r) => (Math.max(...r.map((x) => x.corePeakRssKiB)) * 1024) / 1e6,
  ],
  [
    "Pico RSS até exportação (MB)",
    (r) => (Math.max(...r.map((x) => x.exportPeakRssKiB)) * 1024) / 1e6,
  ],
  ["JSON exportável (MB)", (r) => r[0].jsonBytes / 1e6],
  ["Eventos", (r) => r[0].events],
])
  text += `| ${label} | ${sets.map((r) => (label === "Eventos" ? String(fn(r)) : fmt(fn(r)))).join(" | ")} |\n`;
const after = sets[2][0],
  same = sets[2].every(
    (r) =>
      r.eventHash === sets[1][0].eventHash &&
      r.entitiesHash === sets[1][0].entitiesHash,
  );
text += `\nEquivalência antes/depois da otimização: **${same ? "hash de todos os eventos e estado final idênticos nas três repetições" : "FALHOU"}**. Hash de eventos: \`${after.eventHash}\`. JSON permanece com exatamente ${after.jsonBytes} bytes. A queda de log em relação ao 2.1 também reflete envelhecimento/mortes e atividade adulta variável; não é apenas compressão.\n\nO benchmark 2b teve ${after.births} nascimentos, ${after.deaths} mortes (${after.naturalDeaths} naturais), ${after.pregnancyLosses} perdas gestacionais e ${100 + after.births - after.deaths} sobreviventes. Pico anual amostrado: ${after.peakPopulation}. **São 100 fundadores, não 100 adultos ativos constantes**: crianças/idosos têm calendário e reações, mas IA estratégica mensal só roda de 18 a 59 anos. O cenário de benchmark não contém duelo espontâneo; corpo lesionado foi exercitado nos 200 cenários e testes, sem alegar orçamento para batalhas em massa.\n\n### Navegador real\n\nChromium separado, amostragem anual, árvore inteira de processos por PSS. Inclui snapshot, transferência real a Worker, payload congelado, JSON, UTF-8 e Blob retidos. O cronômetro do motor exclui esperas de amostragem/exportação.\n\n| Medida | 2.1 | 2b final |\n|---|---:|---:|\n`;
const br = ["before", "after"].map((mode) =>
  browser.rows.find((r) => r.mode === mode),
);
for (const [label, fn] of [
  ["Motor (s)", (r) => r.coreMs / 1000],
  [
    "Pico PSS observado (MB)",
    (r) => (Math.max(...r.samples.map((x) => x.pssKiB)) * 1024) / 1e6,
  ],
  [
    "PSS + margem de 20% (MB)",
    (r) => ((Math.max(...r.samples.map((x) => x.pssKiB)) * 1024) / 1e6) * 1.2,
  ],
  [
    "Soma de picos RSS dos processos (MB)",
    (r) => (Math.max(...r.samples.map((x) => x.rssHighWaterKiB)) * 1024) / 1e6,
  ],
])
  text += `| ${label} | ${br.map((r) => fmt(fn(r))).join(" | ")} |\n`;
text += `\nPSS mede páginas compartilhadas proporcionalmente; a soma de picos RSS é conservadora, soma momentos diferentes e duplica páginas compartilhadas. A margem de 20% é estimativa, não medição nem garantia para todo navegador. O alvo de ~1 GB deve ser avaliado com essas duas leituras; logs retidos de múltiplos mundos e integração futura da UI não foram medidos. O estado final no Chromium coincide com o hash do Node.\n\nDados: [Node](MARCO2B-BENCHMARK.json), [primeira implementação](MARCO2B-BENCHMARK-INITIAL.json), [perfil](MARCO2B-PROFILE.json), [Chromium](MARCO2B-BROWSER.json), [Chromium inicial](MARCO2B-BROWSER-INITIAL.json), [pesos preservados](MARCO2B-FROZEN-CHECKS.json), [reprodução integral das três histórias e duas seeds reservadas após otimização](MARCO2B-OPTIMIZATION-CHECKS.json).\n\n## Reprodução\n\nExecute \`npm test\`, \`npm run build\`, \`npm run report:m2b\`, \`npm run benchmark:m2b\` e \`npm run benchmark:m2b:browser\`, sequencialmente. O último requer Playwright/Chromium. \`node scripts/render-marco2b-report.mjs\` reúne os artefatos em Markdown, preservando as medidas iniciais desta entrega para comparação.\n\n## Limites e parada\n\nSem mortalidade infantil livre/doenças, moradia econômica, viagens, reprodução assistida ou IA estratégica completa de idosos. A presença é um local social abstrato; notícia de morte não modela deslocamento geográfico. Nenhuma garantia de população sustentável. Fundadores não recebem ancestrais, e não há civilizações ou sucessão política implementadas. **Encerrado no Marco 2b para revisão.**\n`;
if (!same) throw Error("Optimization changed semantics");
writeFileSync("docs/MARCO2B-REPORT.md", text);
console.log("docs/MARCO2B-REPORT.md");
