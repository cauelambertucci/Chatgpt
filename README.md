# Chronicle World

A página inicial agora abre a interface mínima do motor v2 (Marco 2c): 40 fundadores, 100 anos, seed escolhida pelo usuário. Inteiramente no navegador, sem backend. O nome Leve identifica este recorte, não implementa os perfis propostos para o Marco 3. O atlas v1 continua no código como histórico.

## Testar pelo navegador (GitHub Codespaces)

Esta versão está no ramo **`codex/interface-v2-leve`**. Abra esse ramo no GitHub e escolha **Code → Codespaces → Create codespace on codex/interface-v2-leve**. A configuração instala as dependências e inicia o site na porta **5173**. Quando estiver pronto, abra **Ports / Portas → 5173 → Open in Browser / Abrir no navegador** caso a página não abra automaticamente.

Você não precisa instalar Node.js no computador local. Um Codespace já existente em outro ramo não recebe esta versão automaticamente. Se o servidor não iniciar, use o terminal do Codespace:

```sh
npm ci
npm run dev -- --port 5173 --strictPort
```

Na página, deixe a seed `reservado-2b-006` e clique em **Gerar história**. Para os outros exemplos, use `reservado-2b-011` ou `reservado-2b-028`. As novas biografias estão em [docs/UI-V2-FEEDBACK-BIOGRAFIAS.md](docs/UI-V2-FEEDBACK-BIOGRAFIAS.md).

## Executar

Requer Node.js 22.12+ (validado com Node 24) e npm.

```sh
npm ci
npm run dev
```

Abra o endereço indicado pelo Vite, informe a seed e clique em **Gerar história**. A barra mostra o progresso anual. Em **Pessoas**, use busca, situação, mutilação e geração; abra uma ficha, a árvore genealógica ou **Por quê?**. Em **Linha do tempo**, alterne entre fatos biográficos e todos os eventos. A geração usa o Worker v2 e as regras existentes do 2c. Os dados permanecem nesta sessão; não há persistência do Marco 3.

```sh
npm run test:ui
npm run examples:ui # apenas três seeds fixas
npm run build
npm run preview
```

O diretório `dist/` pode ser servido por qualquer hospedagem estática na raiz do domínio. Não abra `index.html` diretamente pelo protocolo `file:`: os módulos e o Worker precisam de um servidor HTTP. Não são necessárias chaves ou variáveis de ambiente.

## Explorar e preservar — atlas v1 (histórico)

- Mapa: arraste para mover; use a roda, os botões ou `+`/`-` com foco no Canvas para ampliar. Clique em assentamentos/covis ou no terreno para abrir fichas. Alterne biomas, elevação, temperatura e política.
- As abas oferecem registros de todas as entidades. Nomes relacionados são links para outras fichas. Figuras têm biografias, parentesco e posses; artefatos têm proveniência e eventos.
- Linha do tempo: filtre por ano exato, civilização, tipo ou nome de pessoa; carregue os registros em lotes de 100. Filtros de civilização incluem participantes e assentamentos atualmente pertencentes a ela.
- `/` foca a busca global e `Esc` fecha fichas. O botão da seed copia seu texto. **Mundo aleatório** usa `crypto.getRandomValues` apenas para escolher a seed; o motor nunca usa aleatoriedade externa.
- O botão de download no cabeçalho reúne exportação JSON, crônica Markdown, importação e salvar/carregar no navegador. Importações passam por validação antes de substituir o mundo atual. Limite: 50 MB. O localStorage tem uma única posição e depende da cota do navegador; para mapas grandes, use JSON. Os arquivos incluem os parâmetros e todo o estado final. Nenhum mundo é enviado a servidores.
- O botão **Cancelar** termina o Worker sem substituir o mundo anterior. Processos não bloqueiam os controles da página.

## Organização

- `src/engine/rng.ts`: hash e Mulberry32; fluxos separados para mapa, civilizações e história.
- `noise.ts`, `mapgen.ts`: ruído de valor suavizado em cinco oitavas, clima, 11 biomas, drenagem e nomes geográficos.
- `civs.ts`: culturas, panteões simples, assentamentos, recursos, territórios e ameaças.
- `history.ts`: simulação anual e consequências sobre o estado.
- `validate.ts`: integridade temporal, referências, genealogia, população, diplomacia e cadeia de posse.
- `world.ts`: entrada pura do motor; `worker.ts`: protocolo `{progress}`, `{world}` ou `{error}`.
- `narrative.ts`: biografias e textos de eventos.
- `src/data`: sílabas, características, catálogo de eventos, templates e catálogo principal de strings pt-BR.
- `src/ui`: renderização, navegação e Canvas. Nenhuma dependência do DOM no motor.
- `src/types`: formato JSON versionado.

