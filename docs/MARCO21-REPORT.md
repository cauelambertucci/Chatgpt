# Marco 2.1 — coagulação e encerramento do duelo

**Suposição de design, não verificado.** Implementados coagulação por vaso/gravidade e rendição, fuga e interrupção por utilidade/estresse. [Regras completas e limites](MARCO21-REGRAS.md). Sem consulta à wiki, ajuste de quotas, linhagens ou publicação.

## Lotes sem quota

100 seeds em cada prefixo, sufixos `000..099`: dois lotes preservados e um novo, `novo-21`. Mesmo cenário de quatro pessoas, sete meses e até seis trocas. Nenhuma seed descartada, repetida ou substituída; os pesos não foram recalibrados a partir da distribuição. **300/300 cenários válidos.**

### Desfecho clínico ao final

| Desfecho | M2 atual | 2.1 atual | M2 reservado | 2.1 reservado | 2.1 novo |
|---|---:|---:|---:|---:|---:|
| sem duelo | 49 | 49 | 38 | 38 | 45 |
| morte do desafiante | 18 | 9 | 17 | 9 | 8 |
| morte do desafiado | 21 | 19 | 18 | 14 | 13 |
| morte de ambos | 3 | 0 | 7 | 1 | 1 |
| recuperação | 3 | 5 | 3 | 3 | 3 |
| sequela permanente | 6 | 17 | 17 | 32 | 28 |
| sem ferimento | 0 | 1 | 0 | 3 | 2 |

### Motivo de encerramento das trocas

| Motivo | Atual | Reservado | Novo |
|---|---:|---:|---:|
| recusa | 49 | 38 | 45 |
| rendição | 8 | 7 | 8 |
| fuga | 6 | 10 | 10 |
| interrupção por agressor | 2 | 4 | 0 |
| interrupção por desafiado | 3 | 6 | 2 |
| interrupção por terceiro | 14 | 23 | 18 |
| morte durante o duelo | 14 | 5 | 11 |
| incapacidade ou arma ausente | 2 | 7 | 6 |
| limite de trocas | 2 | 0 | 0 |

A regra anterior tinha 8 e 20 rendições por limiar fixo de dor/risco, sem fuga nem interrupção voluntária identificada. Agora o motivo vem da maior utilidade elegível e registra autor, papel, condição de ferido, estresse, observação e causa. Um caso pode terminar as trocas por rendição e morrer depois por hemorragia: as duas tabelas não são categorias intercambiáveis.

| Leitura qualitativa | Atual | Reservado | Novo |
|---|---:|---:|---:|
| Duelo iniciado | 51 | 62 | 55 |
| Saída voluntária (inclui morte posterior) | 33 | 50 | 38 |
| Saída voluntária sem morte posterior | 20 | 33 | 28 |
| Recuperação/sequela, sem morte de nenhum duelista | 22 | 35 | 31 |
| Feridas que coagularam sem cuidado | 19 | 26 | 29 |
| Coagulação sem cuidado — capilar | 7 | 8 | 4 |
| Coagulação sem cuidado — veia | 12 | 18 | 25 |
| Coagulação sem cuidado — artéria | 0 | 0 | 0 |

A meta qualitativa foi observada nos três lotes: rendição, fuga e sobrevivência com ferimento aparecem repetidamente, sem depender de uma seed demonstrativa. Nenhuma categoria individual domina mais de 70% dos cenários. A morte entre duelos iniciados passou de 42/51 (82,4%) para 28/51 (54,9%) no atual e de 42/62 (67,7%) para 24/62 (38,7%) no reservado; no novo foi 22/55 (40,0%). Ainda há letalidade relevante, sobretudo em lesões arteriais ou vitais; não fiz nova calibração.

Exemplos auditáveis: `duelo-2a-005` rende-se mas morre depois; `duelo-2a-006` interrompe e recupera; `duelo-2a-018` tem interrupção pelo agressor e sequela. São resultados livres, não fixtures. [Dados, decisões e todas as seeds](MARCO21-METRICS.json).

## Verificação e mudanças de contrato

**110 testes em 14 arquivos passaram (77,55 s de suíte, não tempo do motor)** e build TypeScript/Vite passou. Incluem três lotes, replay/retomada/imutabilidade, vaso leve/médio estancando com dor e incapacidade persistentes, lesão arterial grave, mesma lesão com estresse 0 versus 800 mudando continuar para render-se, ausência/bloqueio de informação do terceiro, perna ausente impedindo fuga, elegibilidade e nenhum golpe após encerramento.

