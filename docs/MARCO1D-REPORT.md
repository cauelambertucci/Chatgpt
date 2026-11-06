# Marco 1d — necessidades, estresse e consequências

**Concluído e parado antes do Marco 2.** Dois lotes fixos de 100 seeds, sem quotas, descarte de seeds ou recalibração de proteção, amizade e obra. Atributos/agendas iniciais são iguais aos do perfil 1c. As novas regras emocionais e sociais podem mudar as decisões e os desfechos.

## Verificação

- Mundos inválidos: **0/200**; fixtures validadas separadamente.
- Regras congeladas: **4/4 hashes conferem** (estimativas de proteção, catálogo/pesos de personalidade, amizade e obra).
- Testes e build: consultar a verificação final em [MARCO1D-EXECUTION-NOTES.md](MARCO1D-EXECUTION-NOTES.md); o gerador de relatório não executa a suíte.
- Os erros encontrados, inclusive uma falha real no teste de adulteração e um timeout do Vitest, estão registrados nas notas.

## Distribuição completa dos objetivos pessoais

Contagens absolutas. “Por outro” é uma categoria separada: não entra como êxito próprio nem como falha. O denominador inclui todas as adoções. Atual = `pessoal-1c-000..099`; reservado = `reservado-1d-000..099`.

| Lote | Motor | Objetivo | Total | Cumprido | Falha | Abandono | Por outro |
|---|---|---|---:|---:|---:|---:|---:|
| Atual | 1c | Proteção | 377 | 152 | 225 | 0 | 0 |
| Atual | 1c | Amizade | 614 | 35 | 105 | 474 | 0 |
| Atual | 1c | Coordenação | 323 | 71 | 252 | 0 | 0 |
| Atual | 1c | Obra | 447 | 411 | 36 | 0 | 0 |
| Atual | 1d | Proteção | 322 | 100 | 27 | 0 | 195 |
| Atual | 1d | Amizade | 614 | 34 | 112 | 468 | 0 |
| Atual | 1d | Coordenação | 323 | 72 | 251 | 0 | 0 |
| Atual | 1d | Obra | 447 | 403 | 44 | 0 | 0 |
| Reservado | 1c | Proteção | 381 | 163 | 218 | 0 | 0 |
| Reservado | 1c | Amizade | 661 | 35 | 133 | 493 | 0 |
| Reservado | 1c | Coordenação | 323 | 61 | 262 | 0 | 0 |
| Reservado | 1c | Obra | 457 | 424 | 33 | 0 | 0 |
| Reservado | 1d | Proteção | 313 | 103 | 17 | 0 | 193 |
| Reservado | 1d | Amizade | 661 | 35 | 145 | 481 | 0 |
| Reservado | 1d | Coordenação | 323 | 59 | 264 | 0 | 0 |
| Reservado | 1d | Obra | 457 | 419 | 38 | 0 | 0 |

| Lote | Falhas de proteção antes | Falhas de proteção depois | Mortes antes → depois | Ameaças antes → depois |
|---|---:|---:|---:|---:|
| Atual | 225/377 (59,7%) | 27/322 (8,4%) | 27 → 26 | 820 → 358 |
| Reservado | 218/381 (57,2%) | 17/313 (5,4%) | 28 → 24 | 863 → 361 |

A diferença não mede apenas a correção de classificação: necessidades, transformações e consequências também alteram as trajetórias. Os números de adoções e mortes são mostrados para evitar atribuir toda mudança da taxa a uma melhoria do protetor.

## Emoções, crise e reincidência

| Medida no 1d | Atual | Reservado |
|---|---:|---:|
| Emoções por perda | 18 | 17 |
| Emoções por ameaça sofrida | 358 | 361 |
| Emoções por vitória | 641 | 646 |
| Emoções por traição percebida | 185 | 194 |
| Emoções por fracasso | 416 | 450 |
| Recuperação escolhida | 10116 | 9930 |
| Isolamento escolhido | 34 | 47 |
| Hostilidade verbal escolhida | 1 | 4 |
| Abandono de posto escolhido | 1 | 0 |
| Confronto ao reincidente | 16 | 22 |
| Expulsão | 51 | 53 |
| Perdão condicional | 19 | 19 |
| Pedido de acordo | 20 | 18 |
| Transformações efetivas | 1614 | 1668 |
| Pessoa-meses com estresse ≥650 na atualização mensal | 23626 | 24323 |
| Máximo de ameaças por agressor | 4 | 4 |
| Eventos no lote | 987365 | 993012 |
| Maior tempo por mundo, com validação/ranking (ms) | 3406 | 3400 |
| Seeds sem história qualificada no ranking | 0 | 0 |

