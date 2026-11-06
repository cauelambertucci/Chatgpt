# Marco 1d — execução, falhas e limites

O trabalho foi limitado ao 1d. As fórmulas aprovadas de proteção, amizade e obra foram congeladas antes da implementação; os hashes estão em `MARCO1D-FROZEN-RULES.json`. Foram preservados os 100 cenários atuais (`pessoal-1c-000..099`) e 100 reservados (`reservado-1d-000..099`) sob o motor 1c em `MARCO1D-BASELINE.json`. O perfil 1d usa os mesmos atributos e agendas iniciais, adicionando a dinâmica pedida. Mudanças indiretas nos resultados por personalidade transformada, estresse e consequências são esperadas; não foram ajustadas quotas ou os pesos congelados.

## Falhas encontradas

1. **Transformação sem diferença:** a auditoria identificou que atributos já saturados podiam produzir um evento chamado transformação sem mudança numérica. O registro de emoção continua existindo, mas a transformação só é emitida se houver mudança efetiva. A fixture metamórfica foi reforçada para exigir diferenças reais nos valores antes/depois, e não apenas nomes diferentes de emoções. Uma medição preliminar foi descartada antes de produzir o relatório final; a medição final foi reiniciada com a correção.
2. **Validação incompleta de resgate:** o teste de adulteração falhou de verdade: o validador verificava a contribuição anterior, mas não rejeitava crédito falso adicionado no efeito de encerramento `resolved_by_other`. O validador agora verifica ambos e exige percepção, presença, alvo vivo e resolução efetiva. O teste então passou. Resultado daquela execução: 11 passaram, 1 falhou; não foi removido nem marcado como ignorado.
3. **Timeout da infraestrutura de testes:** uma execução completa teve 78 verificações aprovadas, porém terminou com código 1 por erro interno do Vitest (`[vitest-worker]: Timeout calling "onTaskUpdate"`) sob carga simultânea de relatórios. Essa execução não foi tratada como sucesso. A repetição final sem relatório concorrente passou; o resultado está na verificação final abaixo.

4. **Autodefesa omitida:** a revisão encontrou uma testemunha cujo protegido matava o agressor em autodefesa. O novo teste falhou com `failed` onde deveria ser `resolved_by_other`. A resolução passou a ocorrer depois da morte efetiva do agressor; se quem morre é o protegido, continua sendo falha. O teste de regressão foi mantido. A medição final foi refeita após essa correção, sem mudar pesos ou escolher seeds.

5. **Ciclo no colapso causal:** o relatório completo falhou na seed `reservado-1d-096` com `Collapsing periods produced a causal cycle`. Um evento de outro agente dependia do primeiro período e influenciava um período posterior; unir os dois períodos criava um ciclo no grafo contraído, embora o log original fosse acíclico. Agora o colapso verifica realimentação causal antes de unir períodos e abre um novo episódio quando necessário. Foram acrescentados um teste mínimo dessa estrutura e a seed real de regressão. A preparação do grafo é reutilizada entre objetivos da mesma consulta, mantendo a auditoria de ranking nos 200 mundos. A execução interrompida não produziu o relatório final e não foi tratada como sucesso.

6. **Notícia tardia de fracasso:** a revisão de conhecimento identificou que o encerramento remoto evitava emoção onisciente, mas faltava gerar a reação quando a notícia chegava depois. Agora a notícia do alvo morto permite perceber o fracasso de seu próprio compromisso, com causas apontando tanto para a informação recebida quanto para o encerramento. Parentes/vínculos fortes continuam recebendo avaliação de perda; não se duplica o fracasso na mesma notícia. Uma fixture deixa o guardião ausente na morte e demonstra reação somente ao retorno e à notícia.

## Cobertura nova

- Mesma morte produz luto irado e luto solidário com alterações distintas, conforme personalidade; o fato da morte é o mesmo. A pessoa está ausente no momento e só reage ao receber notícia.
- Bloqueio da informação impede luto por perda desconhecida; fracasso de proteção remoto só produz emoção após notícia recebida.
- Estresse alto versus baixo muda a decisão em fixtures separadas de isolamento, hostilidade verbal e abandono de posto. O cargo inicial da última é declarado por um evento de fixture, não apresentado como eleição livre.
- Reincidência testa as quatro respostas, a possibilidade de recusa e a expulsão após nova infração. Expulsão persiste apesar da agenda original.
- Proteção redundante encerra como resolvida por outro, sem crédito próprio; percepção bloqueada não gera objetivo ou fechamento remoto.
- Promessa explícita quebrada gera traição percebida e transformação; troca sem promessa não é rotulada traição.
- Vitória reduz estresse; atributos saturados não geram falsa mudança.
- Regressão do ciclo causal na seed reservada 096 e caso mínimo de realimentação; treino e monitoramento continuam colapsando quando não atravessam uma decisão causal intermediária.
- Replay, retomada JSON, ranking, limites numéricos, frequência mensal e rejeição de eventos adulterados.