Os testes antigos que esperavam morte inevitável de qualquer lesão nervosa foram atualizados: a regressão de morte única agora usa uma fixture arterial explicitamente grave (18 mL/min, morte sem cuidado no minuto 115), enquanto a venosa estanca sozinha. A fixture de cuidado continua terminando com 4958 mL. Durante a implementação, TypeScript acusou valores opcionais de solidariedade/honra; o cálculo passou a usar zero quando ausentes. A revisão de conhecimento retirou leitura da dor privada do adversário e passou a registrar perigo observado; a revisão de mobilidade incluiu função nervosa da perna. Não houve falha residual na suíte final.

Quatro hashes das regras congeladas do 1d continuam iguais: proteção, catálogo de personalidade, amizade e obra. [Conferência](MARCO21-FROZEN-CHECKS.json). Logs 2a são legíveis; continuação de checkpoint incompleto exige versão compatível e não migra regras silenciosamente.

## Tempo e memória isolados

100 agentes × 100 anos, mesma seed `benchmark-pre-m2-100x100-v1`, população e agenda. Código 2a preservado antes da edição, três processos novos por versão, aquecimento de 12 meses. Validação, digest e relatório fora dos intervalos cronometrados; nenhum teste ou outro motor simultâneo. Chromium amostrado anualmente e na cópia/exportação, mantendo snapshot, Worker receptor congelado, JSON, UTF-8 e Blob. MB = 10⁶ bytes.

| Medida | M2 reexecutado | 2.1 |
|---|---:|---:|
| Motor Node, mediana | 34,36 s | 34,91 s |
| JSON exportável | 68,65 MB | 68,65 MB |
| RSS Node na exportação, mediana | 699,69 MB | 686,99 MB |
| Motor Chromium, uma execução | 29,45 s | 29,59 s |
| PSS máximo amostrado da árvore Chromium | 900,24 MB | 899,82 MB |
| Soma conservadora de máximos RSS por processo | 1379,86 MB | 1381,63 MB |

A baseline aprovada tinha 34,54 s Node, 68,65 MB de JSON e 906 MB PSS Chromium. A reexecução preservou exatamente o hash dos eventos aprovado; cada modelo repetiu seu próprio hash nas três execuções, e Node/Chromium reproduziram o mesmo estado por modelo. O cenário comparativo tem **zero duelos espontâneos**, medindo manutenção de 100 corpos, não combate em massa.

### Comparação ativa suplementar

Mesma seed e 100 agentes × 100 anos, com um duelo agendado, alterações idênticas de habilidade/personalidade/presença e cuidado desligado. Escolhas sociais habilitadas (não é a fixture numérica que as desliga). Uma execução por modelo; resultados clínicos podem mudar a carga restante, portanto a diferença não é uma medida pura de overhead.

| Modelo | Node | JSON | Chromium | PSS máximo | Duelo/feridas/mortes | Escolhas sociais |
|---|---:|---:|---:|---:|---|---:|
| before-active | 34,15 s | 68,30 MB | 28,35 s | 852,58 MB | 1/3/0 | 0 |
| after-active | 32,85 s | 68,29 MB | 28,63 s | 850,87 MB | 1/1/0 | 4 |

O pico PSS amostrado do 2.1 no cenário comparativo foi 0,900 GB; com margem estimativa de 20%, 1,080 GB. Isso não garante teto rígido de 1 GB: amostragem pode perder transientes; soma dos máximos RSS inclui memória compartilhada e picos não simultâneos. Memória de uma interface v2 futura e combate em massa não foram medidos. A meta de ~60 s deve ser lida nos números medidos acima, sem extrapolar para outras máquinas.

Reprodução, sequencial e sem carga concorrente: `npm run report:m21`; `npm run benchmark:m21`; `node scripts/benchmark-marco21-active.mjs`; `npm run benchmark:m21:browser`; `node scripts/benchmark-marco21-browser.mjs --active`. Chromium requer Playwright e `CHRONICLE_PLAYWRIGHT_MODULE` quando não instalado no projeto. [Node](MARCO21-BENCHMARK.json), [Chromium](MARCO21-BROWSER.json), [ativo Node](MARCO21-ACTIVE-BENCHMARK.json), [ativo Chromium](MARCO21-ACTIVE-BROWSER.json).

## Parada

Encerrado no Marco 2.1. Sem perseguição, disputa física da interrupção, infecção ou nova calibração de proteção/amizade/obra. Rendição e interrupção são respeitadas por convenção deste duelo consentido; fuga é afastamento local, não viagem no mapa. Nenhuma linhagem, nascimento, envelhecimento ou implementação do 2b.
