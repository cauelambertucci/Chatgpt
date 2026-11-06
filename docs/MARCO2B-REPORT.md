# Marco 2b — entrega mínima e avaliação

Implementado no motor experimental v2; UI/mapa continuam v1. Parada ao final desta etapa, sem civilizações ou publicação. Regras: [modelo e limites](MARCO2B-MODELO.md). Todas as escolhas demográficas são **suposição de design, não verificado**; a pesquisa da wiki está dispensada.

## Escopo entregue

Parentesco biológico separado de guarda, parceria e domicílio; concepção/gestação/nascimento/perda agendados; corpo e capacidades por idade; desenvolvimento vivido sem infância inventada; genótipo separado de experiência e RNG; envelhecimento e morte natural sem kill credit; reações familiares pelo 1d; decisões de guarda e genealogia auditável. Efeitos continuam como deltas imutáveis, com replay e checkpoint.

## Geração livre, sem quota

Cada lote contém 100 seeds, 12 fundadores e 100 anos. Prefixos: `linhagem-2b-000..099` e `reservado-2b-000..099`. Um duelo é agendado por cenário com participantes, mês e resultado livres; sem forçar sobrevivência, sequela ou filhos. Nenhum override de fixture entra nesses lotes. Objetivos pessoais/avançados estão desligados nesses cenários familiares mínimos; o benchmark de 100 fundadores mantém os objetivos da baseline original.

| Medida | Livre | Reservado |
|---|---:|---:|
| Fundadores | 1200 | 1200 |
| Nascimentos vivos | 354 | 334 |
| Mortes totais | 1447 | 1452 |
| Mortes naturais | 1427 | 1436 |
| Vivos ao final | 107 | 82 |
| Concepções | 381 | 376 |
| Perdas gestacionais | 27 | 42 |
| Gestações pendentes no fim | 0 | 0 |
| Decisões de guarda de órfão | 0 | 0 |
| Seeds com ≥3 gerações | 34/100 | 34/100 |
| Seeds com linhagem ligada a sequela de duelo | 5/100 | 3/100 |
| Seeds sem sobreviventes ao final | 62/100 | 66/100 |

Balanços fechados: **1200 + 354 − 1447 = 107** e **1200 + 334 − 1452 = 82**. Auditoria integral: **0/200 inválidos**. Perdas gestacionais não entram como mortes populacionais.

| Maior geração alcançada por seed | Livre | Reservado |
|---|---:|---:|
| 1 | 22 | 28 |
| 2 | 44 | 38 |
| 3 | 27 | 30 |
| 4 | 7 | 4 |

**Limitação observada:** a população cai fortemente: 62% e 66% dos cenários terminam extintos. O modelo demonstra linhagens, mas não uma demografia sustentável. Preferências reprodutivas, poucos fundadores e valores iniciais dos filhos contribuem; não houve experimento de ablação que permita atribuir uma causa única. Não ajustei fertilidade ou selecionei seeds para corrigir essa distribuição.

**Guarda:** nenhum órfão apareceu nos 200 cenários livres. A decisão de guarda foi demonstrada nas fixtures de morte antecipada, não estimada como frequência natural. O campo `unassigned` conta decisões sem aceitação, não crianças distintas. Picos populacionais nos dados são amostras anuais, não máximos instantâneos.

Dados por seed e cronologias: [MARCO2B-METRICS.json](MARCO2B-METRICS.json). Os logs completos das histórias são regeneráveis em `reports/marco2b/`, diretório ignorado pelo Git.

## Três histórias reais encontradas

Seleção posterior à geração: primeira candidata com ancestral lesionado e descendente de terceira geração, mais duas candidatas distintas. Isto seleciona histórias para leitura; não altera os resultados dos lotes. Não são fixtures. Meses abaixo são contados desde o início da simulação, a partir de zero.

### linhagem-2b-031

Elian e Doran tiveram Thorin 3 no mês 45; Tala e Bram tiveram Neris 3 no mesmo mês. No mês 172, Elian sofreu amputação no antebraço esquerdo em duelo. O cuidado permitiu sobrevivência e a sequela foi confirmada no mês 178. Thorin, então com 11 anos, percebeu a perda: sua cautela passou de 67 para 70 e o valor de paz de 3 para 6 (`event:4834`, causado pela emoção `event:4833`). Thorin e Neris mais tarde tiveram Mael 26, no mês 321. Mael permanece vivo no fim. O ramo mostrado tem três gerações; o cenário inteiro alcançou quatro.

