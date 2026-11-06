# Marco 1 — relatório da fatia de vingança

Execução reproduzível: `npm run report:m1`. Lote fixo `livre-000` a `livre-099`; 20 pessoas, 240 meses por mundo. **Geração livre dentro de um cenário de rivalidade e parentesco:** não é ainda um mundo com geografia/população. Desfechos são resultados das ações, nunca categorias sorteadas por seed. A fixture é separada do lote.

## Distribuição de 100 seeds

| Desfecho focal por mundo | Quantidade | Percentual |
|---|---:|---:|
| vingança cumprida | 13 | 13% |
| desistência | 70 | 70% |
| alvo morto por outra causa | 1 | 1% |
| reconciliação | 0 | 0% |
| fuga | 14 | 14% |
| objetivo frustrado | 2 | 2% |

Concentração no limiar de 70% ou acima: desistência. Proposta: inspecionar escores e oportunidades; revisar pesos de paz/vingança, disponibilidade de ajuda e limiares do resolvedor, um fator por vez, sem selecionar desfechos por quota.

Validação: 0 mundos inválidos; fixture: 0 erros. Tempo total de geração e validação do lote: 15697 ms nesta máquina.

Tempo por mundo (geração, validação e extração): p50 148 ms; p95 195 ms; máximo 321 ms. São medições locais, não do computador da faculdade.

## Três histórias encontradas no lote livre

### livre-056 — vingança cumprida

Modo: free. 4280 eventos; 143 elos na maior cadeia causal até o desfecho.

- Thorin e Mael começaram como familiares; Sora tinha uma rivalidade conhecida com Mael.
- No ano 0, mês 1, Mael morreu em confronto abstrato, com responsabilidade atribuída a Sora.
- No ano 0, mês 1, Thorin soube por testemunho; a notícia deu origem à memória e à avaliação de vingança.
- A resposta foi avaliada no ano 0, mês 1. Até o desfecho houve 129 períodos mensais de treino, com ganho de 925 pontos de habilidade.
- No ano 5, mês 1, Thorin escolheu comunicar/pedir ajuda a Vela, em vez de impor confronto imediato.
- No ano 11, mês 3, Sora morreu em confronto com Thorin; atribuição registrada em event:2352.
- No ano 11, mês 3, desfecho: vingança cumprida. A notícia confirmou a morte do alvo.

Maior caminho causal (os demais ramos também são preservados): event:0 → event:1 → event:3 → event:4 → event:5 → event:7 → event:8 → event:9 → event:43 → event:61 → event:79 → event:97 → event:116 → event:133 → event:150 → event:167 → event:184 → event:201 → event:218 → event:235 → event:252 → event:269 → event:286 → event:303 → event:320 → event:337 → event:354 → event:371 → event:388 → event:405 → event:422 → event:439 → event:456 → event:473 → event:490 → event:507 → event:524 → event:541 → event:558 → event:575 → event:592 → event:609 → event:626 → event:643 → event:660 → event:677 → event:694 → event:711 → event:728 → event:745 → event:762 → event:779 → event:796 → event:813 → event:830 → event:847 → event:864 → event:881 → event:898 → event:915 → event:932 → event:949 → event:966 → event:983 → event:1000 → event:1017 → event:1034 → event:1051 → event:1053 → event:1070 → event:1087 → event:1104 → event:1121 → event:1138 → event:1155 → event:1173 → event:1191 → event:1209 → event:1227 → event:1245 → event:1264 → event:1281 → event:1298 → event:1315 → event:1332 → event:1349 → event:1366 → event:1383 → event:1400 → event:1417 → event:1434 → event:1451 → event:1468 → event:1485 → event:1502 → event:1519 → event:1536 → event:1553 → event:1570 → event:1604 → event:1621 → event:1638 → event:1655 → event:1672 → event:1689 → event:1706 → event:1723 → event:1740 → event:1757 → event:1774 → event:1791 → event:1809 → event:1828 → event:1846 → event:1864 → event:1882 → event:1900 → event:1918 → event:1936 → event:1954 → event:1972 → event:1990 → event:2008 → event:2026 → event:2062 → event:2098 → event:2116 → event:2134 → event:2152 → event:2170 → event:2188 → event:2206 → event:2224 → event:2242 → event:2260 → event:2278 → event:2296 → event:2314 → event:2332 → event:2351 → event:2352 → event:2354 → event:2355

Grafo completo de apoio: 147 eventos; IDs e arestas estão nos arquivos JSON.

### livre-098 — alvo morto por outra causa

Modo: free. 4336 eventos; 8 elos na maior cadeia causal até o desfecho.

- Syl e Alda começaram como familiares; Corin tinha uma rivalidade conhecida com Alda.
- No ano 0, mês 1, Alda morreu em confronto abstrato, com responsabilidade atribuída a Corin.
- No ano 0, mês 1, Syl soube por testemunho; a notícia deu origem à memória e à avaliação de vingança.
- A resposta foi avaliada no ano 0, mês 1. Até o desfecho houve 64 períodos mensais de treino, com ganho de 316 pontos de habilidade.
- No ano 4, mês 3, Syl escolheu comunicar/pedir ajuda a Thorin, em vez de impor confronto imediato.
- No ano 5, mês 6, Corin morreu em confronto com Thorin; atribuição registrada em event:1168.
- No ano 5, mês 6, desfecho: alvo morto por outra causa. A notícia confirmou a morte do alvo.

Maior caminho causal (os demais ramos também são preservados): event:0 → event:1 → event:4 → event:5 → event:7 → event:8 → event:9 → event:1171

Grafo completo de apoio: 14 eventos; IDs e arestas estão nos arquivos JSON.

### livre-036 — fuga

Modo: free. 4317 eventos; 106 elos na maior cadeia causal até o desfecho.