Cada tarefa em nuvem já é isolada: use o checkout existente, sem criar worktrees. Em uma nova sessão, execute `npm ci` se as dependências não estiverem restauradas e `npm run dev` para reiniciar o servidor; processos não sobrevivem a snapshots.

## Modelagem e decisões simples

1. **Determinismo:** mesmos parâmetros e mesma versão do motor produzem JSON idêntico, inclusive a ordem dos eventos. Alterações no algoritmo podem mudar mundos futuros; arquivos exportados preservam o mundo já gerado.
2. **Geografia:** o ruído é de valor interpolado (sem biblioteca simplex/perlin). O mapa é um continente com costas. Rios descem estritamente; mínimos locais viram lagos de uma célula. Regiões são setores fixos nomeados; montanhas, bosques, rios e lagos recebem nomes adicionais. Não há erosão, navegabilidade ou simulação climática física.
3. **Culturas:** até oito povos, quatro estilos silábicos, uma religião e divindade por cultura. Cada civilização começa com três assentamentos e recursos agregados. A fronteira inicial usa proximidade e pode mudar com conquistas em batalhas/cercos. Capitais não são conquistadas nesta versão.
4. **História:** habitantes comuns são números; apenas figuras relevantes são detalhadas. Personagens fundadores podem nascer antes do ano zero. Novos adultos sem ancestrais conhecidos entram nos registros como figuras já adultas; isso é explicitado no evento. Filhos registrados têm pais adultos existentes. Casamentos são pares simétricos; morte dissolve o vínculo atual, mas a história continua preservada nos eventos. Famílias e relações são um modelo ficcional simples, sem genética ou sexo biológico.
5. **Causa e efeito:** guerras mudam relações; batalhas/cercos reduzem população e podem transferir cidades e território; pragas, fomes, desastres e ataques reduzem população; morte transmite posses e causa sucessão. Crescimento altera população; artefatos mantêm um diário de criação, roubo, perda, herança ou destruição. Eventos diretamente encadeados usam `cause`; os demais influenciam a simulação pelo estado compartilhado. Missões, cultos, cismas e descobertas são registros narrativos, sem sistemas econômicos ou religiosos independentes.
6. **Visualização:** mapa mostra estado final, não uma reconstrução de cada ano. Fichas mostram os 100 eventos mais recentes e a linha do tempo permite consultar o restante. Nomes silábicos podem se repetir; IDs sempre distinguem as entidades. A árvore familiar mostra pais, cônjuge atual e filhos, navegáveis.
7. **Idioma:** o catálogo `strings.ts` centraliza navegação e ações principais; templates e catálogos do domínio estão separados. Alguns textos descritivos da UI ainda estão em português nos componentes e precisam migrar para um catálogo ao adicionar outro idioma.

## Adicionar um evento

1. Inclua o tipo em `src/data/catalog.ts` e suas variantes verbais em `templates.ts`.
2. Em `history.ts`, escolha entidades vivas com o RNG do motor, aplique a consequência ao estado e chame `event(ano, tipo, participantes, local, consequência, causaOpcional)`.
3. Toda entidade deve existir antes de ser referenciada. Morte e abate podem participar apenas até o ano do registro. Objetos devem passar por `transfer` para manter posses e proveniência sincronizadas.
4. Adicione um teste que verifica a consequência (por exemplo, redução de população ou mudança de posse), e rode `npm test` e `npm run build`.

## Verificação

Vitest cobre reprodução do mundo completo, geografia, capitais, 100 seeds com até 1000 anos, pelo menos 15 tipos de evento, referências inválidas, personagens fora de sua vida, proveniência e round-trip JSON. Um teste mede a geração de 500 anos com cinco civilizações em 128×128 contra a meta de 10 segundos; o desempenho varia por dispositivo. Os 29 tipos disponíveis não são garantidos em toda seed, pois dependem das condições e do caos.