| Pessoa | Geração | Pais biológicos | Nascimento (mês) |
|---|---:|---|---:|
| Elian | 1 | Desconhecidos — fundador | -228 |
| Tala | 1 | Desconhecidos — fundador | -300 |
| Doran | 1 | Desconhecidos — fundador | -324 |
| Bram | 1 | Desconhecidos — fundador | -228 |
| Thorin 3 | 2 | Elian + Doran | 45 |
| Neris 3 | 2 | Tala + Bram | 45 |
| Mael 26 | 3 | Thorin 3 + Neris 3 | 321 |

Meses negativos são apenas idades iniciais dos fundadores, sem acontecimentos ou ancestrais criados retroativamente.

### linhagem-2b-007

Bram e Vela tiveram Mira 1; Alda e Neris tiveram Syl 1, ambos no mês 21. Mira e Syl tiveram Luma 26 no mês 321. A morte natural de Bram no mês 458 foi seguida por luto em Mira: rancor 58→61 e valor de vingança 0→3 (`event:11435`). Isso é transformação emocional, sem inventar um assassino ou objetivo de vingança contra a morte natural. Luma está viva no encerramento.

| Pessoa | Geração | Pais biológicos | Nascimento (mês) |
|---|---:|---|---:|
| Neris | 1 | Desconhecidos — fundador | -372 |
| Bram | 1 | Desconhecidos — fundador | -420 |
| Alda | 1 | Desconhecidos — fundador | -384 |
| Vela | 1 | Desconhecidos — fundador | -216 |
| Mira 1 | 2 | Bram + Vela | 21 |
| Syl 1 | 2 | Alda + Neris | 21 |
| Luma 26 | 3 | Mira 1 + Syl 1 | 321 |

Meses negativos são apenas idades iniciais dos fundadores, sem acontecimentos ou ancestrais criados retroativamente.

### linhagem-2b-009

Vela e Orin tiveram Mael 0; Neris e Iven tiveram Corin 0, ambos no mês 9. Mael e Corin tiveram Doran 19 no mês 237. Após a morte natural de Vela no mês 526, Mael apresentou luto irado: rancor 68→71 e valor de vingança 0→3 (`event:15456`). Doran sobrevive ao horizonte. As mudanças vieram de notícias simuladas, não de memórias herdadas.

| Pessoa | Geração | Pais biológicos | Nascimento (mês) |
|---|---:|---|---:|
| Vela | 1 | Desconhecidos — fundador | -324 |
| Iven | 1 | Desconhecidos — fundador | -216 |
| Orin | 1 | Desconhecidos — fundador | -288 |
| Neris | 1 | Desconhecidos — fundador | -216 |
| Mael 0 | 2 | Vela + Orin | 9 |
| Corin 0 | 2 | Neris + Iven | 9 |
| Doran 19 | 3 | Mael 0 + Corin 0 | 237 |

Meses negativos são apenas idades iniciais dos fundadores, sem acontecimentos ou ancestrais criados retroativamente.

## Herança auditada e fixtures separadas

Exemplo real, linhagem-2b-031, event:248: rancor tem parâmetros parentais 71 e 47, segregação -8, genótipo resultante 51, RNG de desenvolvimento -6, experiência inicial 0 e fenótipo 45. Cada faceta guarda esses componentes; aprendizado posterior não reescreve os genes.

As fixtures controlam concepção/perda, papéis reprodutivos, prazo de morte ou contato do golpe apenas para verificar contratos: nascimento nove meses após concepção; bloquear concepção remove aquela descendência; perda não cria pessoa; morte da gestante encerra gestação; morte dos responsáveis produz guarda sem reescrever pais; guarda termina aos 18; sequela gera notícia/emoção familiar; bloquear notícia impede conhecimento; genealogia sem ciclos; filho não copia os pais; replay e retomada de checkpoint preservam resultado.

117 testes em 15 arquivos passaram, incluindo sete testes demográficos e regressões anteriores. Build TypeScript/Vite passou. Falhas encontradas e corrigidas estão em [notas de execução](MARCO2B-EXECUTION-NOTES.md): contrato de desenvolvimento infantil no validador, treino que alterava a fixture do golpe, tipagem, guarda na maioridade e encerramento de gestação na morte. Nenhuma falha conhecida foi omitida.

## Tempo, memória e log

