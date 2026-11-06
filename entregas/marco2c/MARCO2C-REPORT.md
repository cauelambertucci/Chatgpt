# Marco 2c — diagnóstico e correção demográfica

Etapa encerrada para revisão antes do Marco 3. Regras são **suposição de design, não verificado**. [Protocolo e emenda de escopo](MARCO2C-PLANO.md), [definições e limites](MARCO2C-METODO.md), [verificações e falhas](MARCO2C-EXECUTION-NOTES.md). Nenhuma quota de sobrevivência, nascimento ou desfecho foi aplicada.

## Diagnóstico original sem mudar regras

100 seeds `linhagem-2b-000..099`, 12 fundadores, 100 anos. 711/1554 adultos (45,75%) formaram ao menos uma parceria. Houve 459 parcerias; 268 nunca conceberam no horizonte. 362/811 pessoas com papel gestacional formaram parceria. Pessoas sem prole continuam nos denominadores.

- TFT sintética por idade: **0,70 filhos por gestante**, frente à referência aproximada de **2,1**.
- Coorte com janela completa: **0,54**, 119 filhos / 222 gestantes.
- Média ao primeiro filho observado: **27,52 anos**, entre 188 pessoas que tiveram filhos.

### Por que parcerias nunca conceberam

A tabela conta pares que encontraram cada barreira pelo menos uma vez. Uma parceria pode aparecer em várias linhas. A coluna fértil restringe os períodos a pelo menos uma pessoa com papel gestacional em idade reprodutiva; não transforma pares incompatíveis em pares reprodutivos.

| Barreira | Em toda a relação | Durante janela observada |
|---|---:|---:|
| desejo zero | 14 | 8 |
| desejo satisfeito | 35 | 6 |
| utilidade insuficiente | 80 | 16 |
| intervalo | 0 | 0 |
| idade | 267 | 61 |
| ausência | 0 | 0 |
| papéis incompatíveis | 170 | 74 |
| gestação em curso | 0 | 0 |
| sorteio anual | 2 | 2 |

169 dessas parcerias não tiveram nenhuma avaliação com pessoa gestacional em idade fértil. Isso inclui relações tardias e pares sem pessoa gestacional; não é uma estimativa de infertilidade. Intervalo é contado na avaliação anual real, não em todos os meses de espera. Algumas parcerias só não conceberam **ainda**: o horizonte censura o futuro.

### Ablação local sem alterar a simulação

968 pares-ano já passavam pelos critérios antes do sorteio; 3053 tinham múltiplos bloqueios simultâneos. Nos casos abaixo, remover somente a barreira indicada tornaria a tentativa elegível aos demais critérios. Nenhuma concepção contrafactual foi inserida; sorteio, perda e repercussões futuras não são estimados por esta contagem.

| Única barreira | Pares-ano |
|---|---:|
| papéis incompatíveis | 1109 |
| intervalo | 386 |
| idade | 142 |
| utilidade insuficiente | 61 |

## Ajuste testado

Custo marginal de filho/divisor do desejo **60→30**, teto da preferência individual **3→5**, limiar de utilidade **30→15**. Um casal com valor familiar 47+47 passa de dois para três filhos desejados/elegíveis antes de considerar estresse. A intenção é permitir contribuição acima de dois em famílias que desejam prole, compensando quem não forma parceria ou não quer filhos. Não existe consulta à população total ou à taxa de extinção para decidir nascimentos. A referência 2,1 orienta a avaliação, não uma correção automática.

Permanecem idades, intervalo de 24 meses após gestação, chance anual de 40%, risco de perda, papéis, consentimento, parentesco proibido, valores iniciais/aprendizados, estresse, mortalidade e duelo. O candidato foi fechado antes da avaliação e não retocado em função do reservado. Ativação explícita: `lifeSimulation.fertilityPolicy = "replacement-2c"`; cenários/checkpoints 2b conservam as regras antigas.

## Novo e reservado: mesmos mundos antes/depois, sem seleção

Cada linha representa **100 seeds de 100 anos**, exceto o reservado com 100 fundadores: **25 seeds pareadas** por regra. Novo: `demografia-2c-000..099`; reservado: `reservado-2b-000..099`. Por redução de escopo solicitada pelo usuário durante a execução, a matriz final tem **1.050 execuções**: 1.000 nos grupos completos e 50 nas primeiras 25 seeds reservadas pareadas com 100 fundadores (`reservado-2b-000..024`). A escolha segue a ordem dos IDs, não os desfechos nem a velocidade de conclusão. A amostra menor reduz a precisão nessa última comparação. Dez resultados excedentes já concluídos são preservados no [anexo](MARCO2C-EXTRAS.json), fora dos 25 pares; o [protocolo](MARCO2C-PLANO.md) registra quando o escopo mudou. O reservado já tinha sido visto no 2b; foi reservado para este ajuste, não é um conjunto historicamente inédito.

