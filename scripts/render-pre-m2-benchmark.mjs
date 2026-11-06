import { readFileSync, writeFileSync } from "node:fs";
const m = JSON.parse(readFileSync("docs/PRE-M2-BENCHMARK.json", "utf8")),
  p = JSON.parse(readFileSync("docs/PRE-M2-CPU-PROFILE.json", "utf8"));
const warm = m.rows.filter((r) => r.label.startsWith("warm-")),
  median = (k) => warm.map((r) => r[k]).sort((a, b) => a - b)[1];
const sec = (n) => (n / 1000).toFixed(2).replace(".", ","),
  mb = (n) => (n / 1e6).toFixed(1).replace(".", ",");
const r = warm[0];
const lines = [
  "# Antes do Marco 2 — benchmark isolado do motor",
  "",
  "**Conclusão:** o custo principal é copiar e congelar estado/eventos completos. Nenhuma otimização ou mecânica do Marco 2 foi implementada. Fontes do motor conferidas por SHA-256 antes/depois: **intactas**.",
  "",
  "## O que foi medido — e o limite real",
  "",
  "O motor 1d sem modificações **rejeitou** 100 anos: `Horizon must be 1–240 months`. O teto de eventos também é 100.000. Assim, não se afirma que a versão atual suporta este ensaio por sua API normal. Usou-se uma cópia descartável com duas guardas ampliadas: horizonte 240→1.200 meses e eventos 100.000→1.000.000. Nenhuma fórmula, ação, evento, clonagem ou regra de decisão foi alterada. O ensaio usou 246.840 eventos, ultrapassando o teto original.",
  "",
  "`agents-slice-1d`, **100 agentes detalhados iniciais, 1.200 meses, um lugar compartilhado**. Cinco coortes de 20 geradas pelo cenário 1d com seeds derivadas; IDs e referências remapeados para 000–099, agendas estendidas até o mês 1.199. Atributos, parentesco/rivalidades iniciais e períodos de visita são preservados por coorte. Papel/tinta escalados de 30/60 para 150/300, mantendo a oferta por pessoa. Todos interagem no mesmo grupo; não são cinco simulações isoladas.",
  "",
  "Seed fixa: `" +
    r.seed +
    "`. Hash do cenário: `" +
    r.scenarioHash +
    "`. Mesma entrada nas repetições; mesma quantidade de eventos, bytes e decisões. Isso não equivale a validação semântica ou prova de igualdade byte a byte dos logs.",
  "",
  "**Limite demográfico:** todos os 100 terminaram vivos, 95 presentes; ainda não há nascimento, envelhecimento funcional ou morte natural. As idades dos fundadores ultrapassam 100 anos neste teste. Há só 21 ameaças e nenhuma morte: o ensaio é predominantemente de rotina/socialização, não de combate, demografia ou pior caso. Corpos e linhagens terão de ser medidos novamente.",
  "",
  "## Método",
  "",
  "- Node " +
    m.node +
    ", Linux " +
    m.release +
    ", " +
    m.cpu +
    ". Host expõe " +
    m.logicalCpus +
    " CPUs lógicas e " +
    mb(m.totalMemoryBytes) +
    " MB de RAM; cgroup autoriza 4 CPUs e 32 GiB. Heap máximo do Node: 8 GiB. Não representa o PC da faculdade nem o limite mínimo de navegador.",
  "- Bundle esbuild não minificado, com nomes preservados para diagnóstico; wrappers gerados também entram no tempo (cerca de 1,5% inclusivo no perfil). Não é bundle de produção do navegador; compilação, carregamento de módulos e criação do cenário fora do cronômetro. Processo novo por rodada. Uma execução sem aquecimento do motor e três com aquecimento de 12 meses, descartado, seguido de GC antes da medição. GC normal durante o motor faz parte do custo.",
  "- Sem Vitest, `validateSlice`, replay ou construção de relatório concorrente. Checks internos do próprio `emit` permanecem, porque fazem parte do motor. Nenhuma chamada ao getter de mundo durante a simulação.",
  "- Núcleo = construtor + `advance(1200)`. Cópia final = retorno JSON-clonado de `run()` sobre mundo já completo; a chamada adicional de avanço é vazia. Exportação = outro `JSON.stringify`, medida depois, separadamente. I/O de resultados e contagem de eventos só depois dos trechos cronometrados.",
  "- Uma rodada adicional com CPU profiler, separada e excluída das estatísticas principais; amostragem de 1 ms. Um processo de motor por vez, sem outra simulação/validação/relatório em paralelo. Sem afinidade exclusiva de CPU: continua sendo ambiente de nuvem compartilhado.",
  "- Três repetições aquecidas da **mesma seed** são amostra pequena: apresentar mediana e faixa, sem p95 ou inferência sobre todas as seeds.",
  "",
  "## Tempos observados",
  "",
  "| Rodada | Núcleo | Cópia final da API | API total | Exportar JSON depois |",
  "|---|---:|---:|---:|---:|",
];
for (const row of m.rows.filter((r) => !r.profiled))
  lines.push(
    `| ${row.label} | ${sec(row.coreMs)} s | ${sec(row.snapshotMs)} s | ${sec(row.apiTotalMs)} s | ${sec(row.jsonEncodeMs)} s |`,
  );