O lote reservado revelou a falha de relatório da seed 096, agora incorporada à regressão; não foi utilizado para calibrar pesos ou taxas. Concentrações superiores a 70% foram mantidas:

- Atual, Amizade: abandono = 468/614 (76,2%).
- Atual, Coordenação: falha = 251/323 (77,7%).
- Atual, Obra: cumprido = 403/447 (90,2%).
- Reservado, Amizade: abandono = 481/661 (72,8%).
- Reservado, Coordenação: falha = 264/323 (81,7%).
- Reservado, Obra: cumprido = 419/457 (91,7%).

Não houve ajuste para distribuir esses resultados. Recuperação não exige crise; as outras três respostas exigem estresse alto. Zeros na geração livre são mostrados, mesmo quando uma ação funciona nas fixtures. Fracassos no fim do horizonte também geram emoção, mas não há meses posteriores para observar suas consequências neste lote.

## Três casos reais de geração livre

São exemplos diagnósticos encontrados após gerar as seeds, não três posições garantidas no ranking. Um fechamento imediato continua penalizado e pode ser excluído do ranking.

### 1. pessoal-1c-000 — transformacao

Luma, no ano 0, mês 1, reagiu a ameaca com tristeza reflexiva. compaixao: 77 → 79; solidariedade: -81 → -79; estresse: 0 → 110. Cadeia: event:10 (threat.announced) → event:11 (emoção) → event:12 (transformação).

### 2. pessoal-1c-000 — consequencia

Alda respondeu à 3ª ameaça de Bram, no ano 4, mês 8, com **perdao**. Utilidades: confronto 91, expulsao 10, perdao 129, acordo 85. O agressor não recebeu obediência automática; o registro distingue perdão de acordo. Evento event:2324, causado pela ameaça event:2301 e pelo registro de reincidência.

### 3. pessoal-1c-001 — resolvido_por_outro

Bram assumiu proteger Thorin, mas Luma resolveu a ameaça. Bram presenciou o resultado e encerrou **resolvido por outro**, com **0 intervenções próprias**, no ano 0, mês 1. Percepção event:21; resolução event:35; fechamento event:37. Como adoção e desfecho ocorreram no mesmo mês, sem decisão intermediária própria, este caso recebe a penalidade do ranking.

## Fixture metamórfica — mesma perda, personalidades diferentes

- Personalidade irada: luto irado; estresse 0 → 208; rancor 80 → 83; vinganca 80 → 83, após notícia própria.
- Personalidade solidária: luto solidario; estresse 0 → 208; compaixao 80 → 82; solidariedade 0 → 2, após notícia própria.

Os testes comparam a mesma morte real, verificam alterações numéricas distintas e demonstram que bloquear a notícia elimina o luto por essa perda. Outras fixtures cobrem crise, promessa quebrada, quatro respostas à reincidência e proteção redundante. São intervenções identificadas de teste, não histórias livres.

## Limites e parada

Há quatro necessidades e uma avaliação emocional inicial; não é psicologia completa. Consequências sociais são locais e abstratas: terceira ameaça recebe uma resposta; reincidir após uma consequência leva à expulsão. Assim o limite de quatro ameaças é uma regra explícita do cenário, não evidência de justiça social emergente. Isolamento dura dois meses, expulsão persiste.

O relatório levou 313 s nesta execução. A duração inclui validação e ranking e parte do lote teve carga concorrente; não é benchmark isolado. O perfil segue em 20 pessoas/240 meses, sem ensaio v2 de 300 anos. Logs completos são grandes porque guardam os efeitos completos para replay.

**Pesos de proteção, amizade e obra preservados. Marco 2 não iniciado. Nenhum push ou publicação.**

Arquivos: [métricas](MARCO1D-METRICS.json), [baseline](MARCO1D-BASELINE.json), [falhas e reprodução](MARCO1D-EXECUTION-NOTES.md), [modelo em uma página](DESIGN-RESUMO.md). Logs e fixtures regeneráveis: `npm run report:m1d`.