| Fundadores | Lote | Regra | Seeds | TFT | Coorte completa | Idade 1º filho | Extintas | Vivos finais (soma) |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 12 | Novo | 2b | 100 | 0,58 | 0,38 | 28,64 | 71 | 68 |
| 12 | Novo | 2c | 100 | 0,79 | 0,58 | 28,00 | 54 | 197 |
| 12 | Reservado | 2b | 100 | 0,67 | 0,49 | 27,45 | 66 | 82 |
| 12 | Reservado | 2c | 100 | 0,88 | 0,65 | 26,73 | 50 | 230 |
| 40 | Novo | 2b | 100 | 0,96 | 0,87 | 26,50 | 2 | 759 |
| 40 | Novo | 2c | 100 | 1,25 | 1,24 | 25,63 | 1 | 2129 |
| 40 | Reservado | 2b | 100 | 0,96 | 0,90 | 26,71 | 2 | 765 |
| 40 | Reservado | 2c | 100 | 1,25 | 1,25 | 25,71 | 2 | 2094 |
| 100 | Novo | 2b | 100 | 1,09 | 1,04 | 25,66 | 0 | 2671 |
| 100 | Novo | 2c | 100 | 1,43 | 1,35 | 24,38 | 0 | 6783 |
| 100 | Reservado | 2b | 25 | 1,15 | 1,10 | 25,64 | 0 | 737 |
| 100 | Reservado | 2c | 25 | 1,46 | 1,36 | 24,50 | 0 | 1841 |

TFT agrega taxas por idade, não a média ingênua de nascimentos por população inicial. Coortes completas e TFT podem divergir por condições iniciais, seleção temporal de parcerias e exposição. Cada linha contém composição derivada de seeds fixas; não se buscou proporção sexual favorável.

| Fundadores | Lote | Regra | Inicial + nascimentos − mortes = vivos | Maior pico populacional | Maior log JSON (MB) |
|---:|---|---|---|---:|---:|
| 12 | Novo | 2b | 1200 + 273 − 1405 = 68 | 23 | 6,42 |
| 12 | Novo | 2c | 1200 + 505 − 1508 = 197 | 33 | 10,49 |
| 12 | Reservado | 2b | 1200 + 334 − 1452 = 82 | 26 | 7,34 |
| 12 | Reservado | 2c | 1200 + 599 − 1569 = 230 | 38 | 13,87 |
| 40 | Novo | 2b | 4000 + 1865 − 5106 = 759 | 74 | 24,49 |
| 40 | Novo | 2c | 4000 + 3760 − 5631 = 2129 | 106 | 46,97 |
| 40 | Reservado | 2b | 4000 + 1897 − 5132 = 765 | 81 | 28,47 |
| 40 | Reservado | 2c | 4000 + 3741 − 5647 = 2094 | 112 | 48,74 |
| 100 | Novo | 2b | 10000 + 5758 − 13087 = 2671 | 181 | 74,83 |
| 100 | Novo | 2c | 10000 + 11329 − 14546 = 6783 | 245 | 138,98 |
| 100 | Reservado | 2b | 2500 + 1571 − 3334 = 737 | 179 | 78,25 |
| 100 | Reservado | 2c | 2500 + 3031 − 3690 = 1841 | 225 | 130,03 |

Erros/limites: **0/1050**. Picos aqui são calculados evento a evento, não apenas no balanço anual do 2b. Dados por seed: [avaliação](MARCO2C-EVALUATION.json), [resumo agregado](MARCO2C-SUMMARY.json), [diagnóstico original](MARCO2C-BASELINE.json), [ablação](MARCO2C-ABLATION.json).

## Guarda que apareceu naturalmente

Órfão significa criança distinta sem responsável vivo, e não cada tentativa de guarda ou perda de apenas um pai. Sem mortes antecipadas ou concepção forçadas.

