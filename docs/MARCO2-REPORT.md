# Marco 2 mínimo — relatório da fatia

> Baseline histórica aprovada. A revisão atual está no [Marco 2.1](MARCO21-REPORT.md); `benchmark:m21` reexecuta esta baseline a partir do código 2a preservado.

**Suposição de design, não verificado.** Pesquisa da wiki encerrada por instrução do usuário; não é condição de aprovação. Implementados humanoide, duelo, tecidos, arma/armadura, ferimentos, sangramento, cuidado, sequela, morte única e ponte emocional. Esta é uma fatia experimental do motor v2; a interface v1 não foi integrada a ela.

## Distribuição sem quota

Lotes fixados como `duelo-2a-000..099` e `reservado-2a-000..099`: quatro personagens (dois duelistas, cuidador e parente), sete meses, até seis trocas. A personalidade, capacidade, contato e disponibilidade de cuidado variam pela seed. Consentimento/eligibilidade podem impedir o duelo. Não descartamos, repetimos nem substituímos seeds para preencher desfechos; 200/200 passaram na validação.

| Desfecho | Atual (100) | Reservado (100) |
|---|---:|---:|
| Sem duelo | 49 | 38 |
| Morte do desafiante | 18 | 17 |
| Morte do desafiado | 21 | 18 |
| Morte de ambos | 3 | 7 |
| Recuperação | 3 | 3 |
| Sequela permanente | 6 | 17 |

São 51 e 62 duelos iniciados. Nenhuma categoria individual supera 70% dos cenários, mas **ao menos uma morte ocorre em 42/51 (82,4%) dos duelos iniciados no atual e 42/62 (67,7%) no reservado**. A regra simplificada de lesão nervosa sem coagulação espontânea e a destruição de estruturas vitais contribuem para a letalidade. Não houve calibração posterior para forçar uma distribuição. Uma revisão futura deve testar coagulação por vaso/gravidade e interrupção por incapacidade separadamente, com novo lote reservado; não foi implementada agora.

## Três histórias reais do lote livre

Escolhidas depois da geração por categorias distintas, sem alterar seeds. Seleção de exemplos não é quota de resultados nem ranking de riqueza narrativa. Todas as decisões de duelo começam no mês zero; são cenas curtas, não histórias longas premiadas por profundidade. Profundidade abaixo usa o grafo com rotina repetitiva colapsada e não mede qualidade literária.

1. **Iria e Zarek — `duelo-2a-000`.** Iria desafia Zarek. Ambos aceitam (`event:7`). Zarek atinge o antebraço esquerdo de Iria com 140 U, atravessa o osso e amputa a conexão (`event:13–14`). Iria percebe a perda e adapta o objetivo à mão que continua funcional (`event:15–18`). No minuto 3, outro contato alcança o coração (`event:22–24`); a morte é atribuída uma única vez a Zarek (`event:26`, `event:32`). Profundidade causal colapsada: 23.
2. **Alda e Corin — `duelo-2a-004`.** Alda atinge a perna e o antebraço de Corin em três contatos. A malha consome 50 dos 77 U de cada contato junto à roupa; o restante para no músculo, sem atingir nervo/osso (`event:11`, `event:23`, `event:36`). Corin percebe as lesões e reavalia o objetivo. Cuidado com habilidade 82 é aceito e controla o sangramento no minuto 15 (`event:49`, `event:52`). As feridas fecham no prazo de dois meses, sem sequela. Profundidade: 31.
3. **Neris e Doran — `duelo-2a-012`.** Dois contatos de Neris atingem o antebraço esquerdo de Doran. A malha reduz o orçamento de 102 U, mas ainda há energia de jogo suficiente para lesar o nervo (`event:11–12`, `event:23–25`). Doran percebe preensão 0,4 e adapta o objetivo para usar a mão funcional (`event:13–16`). O cuidador controla o sangramento (`event:37`) e cinco períodos mensais de reabilitação elevam a preensão a 0,7 no sexto mês. O reconhecimento da sequela provoca luto irado em Doran: rancor 87→90 e vingança 69→72 na primeira percepção (`event:102–106`); o parente reage com luto solidário e compaixão 7→9 (`event:107–109`). Doran continua no objetivo adaptado. Profundidade: 29.

Os dados com IDs, participantes, transformações e causas estão em [MARCO2-METRICS.json](MARCO2-METRICS.json). Logs compactos completos são reproduzidos por `npm run report:m2` em `reports/marco2/`; não são histórias escritas à mão ou fixtures renomeadas.

## Fixture numérica, separada das histórias

`fixture-golpe-numerico`: contato controlado 100→95→80→72→42→30→0 U, antebraço esquerdo, nervo lesado, sem fratura/amputação. Com cuidado: sangue 5000→4970→4958 mL; reabilitação mensal permite preensão residual 0,7. Sem cuidado: 2990 mL no minuto 335, uma morte e uma única atribuição. Retirar a armadura sob o mesmo contato faz o orçamento no osso cruzar o limiar de fratura. [Cálculo e ressalvas](MARCO2-EXEMPLO-GOLPE.md).

## Contratos verificados