## Marco 1 experimental — vingança que esperou

A nova fatia está isolada em `src/engine/v2/`: 20 personagens, até 20 anos, seis ações (esperar, treinar, observar, confrontar, comunicar/pedir ajuda e perdoar), decisões por utilidade, treino mensal, memória, notícias, ajuda e resolução abstrata de confrontos. Não inclui pessoa profunda completa nem corpo. **A interface e o mapa continuam na versão 1.**

```sh
npm test -- src/engine/v2/slice.test.ts
npm run report:m1
```

O segundo comando gera `docs/MARCO1-REPORT.md`, distribuição de todos os seis desfechos em 100 seeds, três histórias do lote livre e uma fixture separada. Logs completos ficam em `reports/marco1/` (ignorados pelo Git, regeneráveis). `vite-node` é ferramenta fornecida pelo Vitest instalado via lockfile; não há dependência de runtime nova.

O Worker separado é `src/engine/v2/worker.ts`: recebe um `Scenario` e retorna mensagens `progress`, `complete` (mundo e história) ou `error`. Termine o Worker para cancelar. Checkpoints são feitos em fronteiras mensais com a fila de reações já drenada; retomar dentro de um mês não é suportado. O replay aplica fatos sem RNG. `validateWorld` exportado de `v2/validate.ts` é o validador deste formato; o validador antigo continua exclusivo de v1.

Consulte [o relatório](docs/MARCO1-REPORT.md), [as falhas e correções](docs/MARCO1-EXECUTION-NOTES.md) e [o design](docs/DESIGN.md). “Livre” significa atributos e agendas gerados pela seed dentro do cenário de parentesco/rivalidade, sem um roteiro de desfechos; não é ainda geração de civilizações. Reconciliação exige acordo bilateral; perdão unilateral é desistência. Não há filtro de seeds para esconder fracassos.

## Ajustes de acordo e Marco 1b

```sh
npm run report:m1a
npm run report:m1b
```

`report:m1a` compara os 100 cenários atuais e os 100 reservados com a medição anterior preservada em `docs/MARCO1A-BASELINE.json`; não escolhe finais por quota. O acordo agora tem intenção pendente, oferta em presença mútua e resposta do alvo. `perdoar` é sempre unilateral. O `report:m1` anterior pode ser usado para gerar o relatório da vingança com as regras atuais; números históricos anteriores à separação são preservados na baseline.

`personalScenario(seed)` habilita os dois objetivos novos: proteger alguém e construir uma amizade. Amizade exige encontro e aceitação bilateral, não só desejo do personagem. Proteção nasce de ameaça percebida, compete por utilidade e exige intervenção efetiva e sobrevivência até o horizonte para ser cumprida. Valores adicionais limitados a amizade/solidariedade, sem implementar personalidade completa.

Relatórios: [comparação de acordos](docs/MARCO1A-REPORT.md), [resultados de proteção e amizade](docs/MARCO1B-REPORT.md), [falhas e verificações](docs/MARCO1B-EXECUTION-NOTES.md). Os JSON completos e as duas fixtures novas ficam em `reports/marco1b/`, regeneráveis. O Worker também retorna `personalStories` quando o perfil é habilitado.

Profundidade é calculada depois de agrupar períodos consecutivos iguais do mesmo agente. Eventos significativos encerram um bloco; quantidade de meses, ganho e IDs brutos ficam no episódio. O log original nunca é comprimido ou descartado. Históricos completos anteriores continuam legíveis; checkpoints incompletos de regras incompatíveis não são continuados silenciosamente. UI e mapa permanecem v1, sem publicação automática.

## Proteção revisada e Marco 1c

```sh
npm run report:protection
npm run report:m1c
```

O primeiro compara o perfil 1b no mesmo lote e em `reservado-protecao-000..099` com a baseline anterior. Registra adoções, recusas, êxitos, falhas, mortes e ameaças: uma redução do denominador não fica escondida. Estimativas de sucesso são heurísticas, não probabilidades estatisticamente calibradas. As respostas possíveis são intervenção direta, aviso, apoio de aliado conhecido e afastamento consentido. Abrigo dura três meses; o retorno é um fato explícito. Aliados recebem crédito apenas quando contribuíram efetivamente.