Execuções dirigidas por nome isolaram autodefesa e notícias remotas; os demais testes apareceram como não selecionados nessas execuções, e todos voltam a executar na suíte completa. Não houve teste novo removido, permanentemente ignorado ou afrouxado para obter aprovação. O teste de adulteração foi mantido depois da correção do validador. Os testes anteriores continuam na suíte.

O lote chamado reservado foi usado depois do congelamento inicial, mas a seed 096 revelou a falha estrutural e passou a integrar a regressão. Portanto, ele não deve ser apresentado como um conjunto jamais inspecionado após essa correção. Não foi usado para calibrar proteção, amizade, obra ou taxas de desfecho.

## Reprodução

```sh
npm ci
npm test
npm run build
npm run report:m1d
```

O relatório valida todos os mundos, verifica limite de reincidência e hashes e calcula o ranking nas 200 seeds. A preparação do grafo é compartilhada entre objetivos da mesma consulta, sem cache persistente que possa ficar desatualizado. Não sorteia até encontrar desfecho desejado. Os três exemplos são os primeiros encontrados de fenômenos distintos no lote livre, escolhidos após a geração, sem alterar os mundos. Fixtures são separadas e identificadas.

Métricas persistidas em `MARCO1D-METRICS.json`; logs grandes, detalhes por seed e fixtures em `reports/marco1d/`, ignorados pelo Git e regeneráveis. Os relatórios não implicam publicação no GitHub.

## Limites materiais

- Primeira dinâmica emocional ficcional; regras simples de avaliação e incrementos pequenos, não uma simulação psicológica completa. Não são fórmulas verificadas na wiki.
- Quatro necessidades; abrigo/isolamento são estados abstratos, sem casa, sono físico, fome, corpo ou doença.
- Confronto ao reincidente é uma contestação/intimação social abstrata, com resposta do agressor; não abre um novo duelo.
- Autoridade é líder ou representante local presente; a terceira ameaça provoca consequência e a infração seguinte provoca expulsão. Não há processo judicial ou acompanhamento em outra cidade. O limite de quatro é uma regra social explícita do cenário, não quota de resultados.
- Traição cobre apoio político prometido e ruptura presenciada. Não há rumor de traição à distância; a informação de mortes mantém os canais anteriores.
- “Resolvido por outro” encerra o compromisso com a ameaça percebida; não promete que o protegido jamais enfrentará outro perigo.
- Meses de estresse alto incluem pessoas ausentes ou expulsas: as necessidades continuam agregadas, mas não se simula a vida em outro lugar.
- O encerramento no horizonte ainda pode concentrar fracassos. A nova categoria não é fundida com sucesso para maquiar taxas.
- Sem ensaio v2 de 300 anos: o cenário continua limitado a 20 anos/20 pessoas. Tempos do relatório incluem validação e ranking, com carga concorrente em parte da execução; não são benchmark isolado do motor. Eventos guardam projeções completas e geram logs grandes.
- UI/mapa permanecem v1. Marco 2 não iniciado; nenhum push ou publicação realizado.


## Verificação final

- `npm test`: **82 testes passaram em 11 arquivos**, 0 falhas, 0 ignorados, sem erros internos; saída 0, 44,74 s. Inclui os 66 anteriores e 16 novos, com metamórficos e regressões. Execução isolada do relatório.
- `npm run build`: TypeScript e bundle Vite passaram, saída 0.
- `npm run report:m1d`: **200 seeds completas, 0 mundos inválidos**, fixtures sem erros, ranking auditado nas 200 seeds, 4/4 hashes conferem; saída 0. Tempo total com validação/ranking: 312,607 s.
- Proteção no atual: 100 cumpridos, 27 falhas, 195 resolvidos por outro (322 adoções). No reservado: 103 cumpridos, 17 falhas, 193 resolvidos por outro (313 adoções).
- Máximo de quatro ameaças por agressor nos dois lotes, conforme a regra social explícita. Não houve filtro ou quota de desfechos.
- Hostilidade verbal apareceu 1/4 vezes e abandono de posto 1/0 vezes nos lotes atual/reservado. O zero reservado foi mantido; as fixtures verificam elegibilidade e escolha por contexto.
- As distribuições, concentrações superiores a 70%, três casos livres e a fixture metamórfica estão em [MARCO1D-REPORT.md](MARCO1D-REPORT.md).

Parada no Marco 1d. Nenhum corpo, início do Marco 2, push ou publicação.