- Iven e Runa começaram como familiares; Elian tinha uma rivalidade conhecida com Runa.
- No ano 0, mês 1, Runa morreu em confronto abstrato, com responsabilidade atribuída a Elian.
- No ano 0, mês 1, Iven soube por testemunho; a notícia deu origem à memória e à avaliação de vingança.
- A resposta foi avaliada no ano 0, mês 1. Até o desfecho houve 95 períodos mensais de treino, com ganho de 889 pontos de habilidade.
- No ano 3, mês 5, Iven escolheu comunicar/pedir ajuda a Tala, em vez de impor confronto imediato.
- No ano 8, mês 2, desfecho: fuga. O alvo escolheu escapar diante da ameaça superior; não houve morte.

Maior caminho causal (os demais ramos também são preservados): event:0 → event:1 → event:4 → event:5 → event:7 → event:8 → event:9 → event:43 → event:61 → event:79 → event:97 → event:115 → event:134 → event:151 → event:168 → event:185 → event:202 → event:219 → event:236 → event:253 → event:270 → event:287 → event:304 → event:321 → event:338 → event:355 → event:372 → event:389 → event:406 → event:423 → event:440 → event:457 → event:474 → event:491 → event:508 → event:525 → event:542 → event:559 → event:576 → event:593 → event:610 → event:627 → event:644 → event:661 → event:678 → event:695 → event:712 → event:714 → event:732 → event:751 → event:769 → event:787 → event:805 → event:823 → event:841 → event:859 → event:877 → event:895 → event:913 → event:931 → event:949 → event:967 → event:985 → event:1003 → event:1021 → event:1039 → event:1057 → event:1075 → event:1093 → event:1111 → event:1129 → event:1147 → event:1165 → event:1183 → event:1201 → event:1219 → event:1237 → event:1255 → event:1273 → event:1291 → event:1309 → event:1327 → event:1345 → event:1363 → event:1381 → event:1399 → event:1417 → event:1435 → event:1453 → event:1471 → event:1489 → event:1507 → event:1525 → event:1543 → event:1561 → event:1579 → event:1597 → event:1615 → event:1633 → event:1651 → event:1669 → event:1687 → event:1705 → event:1723 → event:1742 → event:1743

Grafo completo de apoio: 108 eventos; IDs e arestas estão nos arquivos JSON.

## Fixture controlada

### fixture-vinganca — vingança cumprida

Modo: fixture. 4372 eventos; 71 elos na maior cadeia causal até o desfecho.

- Runa e Elian começaram como familiares; Skarn tinha uma rivalidade conhecida com Elian.
- No ano 0, mês 1, Elian morreu em confronto abstrato, com responsabilidade atribuída a Skarn.
- No ano 0, mês 2, Runa soube por relato; a notícia deu origem à memória e à avaliação de vingança.
- A resposta foi avaliada no ano 0, mês 2. Até o desfecho houve 58 períodos mensais de treino, com ganho de 464 pontos de habilidade.
- No ano 5, mês 1, Skarn morreu em confronto com Runa; atribuição registrada em event:1112.
- No ano 5, mês 1, desfecho: vingança cumprida. A notícia confirmou a morte do alvo.

Maior caminho causal (os demais ramos também são preservados): event:0 → event:1 → event:2 → event:3 → event:4 → event:43 → event:44 → event:45 → event:46 → event:64 → event:84 → event:102 → event:120 → event:138 → event:156 → event:174 → event:192 → event:210 → event:228 → event:246 → event:264 → event:282 → event:300 → event:318 → event:336 → event:354 → event:372 → event:390 → event:408 → event:426 → event:444 → event:462 → event:480 → event:498 → event:516 → event:534 → event:552 → event:570 → event:588 → event:606 → event:624 → event:642 → event:660 → event:678 → event:696 → event:714 → event:732 → event:750 → event:768 → event:786 → event:804 → event:822 → event:840 → event:858 → event:876 → event:894 → event:912 → event:930 → event:948 → event:966 → event:984 → event:1002 → event:1020 → event:1038 → event:1056 → event:1074 → event:1092 → event:1111 → event:1112 → event:1114 → event:1115

Grafo completo de apoio: 74 eventos; IDs e arestas estão nos arquivos JSON.


## Avaliação de qualidade e proposta

O lote inicial teve 70% de desistências e zero reconciliações. Se esses valores persistirem, há concentração relevante no limiar e a reconciliação livre não está demonstrada. O teste positivo controlado prova apenas possibilidade. Proposta para revisão posterior: separar a intenção de buscar acordo do perdão unilateral e permitir aguardar o próximo reencontro antes de encerrar o objetivo; medir novamente no mesmo lote e em seeds reservadas. Não alterar os desfechos por quota, nem afrouxar os testes para esconder o resultado.

Falhas iniciais e correções estão em [MARCO1-EXECUTION-NOTES.md](MARCO1-EXECUTION-NOTES.md). A distribuição inclui todos os seis rótulos, inclusive contagens zero. Os resultados dos testes são registrados após a suíte completa.

## Limites

Confronto é escalar e abstrato, sem corpo, arma, mapa, senescência ou novos sistemas de pessoa profunda. A agenda de presença é exógena e declarada na origem. Relatos propagam apenas mortes conhecidas; pedir ajuda pode liberar treino assistido. Perdão unilateral é desistência; reconciliação exige presença e aceitação do alvo. Fuga significa que o alvo abandonou este cenário após escolher escapar. Horizonte sem resolução, ausência de objetivo ou morte do vingador são objetivo frustrado, com motivo distinguido nos dados.

Os arquivos JSON completos e a distribuição por seed ficam em `reports/marco1/` e são regeneráveis; não devem ser confundidos com a antiga UI v1.