`advancedScenario(seed)` ativa o perfil 1c: 30 facetas, 20 valores, ambição de coordenar o grupo e criação de uma obra. Os catálogos e as ligações entre cada traço/valor e as ações estão em `src/data/v2/personality.ts`; a decomposição das utilidades fica em cada decisão. O cargo é coordenação de um grupo abstrato por maioria, sem monarquia/civilização. Obras são livros simples com consumo de papel e tinta, seis períodos, criador, qualidade e tema conhecido. Não é ainda o sistema completo de artefatos.

O ranking usa episódios antes de calcular profundidade, abrange rotina alternada e monitoramento, preserva todas as causas externas e penaliza adoção/desfecho no mesmo mês sem decisão intermediária. Respostas consentidas também contam como decisões. Se faltarem casos qualificados, retorna menos de dez.

Relatórios: `docs/PROTECTION-REPORT.md`, `docs/MARCO1C-REPORT.md` e `docs/MARCO1C-EXECUTION-NOTES.md`. JSON completos e fixtures do 1c ficam em `reports/marco1c/`, regeneráveis. A UI segue v1. Não foram adicionados corpo, romance, estresse completo nem implantação.


## Marco 1d — necessidades, estresse e transformação

```sh
npm test -- src/engine/v2/emotions.test.ts
npm run report:m1d
```

`emotionalScenario(seed)` ativa `agents-slice-1d`, derivado do cenário 1c com os mesmos atributos iniciais. Acrescenta quatro necessidades (segurança, descanso, vínculo e expressão), estresse 0–1000, avaliação individual de perda/ameaça/vitória/traição/fracasso e mudanças causais de faceta/valor. Crise a partir de 650 habilita isolamento, hostilidade verbal e abandono de um posto existente; recuperação pode competir antes disso. São regras ficcionais do projeto, não um modelo clínico nem fórmulas confirmadas do Dwarf Fortress.

Necessidades e rotina são mensais. Emoções referenciam um estímulo percebido pelo próprio agente; uma perda desconhecida não gera luto. Apoio político pode criar promessa explícita de doze meses; quebrá-la diante do beneficiário gera percepção de traição. Trocar apoio sem promessa não é traição automática. O colapso causal trata a contabilidade mensal de necessidades como passagem para suas causas, evitando inflar profundidade ou introduzir ciclos entre episódios.

Na terceira ameaça pública do mesmo agressor, uma autoridade presente compara confronto, expulsão, perdão condicional e pedido de acordo. Aceitação depende do agressor; nova infração após uma consequência leva à expulsão. A ausência por expulsão persiste nas agendas. Esse limite local é uma simplificação explícita, sem prisões, tribunais ou civilizações completas.

Quem assumiu proteção, presenciou uma resolução efetiva por outra pessoa e não contribuiu encerra como `resolved_by_other` (resolvido por outro). Não recebe crédito de intervenção e não conta como falha. Contribuintes seguem os critérios anteriores. Os pesos de proteção, amizade e obra permanecem congelados; hashes documentam essa verificação.

Relatório: [Marco 1d](docs/MARCO1D-REPORT.md), [falhas e validação](docs/MARCO1D-EXECUTION-NOTES.md). A baseline 1c está em `docs/MARCO1D-BASELINE.json`; métricas resumidas em `docs/MARCO1D-METRICS.json`. O comando mede 100 seeds atuais e 100 reservadas sem quotas e gera exemplos/fixtures em `reports/marco1d/`. **Parada no 1d para revisão; Marco 2 não iniciado.**


## Preparação do Marco 2 — somente medição e propostas

O motor permanece no 1d. O ensaio isolado 100 agentes × 100 anos usou cópia descartável com apenas as guardas de horizonte/eventos ampliadas; a API nativa rejeita esse horizonte. Não foram implementadas otimizações, corpo ou demografia.

- [Benchmark, custos dominantes e otimizações propostas](docs/PRE-M2-BENCHMARK.md).
- [Design resumido do Marco 2](docs/MARCO2-DESIGN-RESUMO.md), também em [PDF de duas páginas](docs/MARCO2-DESIGN-RESUMO.pdf).
- [Proposta de linhagens e ciclo de vida no 2b](docs/MARCO2B-LINHAGENS.md).
- [Referências da wiki e pendência de acesso](docs/MARCO2-FONTES.md): proxy 403, nenhuma citação factual apresentada como verificada.