lines.push(
  `| **Mediana aquecida** | **${sec(median("coreMs"))} s** | **${sec(median("snapshotMs"))} s** | **${sec(median("apiTotalMs"))} s** | **${sec(median("jsonEncodeMs"))} s** |`,
  "",
  "Núcleo aquecido: " +
    sec(Math.min(...warm.map((r) => r.coreMs))) +
    "–" +
    sec(Math.max(...warm.map((r) => r.coreMs))) +
    " s. API aquecida: " +
    sec(Math.min(...warm.map((r) => r.apiTotalMs))) +
    "–" +
    sec(Math.max(...warm.map((r) => r.apiTotalMs))) +
    " s. A mediana da exportação é uma mediana separada, não soma estatística garantida de medianas. Uma rodada típica ficou em cerca de 22 s para simular, obter a cópia e codificar o JSON, sem escrever o arquivo grande.",
  "",
  "O JSON ocupa **" +
    r.jsonBytes.toLocaleString("en-US") +
    " bytes (" +
    mb(r.jsonBytes) +
    " MB; " +
    (r.jsonBytes / 2 ** 20).toFixed(1) +
    " MiB)**. RSS máximo observado nas rodadas aquecidas, antes da cópia final: " +
    (Math.max(...warm.map((r) => r.corePeakRssKiB)) / 1024).toFixed(1) +
    " MiB; incluindo a cópia: " +
    (Math.max(...warm.map((r) => r.snapshotPeakRssKiB)) / 1024).toFixed(1) +
    " MiB. RSS é memória do processo, não apenas heap; pico do sistema operacional inclui inicialização/aquecimento anteriores. Heap no fim não é pico. Esses valores não incluem eventual pico adicional ao codificar o JSON de exportação.",
  "",
  "Há **" +
    r.events.toLocaleString("en-US") +
    " eventos**, " +
    r.eventsPerYear.toFixed(1) +
    " eventos/ano e " +
    r.decisions.toLocaleString("en-US") +
    " decisões. `needs.period` (" +
    r.eventTypes["needs.period"] +
    ") e `activity.period` (" +
    r.eventTypes["activity.period"] +
    ") são **" +
    (
      (100 * (r.eventTypes["needs.period"] + r.eventTypes["activity.period"])) /
      r.events
    ).toFixed(1) +
    "% dos eventos**, não necessariamente essa fração do tempo. O colapso narrativo do 1d não reduz o log bruto armazenado. A meta antiga de 300 anos em 10 s não foi demonstrada; não extrapolar linearmente este teste para 300 anos ou para navegador.",
  "",
  "## O que domina o custo",
  "",
  "Amostras da thread principal do V8, ponderadas por intervalo do profiler; categorias abaixo são disjuntas. Frames anônimos de clonagem foram identificados pela linha exata `JSON.parse(JSON.stringify(x))` no bundle, não classificados genericamente como “cópia” por serem anônimos.",
  "",
  "| Caminho | Fração do perfil do núcleo |",
  "|---|---:|",
);
const labels = {
  "JSON copies": "Cópias JSON de estado/payloads/efeitos",
  freeze: "Congelamento recursivo",
  "campaign excluding copies":
    "Campanha/seleção de eleitores, excluindo cópias",
  "other decisions excluding copies": "Outras decisões, excluindo cópias",
  GC: "Coleta de lixo",
  "other entity scans": "Outras varreduras de entidades",
  other: "Demais custos",
};
for (const c of p.disjointCategories)
  lines.push(
    `| ${labels[c.name]} | ${c.percent.toFixed(1).replace(".", ",")}% |`,
  );