| Fundadores | Lote | Regra | Órfãos | Decisões de guarda totais | Decisões por orfandade | Aceitas | Pendentes | Seeds sobreviventes com órfão |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 12 | Novo | 2b | 0 | 8 | 0 | 0 | 0 | 0 |
| 12 | Novo | 2c | 0 | 13 | 0 | 0 | 0 | 0 |
| 12 | Reservado | 2b | 0 | 10 | 0 | 0 | 0 | 0 |
| 12 | Reservado | 2c | 0 | 17 | 0 | 0 | 0 | 0 |
| 40 | Novo | 2b | 0 | 22 | 0 | 0 | 0 | 0 |
| 40 | Novo | 2c | 0 | 41 | 0 | 0 | 0 | 0 |
| 40 | Reservado | 2b | 0 | 19 | 0 | 0 | 0 | 0 |
| 40 | Reservado | 2c | 0 | 43 | 0 | 0 | 0 | 0 |
| 100 | Novo | 2b | 0 | 35 | 0 | 0 | 0 | 0 |
| 100 | Novo | 2c | 0 | 78 | 0 | 0 | 0 | 0 |
| 100 | Reservado | 2b | 0 | 10 | 0 | 0 | 0 | 0 |
| 100 | Reservado | 2c | 0 | 15 | 0 | 0 | 0 | 0 |

A baixa orfandade é esperada pelas regras: a gestante concebe até 45 anos e só morre naturalmente a partir de 68, quando o filho mais novo já passou da maioridade. Sem doenças/mortalidade precoce e com um único duelo, não há mecanismo frequente para morrerem todos os responsáveis de uma criança. Mais população não corrige automaticamente essa limitação estrutural. Não foram injetadas mortes para obter guarda natural.

## Orçamento medido isoladamente

Mesma seed `benchmark-pre-m2-100x100-v1`, 100 fundadores, 100 anos, cenário completo usado no 2b; aquecimento de 12 meses, GC e três processos independentes. Observador/validação/hash/exportação fora do cronômetro. Lotes pausados durante medições. População e quantidade de adultos ativos variam com nascimentos, envelhecimento e mortes; não são 100 adultos ativos constantes.

| Medida | 2b | 2c |
|---|---:|---:|
| Motor mediano (s) | 27,88 | 32,42 |
| Maior pico RSS motor (MB) | 487,46 | 581,51 |
| Maior pico RSS até exportação (MB) | 578,31 | 697,84 |
| Log JSON (MB) | 45,16 | 60,21 |
| Nascimentos | 42,00 | 75,00 |
| Mortes | 124,00 | 131,00 |

Chromium na medição inicial, com snapshot, transferência real para Worker, payload imutável, JSON, UTF-8 e Blob retidos. Esta tabela preserva o caminho bruto e o código anterior à última otimização:

| Medida | 2b | 2c |
|---|---:|---:|
| Motor (s) | 27,99 | 35,40 |
| Pico PSS observado (MB) | 807,47 | 901,31 |
| PSS com margem estimada de 20% (MB) | 968,96 | 1081,57 |
| Soma conservadora dos picos RSS (MB) | 1222,99 | 1365,07 |

### Exportação em fluxo e caso livre maior

O caso livre suplementar é a primeira seed previamente definida, `demografia-2c-000`, 100 fundadores: 153 nascimentos, pico de 213 habitantes. Não foi escolhido um caso menor para satisfazer o orçamento. Inicialmente ele excedeu as metas. A implementação final mantém o JSON e todo o histórico idênticos, mas exporta `.json.gz` sem reter JSON/UTF-8 completos. A descompressão reconstrói cada byte do JSON; o teste cobre replay e Unicode.

| Cenário/caminho | Motor Chromium (s) | Pico PSS (MB) | PSS +20% (MB) | Arquivo exportado (MB) |
|---|---:|---:|---:|---:|
| Referência 2b, gzip | 27,82 | 557,88 | 669,45 | 6,26 |
| Referência 2c final, gzip | 26,42 | 709,68 | 851,62 | 8,29 |
| Livre 100, inicial JSON bruto | 68,83 | 1346,48 | 1615,78 | 110,74 |
| Livre 100, gzip com produtor retido | 51,38 | 1142,27 | 1370,72 | 13,53 |
| Livre 100, final gzip e produtor encerrado | 45,68 | 1032,84 | 1239,41 | 13,53 |

No Node, o caso livre passou de **79,96 s para 57,67 s**, em checagens isoladas suplementares (uma repetição por versão, não mediana). Eventos e estado final têm hashes idênticos antes/depois; o JSON descomprimido segue com 110736459 bytes. A tentativa intermediária de compartilhar estado congelado não melhorou esse caso e foi descartada. A implementação final conserva cópias isoladas do estado, elimina a cópia redundante em preparação de efeito e preserva a escolha de notícias por ordem de fato/destinatário com busca linear por destinatário. A lista mensal contém apenas IDs; atributos são relidos após cada decisão. Sem índice persistente nem cache de decisões.