Reprodução do benchmark (processos sequenciais; não executar testes ou relatórios em paralelo):

```sh
node scripts/benchmark-pre-m2.mjs
node scripts/analyze-pre-m2-profile.mjs
node scripts/render-pre-m2-benchmark.mjs
```

Os dois últimos comandos são executados somente depois de terminar o primeiro. O script não grava modificações em `src/`; os hashes originais são conferidos ao final. Os tempos da simulação, da cópia final da API e da exportação JSON são separados. **Parada para revisão antes de implementar o Marco 2.**


## Memória do 1d — formato compacto (meta revisada)

A meta atual aceita ~60 s para 100 agentes/100 anos e prioriza ~1 GB no navegador. Foram implementados somente efeitos por deltas e linhas mensais compactas, sem índices de agentes ou cache de decisões. Veja [antes/depois e limites da estimativa](docs/MEMORY-REPORT.md), [formato e API](docs/MEMORY-FORMAT.md) e [falhas corrigidas](docs/MEMORY-EXECUTION-NOTES.md).

Use `new SliceSimulation(scenario).runCompact()` para o formato 3. O Worker experimental do 1d entrega esse formato por padrão; `output: 'legacy'` pede o antigo. `run()`, `simulateSlice()` e `expandCompact()` retornam o log completo para compatibilidade e podem voltar a consumir muita memória. Validação/replay compactos e retomada são suportados, com testes de equivalência; não materialize todo o formato antigo na UI para aproveitar os ganhos.

```sh
node scripts/benchmark-memory.mjs
# Somente depois de terminar o Node; requer Playwright/Chromium de diagnóstico:
CHRONICLE_PLAYWRIGHT_MODULE=/caminho/para/playwright/index.mjs node scripts/benchmark-browser-memory.mjs
node scripts/render-memory-report.mjs
```

Os ensaios continuam usando cópias com guardas de horizonte/eventos ampliadas; o limite nativo do cenário não mudou. A versão anterior à compactação está preservada em `docs/reference-baselines/pre-memory-1d-source.json.gz`, usada para comparação de cada evento expandido e da projeção final. Não executar testes/relatórios em paralelo às medições.

Pesquisa posterior: [20 fontes da wiki ainda bloqueadas](docs/MARCO2-FONTES.md) e [exemplo numérico de golpe, apenas proposto](docs/MARCO2-EXEMPLO-GOLPE.md). **Corpo continua não implementado. Nenhuma publicação automática.**

### Marco 2 mínimo — motor experimental

Duelo humanoide, tecidos, arma/armadura, ferimentos, cuidado, sequelas e morte única integram o motor v2 e a transformação emocional do 1d. A interface/mapa v1 ainda não expõe essa fatia. As regras corporais são **suposição de design, não verificado**; a pesquisa da wiki foi dispensada.

- [Relatório, distribuição e histórias](docs/MARCO2-REPORT.md)
- [Modelo e loop](docs/MARCO2-DESIGN-RESUMO.md)
- `npm run report:m2`: 100 seeds livres + 100 reservadas e fixtures separadas.
- `npm run benchmark:m2`: seis medições Node isoladas, 100 agentes × 100 anos; depois `npm run benchmark:m2:browser` (diagnóstico requer Chromium/Playwright).
- `npm test -- --maxWorkers=2` e `npm run build` verificam o projeto.

Os benchmarks devem rodar sozinhos. Não avançado para linhagens/Marco 2b; nenhuma publicação faz parte desta entrega.

### Marco 2.1 — revisão atual do motor experimental

Coagulação por vaso/gravidade e rendição, fuga ou interrupção por utilidade/estresse. [Relatório](docs/MARCO21-REPORT.md) e [regras assumidas](docs/MARCO21-REGRAS.md). `npm run report:m21` reavalia os dois lotes anteriores e um novo lote de 100 seeds. `npm run benchmark:m21` e `npm run benchmark:m21:browser` fazem a comparação isolada com o Marco 2 mínimo. A interface v1 continua separada; não há publicação nem avanço para o 2b.

## Motor experimental — Marco 2b