Mesma seed `benchmark-pre-m2-100x100-v1`, mesmos 100 fundadores e 1200 meses da baseline 2.1, três processos independentes por versão, aquecimento de 12 meses e GC antes do cronômetro. Cronometrado apenas construtor + avanço; validação, hashing, exportação e relatórios fora do trecho medido. Não houve outro teste/relatório concorrente. Baseline de sessão reaproveitada após a otimização; dados brutos preservados.

A primeira implementação demorou cerca de 102 s. O perfil apontou reconstrução/ordenação da lista de pessoas dentro do laço de cada notícia conhecida (68,5 s de CPU própria). Agora a lista transitória de ouvintes é criada uma vez por avaliação; não há índice persistente nem cache de decisões. A leitura de um evento que não era usado foi removida. Ordem de candidatos, decisões e causalidade foram preservadas.

| Medida | 2.1 baseline | 2b inicial | 2b final |
|---|---:|---:|---:|
| Motor, mediana (s) | 32,39 | 101,75 | 29,48 |
| Pico RSS motor, maior repetição (MB) | 558,39 | 487,14 | 492,21 |
| Pico RSS até exportação (MB) | 700,14 | 578,06 | 583,36 |
| JSON exportável (MB) | 68,65 | 45,16 | 45,16 |
| Eventos | 246941 | 134250 | 134250 |

Equivalência antes/depois da otimização: **hash de todos os eventos e estado final idênticos nas três repetições**. Hash de eventos: `3958fa6c28b2ac18889c1842f1319677bf08d1a8cb1af6ea4d3965abd84190bc`. JSON permanece com exatamente 45160087 bytes. A queda de log em relação ao 2.1 também reflete envelhecimento/mortes e atividade adulta variável; não é apenas compressão.

O benchmark 2b teve 42 nascimentos, 124 mortes (124 naturais), 3 perdas gestacionais e 18 sobreviventes. Pico anual amostrado: 128. **São 100 fundadores, não 100 adultos ativos constantes**: crianças/idosos têm calendário e reações, mas IA estratégica mensal só roda de 18 a 59 anos. O cenário de benchmark não contém duelo espontâneo; corpo lesionado foi exercitado nos 200 cenários e testes, sem alegar orçamento para batalhas em massa.

### Navegador real

Chromium separado, amostragem anual, árvore inteira de processos por PSS. Inclui snapshot, transferência real a Worker, payload congelado, JSON, UTF-8 e Blob retidos. O cronômetro do motor exclui esperas de amostragem/exportação.

| Medida | 2.1 | 2b final |
|---|---:|---:|
| Motor (s) | 28,48 | 26,54 |
| Pico PSS observado (MB) | 874,14 | 781,14 |
| PSS + margem de 20% (MB) | 1048,97 | 937,37 |
| Soma de picos RSS dos processos (MB) | 1363,26 | 1197,41 |

PSS mede páginas compartilhadas proporcionalmente; a soma de picos RSS é conservadora, soma momentos diferentes e duplica páginas compartilhadas. A margem de 20% é estimativa, não medição nem garantia para todo navegador. O alvo de ~1 GB deve ser avaliado com essas duas leituras; logs retidos de múltiplos mundos e integração futura da UI não foram medidos. O estado final no Chromium coincide com o hash do Node.

Dados: [Node](MARCO2B-BENCHMARK.json), [primeira implementação](MARCO2B-BENCHMARK-INITIAL.json), [perfil](MARCO2B-PROFILE.json), [Chromium](MARCO2B-BROWSER.json), [Chromium inicial](MARCO2B-BROWSER-INITIAL.json), [pesos preservados](MARCO2B-FROZEN-CHECKS.json), [reprodução integral das três histórias e duas seeds reservadas após otimização](MARCO2B-OPTIMIZATION-CHECKS.json).

## Reprodução

Execute `npm test`, `npm run build`, `npm run report:m2b`, `npm run benchmark:m2b` e `npm run benchmark:m2b:browser`, sequencialmente. O último requer Playwright/Chromium. `node scripts/render-marco2b-report.mjs` reúne os artefatos em Markdown, preservando as medidas iniciais desta entrega para comparação.

## Limites e parada

Sem mortalidade infantil livre/doenças, moradia econômica, viagens, reprodução assistida ou IA estratégica completa de idosos. A presença é um local social abstrato; notícia de morte não modela deslocamento geográfico. Nenhuma garantia de população sustentável. Fundadores não recebem ancestrais, e não há civilizações ou sucessão política implementadas. **Encerrado no Marco 2b para revisão.**