lines.push(
  "",
  "`emit` responde por cerca de 53,8% **inclusivos**, `needsPeriod` por 50,3% e `candidates` por 17,0%; esses valores se sobrepõem e **não devem ser somados**. A clonagem aparece em `changed`, na construção do evento e ao aplicar efeitos; congelamento percorre os objetos copiados. A cópia final de 4,56 s é custo adicional da API, fora deste perfil do núcleo. GC é custo observado, sem atribuir toda coleta especificamente à clonagem.",
  "",
  "## Otimizações propostas, ainda não implementadas",
  "",
  "1. **Efeitos compactos e cópia por componente alterado.** Manter eventos imutáveis e replay, mas evitar reserializar a pessoa inteira em cada atualização de necessidade. Separar dados estáveis de personalidade, relações, procedência e estado transitório; usar deltas tipados e compartilhamento seguro. Preservar normalização JSON, IDs, conhecimento e `lastBy`. Congelar apenas estruturas novas quando isso for comprovadamente seguro; não remover imutabilidade para ganhar tempo.",
  "2. **Separar avanço, consulta e exportação.** O avanço já existe sem snapshot; propor uma API de leitura/snapshot apropriada e exportação em fluxo, evitando uma string intermediária de centenas de MB e a cópia integral em cada entrega. No navegador, medir também a transferência Worker→UI, que este teste Node não mede.",
  "3. **Representação compacta da rotina mensal.** Necessidades e atividade são 90% dos registros. Avaliar deltas/batches e episódios com períodos reconstruíveis. Não saltar decisões ou mudanças mensais, nem perder o mês que causou uma intervenção. O erro de ciclos no colapso do 1d mostra por que compactação precisa preservar dependências e interrupções; a melhoria não pode ser apenas esconder eventos no relatório.",
  "4. **Índices e invalidação por eventos.** Priorizar busca de contatos de campanha/cooldowns e listas de vivos/presentes/objetivos ativos; depois avaliar cache dos fatores de personalidade enquanto facetas/valores não mudarem. Preservar ordem estável, escolha por utilidade e evidências. Hash/RNG e varreduras genéricas não são o maior custo observado; não começar por eles.",
  "",
  "Cada otimização exige medição antes/depois e comparação de decisões, projeções e causalidade. Mudança de formato exige versão explícita e equivalência semântica, não igualdade literal de eventos cujo esquema mudou. Não prometer ganho ou meta antes de medir. **Nenhuma dessas quatro propostas foi implementada.**",
  "",
  "## Reprodução e evidência",
  "",
  "```sh",
  "node scripts/benchmark-pre-m2.mjs",
  "node scripts/analyze-pre-m2-profile.mjs",
  "node scripts/render-pre-m2-benchmark.mjs",
  "```",
  "",
  "O primeiro comando cria o ensaio e repete processos sequencialmente; os demais só depois que ele termina. Resumos persistidos: [benchmark](PRE-M2-BENCHMARK.json), [perfil](PRE-M2-CPU-PROFILE.json). Cenário, fontes e guardas estão registrados; perfil bruto e resultados por rodada em `reports/benchmark-pre-m2/`, ignorados pelo Git e regeneráveis. A análise de frames usa o bundle temporário criado pela primeira etapa; se ele for removido, repetir a primeira etapa. Não foi rodada validação depois para transformar este benchmark em prova de correção do cenário estendido.",
  "",
  "Próximas propostas para revisão: [design do Marco 2](MARCO2-DESIGN-RESUMO.md), [linhagens no 2b](MARCO2B-LINHAGENS.md), [bibliografia pendente](MARCO2-FONTES.md). **Parada antes de otimizar ou implementar o Marco 2.**",
  "",
);
writeFileSync("docs/PRE-M2-BENCHMARK.md", lines.join("\n"));