O motor v2 agora inclui parentesco, gestação agendada, corpos por idade, herança auditável, morte natural e guarda. A interface acima continua usando o atlas v1. Consulte o [relatório com 200 seeds e três linhagens reais](docs/MARCO2B-REPORT.md) e as [regras e limitações](docs/MARCO2B-MODELO.md).

```sh
npm run report:m2b
npm run benchmark:m2b
# Diagnóstico separado: requer Playwright e Chromium instalados.
npm run benchmark:m2b:browser
```

Rode os benchmarks isolados, depois dos relatórios/testes. O diagnóstico de navegador aceita `CHRONICLE_PLAYWRIGHT_MODULE` para indicar o módulo instalado. Não há publicação ou integração do v2 na interface nesta etapa.

## Motor experimental — Marco 2c (etapa atual)

Diagnóstico demográfico e comparação pareada de uma política de fertilidade individual em 12, 40 e 100 fundadores. A política é explícita (`lifeSimulation.fertilityPolicy: "replacement-2c"`); cenários 2b preservam suas regras. [Relatório](docs/MARCO2C-REPORT.md), [protocolo](docs/MARCO2C-PLANO.md), [metodologia e limites](docs/MARCO2C-METODO.md). As seções anteriores registram entregas históricas.

```sh
npm run diagnose:m2c
npm run ablate:m2c
npm run report:m2c
node scripts/summarize-marco2c.mjs
node scripts/render-marco2c-report.mjs
# Medições separadas, sem outros relatórios/testes em execução:
npm run benchmark:m2c
npm run benchmark:m2c:family
npm run benchmark:m2c:browser -- --lifecycle
npm run benchmark:m2c:browser -- --active --lifecycle
```

A avaliação completa executa 1.050 mundos e pode demorar horas. `npm run report:m2c -- --resume` reaproveita resultados locais completos; use somente com código e protocolo equivalentes aos resultados gravados. O caminho de exportação `exportCompactGzip` preserva o JSON integral após descompressão. Para limitar memória, o Worker produtor 2c encerra depois de entregar seu resultado. A interface v1 permanece separada. Parada no 2c para revisão, antes do Marco 3.

## Proposta do Marco 3 — para revisão

[Design em duas páginas](docs/MARCO3-DESIGN-RESUMO.md) · [PDF](docs/MARCO3-DESIGN-RESUMO.pdf). Inclui perfis de execução, estimativas identificadas como extrapolação, recomendação por dispositivo, recuperação, validação e alternativa local. Somente documentação; Marco 3 não implementado.

## Interface mínima v2 — entrega atual

[Relatório e limites](docs/UI-V2-REPORT.md) · [três biografias reais](docs/UI-V2-BIOGRAFIAS.md) · [validação de três seeds](docs/UI-V2-VALIDATION.json). A interface não altera o motor nem implementa o Marco 3. Os textos narram apenas campos conhecidos; causas são consultadas por ID, sem inferência de motivos.

## Revisão da interface após feedback

[Correções e validação](docs/UI-V2-FEEDBACK-REPORT.md) · [três novas biografias](docs/UI-V2-FEEDBACK-BIOGRAFIAS.md). Filiação, anos de vida e parcerias vêm do log; pais e guarda estão separados. A árvore alterna ascendência/descendência/irmãos e parceiros. A explicação causal tem rótulos em português e contexto de rotina recolhido. O comando `examples:ui` usa somente as três seeds selecionadas e reaproveita os mundos locais já gravados; exclua `reports/ui-feedback/*.world.json` apenas se quiser repetir a simulação.

## Marco 2d-1 — entrega atual

A interface Leve agora usa `dailyScenario`: 40 fundadores, 100 anos, objetivos pessoais ligados e ofícios Criador/Cuidador. [Relatório, benchmark e limites](docs/MARCO2D1-REPORT.md) · [três biografias reais](docs/MARCO2D1-BIOGRAFIAS.md). Seeds: `reservado-2b-006`, `reservado-2b-011`, `reservado-2b-028`. `npm run test:2d1` roda testes pequenos; `npm run report:2d1` gera só esses três mundos. O 2d-2 não foi implementado.

### Revisão da narração após o 2d-1

[Diagnóstico emocional em 10 seeds](docs/SATURACAO-2D1-REPORT.md) · [Três biografias reescritas](docs/BIOGRAFIAS-2D1-REESCRITAS.md). Motor inalterado; propostas de ajuste ainda não aplicadas.