O ciclo final usa um Worker produtor por tarefa: após entregar a cópia imutável, ele é encerrado, e o receptor exporta gzip. A medição amostra também a cópia antes de encerrar o produtor, para não omitir esse pico transitório. O caso suplementar ficou próximo de 1,03 GB observados, acima de 1 GB estrito e sem margem de 20%; não se declara folga ou garantia universal. O orçamento aproximado depende de usar esse ciclo e o caminho gzip fornecido; **não se afirma que reter o JSON bruto, UTF-8 e Blob grandes continue dentro de ~1 GB**. O ganho não vem de reduzir nascimentos ou descartar eventos. A margem de 20% continua sendo uma estimativa, não consumo medido. [Caso livre Node](MARCO2C-ACTIVE-BENCHMARK.json), [caso livre inicial](MARCO2C-ACTIVE-BROWSER-INITIAL.json), [ciclo final no caso livre](MARCO2C-ACTIVE-LIFECYCLE-BROWSER.json), [ciclo final referência](MARCO2C-LIFECYCLE-BROWSER.json), [gzip com produtor retido](MARCO2C-ACTIVE-STREAM-BROWSER.json), [perfil](MARCO2C-PROFILE.json), [tentativa descartada](MARCO2C-SHARING-TRIAL.json).

PSS pondera memória compartilhada. A soma dos picos RSS duplica páginas compartilhadas e soma momentos diferentes; margem de 20% é estimativa, não medição. O benchmark não é uma garantia de orçamento para qualquer seed: o relatório mostra também os maiores logs livres, que podem exceder o cenário de referência. Não se limita população para melhorar a medição. Dados brutos: [Node](MARCO2C-BENCHMARK.json), [Chromium](MARCO2C-BROWSER.json).

## Verificação e parada

124 testes passaram isoladamente; build aprovado. Os quatro timeouts da execução concorrente estão documentados em [ocorrências](MARCO2C-EXECUTION-NOTES.md). Replay/checkpoint, gestação/intervalo, log imutável, identidade dos fundadores e observação sem efeito estão cobertos. Auditoria demográfica roda em todos os mundos; não houve escolha ou exclusão de seeds com base nos desfechos; a redução de escopo por ID está documentada.

Parada no Marco 2c. Sem civilizações, pesquisa da wiki ou publicação. A interpretação dos resultados e eventuais ajustes seguintes são apresentados abaixo para revisão, sem implementar outro marco.

## Interpretação e proposta, sem novo ajuste

- **12 fundadores:** TFT antigo→candidato novo 0,58→0,79; reservado 0,67→0,88. Extinções 71→54 de 100 e 66→50 de 100 nos respectivos lotes.
- **40 fundadores:** TFT antigo→candidato novo 0,96→1,25; reservado 0,96→1,25. Extinções 2→1 de 100 e 2→2 de 100 nos respectivos lotes.
- **100 fundadores:** TFT antigo→candidato novo 1,09→1,43; reservado 1,15→1,46. Extinções 0→0 de 100 e 0→0 de 25 nos respectivos lotes.

O candidato não atingiu reposição em nenhuma escala/lote. A queda de extinções ao aumentar fundadores indica efeito de escala, mas sobrevivência ao fim de um século não demonstra reposição. A referência aproximada de 2,1 pressupõe composição reprodutiva e mortalidade diferentes deste modelo; é um sinal diagnóstico, não um teorema de sobrevivência.

O ajuste permite mais filhos em famílias que os desejam, mas não resolve a formação de parcerias reprodutivas. A regra de parceria concede bônus de procriação quando os papéis são complementares e ambos valorizam família, sem verificar se os dois ainda estão na janela fértil. Proposta seguinte, **não implementada**: conceder somente esse bônus quando existe janela fértil conjunta; preservar a utilidade de companhia, consentimento e a possibilidade de relações sem filhos. Justificativa: tornar a estimativa de procriação coerente com a capacidade real, em vez de elevar arbitrariamente nascimentos até chegar a 2,1. Deve ser testada com protocolo e lote novos, sem voltar a calibrar neste reservado.

A população também é fechada e a regra de parentesco exclui pessoas com ancestral compartilhado. Em populações pequenas isso restringe parceiros ao longo das gerações; este relatório não liberaliza parentesco nem introduz imigração. A ausência de mortalidade precoce explica a escassez de orfandade completa. São limitações do modelo, não evidência de que famílias reais se comportariam assim.

[Equivalência das otimizações](MARCO2C-PERFORMANCE-EQUIVALENCE.json): sete comparações de hashes integrais de eventos/estado, bytes, nascimentos e mortes dentro da mesma política. O candidato demográfico muda os resultados deliberadamente; a otimização de implementação não os altera.