A suíte completa inicial passou: 104 testes em 13 arquivos. Após a última correção na aplicação da decisão de adaptação, os 17 testes corporais passaram novamente, incluindo a nova regressão e as 200 cenas. Incluem sem arma, mão/conexão ausente, cuidado versus ausência de cuidado/material, notícia bloqueada, mesma sequela com personalidades diferentes, conservação do orçamento, morte única, morte externa não atribuída ao duelo, reação anterior à morte hemorrágica, replay/imutabilidade/retomada e efeitos de sangramento como patches. Build TypeScript/Vite passou. [Falhas e correções](MARCO2-EXECUTION-NOTES.md); [quatro regras congeladas preservadas](MARCO2-FROZEN-CHECKS.json).

O corpo não copia a pessoa; anatomia intacta é um catálogo compartilhado. Sangramento modifica somente reservas/feridas via deltas. Reabilitação é mensal; eventos são conservados no log e colapsados no relatório antes da profundidade. Sem índices de agentes ou caches de decisões novos.

## Tempo, memória e tamanho do log

Mesma seed `benchmark-pre-m2-100x100-v1`, mesma população inicial e agenda: 100 agentes, 1200 meses. Três processos Node novos por versão, aquecimento de 12 meses, mediana. Motor e snapshot/exportação medidos separadamente; validação, digest e relatórios fora dos intervalos, sem outro motor concorrente. Limites de horizonte/eventos ampliados somente nas cópias de benchmark, sem alterar os limites de produção. As três baselines desta sessão foram preservadas após a última correção e comparadas com três execuções novas da versão final.

| Medida | 1d reexecutado | Marco 2 mínimo |
|---|---:|---:|
| Motor Node (mediana) | 34,26 s | 34,54 s |
| JSON exportável | 65,47 MB | 68,65 MB |
| Eventos | 246840 | 246941 |
| Pico RSS Node na exportação (mediana) | 681,95 MB | 699,69 MB |
| Motor Chromium (uma execução) | 28,53 s | 29,15 s |
| Máximo PSS amostrado, árvore Chromium | 901,91 MB | 906,20 MB |
| Soma conservadora dos máximos RSS dos processos | 1365,39 MB | 1384,69 MB |

MB = 10⁶ bytes. O log cresceu 4,86% com corpo; continua muito menor que os ~434 MB do formato antigo. A baseline compacta aprovada anteriormente tinha 31,03 s e os mesmos 65.467.593 bytes. Nesta sessão, o hash completo dos eventos da baseline reproduziu exatamente o anterior; cada modelo repetiu seu próprio hash nas três execuções, e estado final Chromium/Node conferiu.

**Limite da comparação:** nesta seed não surgiu nenhum duelo: são 100 corpos, zero feridas e zero mortes. Ela mede o custo de manter os corpos no cenário existente, não uma guerra nem acúmulo maciço de ferimentos. Não extrapolar esses números para esse caso.

**Diagnóstico suplementar ativo:** mesma seed e horizonte, com um duelo numérico explicitamente controlado (ajustes de habilidade, presença e cuidado; não faz parte dos lotes livres). Uma execução Node: 34,16 s, 68,37 MB JSON, 1 duelo, 1 ferida(s), 0 morte(s). Chromium: 29,12 s, máximo PSS 863,24 MB. Exercita cuidado e evolução dentro dos 100 anos; também não é teste de combate em massa.

**Estimativa no navegador:** o diagnóstico mantém snapshot, cópia real em Worker congelada, string JSON, bytes UTF-8 e Blob; amostra a árvore Chromium a cada ano e fase. Pico PSS observado do Marco 2: 0,906 GB; com margem estimativa de 20%: 1,087 GB. O alvo de ~60 s foi atendido neste ambiente. A amostragem não garante teto rígido de 1 GB; a soma dos máximos RSS inclui páginas compartilhadas e picos não simultâneos e não deve ser apresentada como consumo efetivo. Hardware/navegador diferentes e múltiplos ferimentos podem mudar o pico. O cenário não inclui custo de uma futura interface v2.

Reprodução: `npm run benchmark:m2`, `node scripts/benchmark-marco2-active.mjs`, `npm run benchmark:m2:browser` e `node scripts/benchmark-marco2-browser.mjs --active` em sequência, sem testes/relatórios concorrentes. O diagnóstico Chromium requer Playwright e Chromium; configure `CHRONICLE_PLAYWRIGHT_MODULE` e, se preciso, `CHRONICLE_CHROMIUM`. [Node](MARCO2-BENCHMARK.json), [Chromium](MARCO2-BROWSER.json), [duelo ativo Node](MARCO2-ACTIVE-BENCHMARK.json), [duelo ativo Chromium](MARCO2-ACTIVE-BROWSER.json).


## Limites e parada

Uma lâmina cortante, um arquétipo humanoide e regras clínicas simplificadas. Sem infecção, desgaste da armadura, regeneração sanguínea, mobilidade detalhada ou demografia; o cenário de 100 anos mede custo computacional, não realismo de longevidade. A proteção anterior continua abstrata antes de um eventual duelo. Os exemplos não demonstram ainda uma sociedade com linhagens.

Família, nascimento, envelhecimento e morte natural continuam no Marco 2b proposto, antes das civilizações. Nenhuma implementação do 2b ou publicação realizada. [Modelo e loop](MARCO2-DESIGN-RESUMO.md).
