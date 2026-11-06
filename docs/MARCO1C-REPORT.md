# Marco 1c — personalidade, poder e obra

100 seeds livres: pessoal-1c-000..099; 20 agentes e 240 meses. Catálogo: 30 facetas (0–100) e 20 valores (-100–100), todos com canais de influência em ações, detalhados nos escores.

| Objetivo | Cumprido | Falhou | Abandonado |
|---|---:|---:|---:|
| amizade | 35 | 105 | 474 |
| governar | 71 | 252 | 0 |
| proteger | 152 | 225 | 0 |
| criar_obra | 411 | 36 | 0 |

São objetivos, não mundos. amizade: abandoned 474/614; concentração >=70%, sem quota para corrigir. governar: failed 252/323; concentração >=70%, sem quota para corrigir. criar_obra: completed 411/447; concentração >=70%, sem quota para corrigir.

Validação: 0 mundos/fixtures inválidos. Lote: 32680 ms; maior tempo por mundo/extrator: 490 ms nesta máquina.

## Histórias encontradas, sem preenchimento artificial

### pessoal-1c-000: governar — completed

Alda assumiu o objetivo de conquistar a coordenação do grupo no ano 0, mês 1.

Conquistou a coordenação com 10 apoios públicos; quórum exigido: 10.

Desfecho no ano 1, mês 2: completed. Conquistou a coordenação com maioria de apoios públicos válidos.

Profundidade 37, escore 111; 0 períodos repetidos colapsados.

### pessoal-1c-000: criar_obra — completed

Orin assumiu o objetivo de criar uma obra no ano 0, mês 1.

Concluiu Caderno de Orin, qualidade 32/100, consumindo papel e tinta em seis períodos; tema referenciado: event:73.

Desfecho no ano 0, mês 9: completed. Concluiu uma obra após seis períodos de trabalho e consumo real de materiais.

Profundidade 8, escore 48; 5 períodos repetidos colapsados.

### pessoal-1c-000: governar — failed

Bram assumiu o objetivo de conquistar a coordenação do grupo no ano 0, mês 1.

Solicitou apoio; não obteve a maioria necessária no horizonte.

Desfecho no ano 19, mês 12: failed. Horizonte encerrado sem satisfazer o objetivo.

Profundidade 28, escore 84; 0 períodos repetidos colapsados.

## Fixtures separadas

### fixture-governar

Thorin assumiu o objetivo de conquistar a coordenação do grupo no ano 0, mês 1.

Conquistou a coordenação com 11 apoios públicos; quórum exigido: 11.

Desfecho no ano 0, mês 10: completed. Conquistou a coordenação com maioria de apoios públicos válidos.

### fixture-criar_obra

Runa assumiu o objetivo de criar uma obra no ano 0, mês 1.

Concluiu Caderno de Runa, qualidade 87/100, consumindo papel e tinta em seis períodos; tema referenciado: expressão pessoal.

Desfecho no ano 0, mês 6: completed. Concluiu uma obra após seis períodos de trabalho e consumo real de materiais.

## Avaliação das concentrações

Fracasso por candidato não é vacância por mundo: vários agentes disputam uma única coordenação. A próxima avaliação deve medir também vagas e trocas de apoio, sem tentar eleger todos. Para amizade, investigar reação a recusas e afinidade conhecida antes de insistir. Para obras, o critério atual é concluir um livro simples; avaliar qualidade, ambição artística e custos antes de interpretar uma alta conclusão como excelência. Nenhuma falha foi sorteada para equilibrar resultados.

## Escopo

Poder significa coordenar o grupo abstrato por maioria de apoios, não criar governo/civilização. Cada apoiador decide e pode trocar apoio; mortos e ausentes não contam no quórum. Obra é um livro simples que exige papel/tinta e seis períodos, criador, qualidade e tema conhecido; não implementa o sistema amplo de artefatos. A versão 1c não continua checkpoints de regras antigas silenciosamente. Sem corpo, mapa novo, religião nova, estresse clínico ou UI nova.

O ranking penaliza adoção/desfecho no mesmo mês sem decisão intermediária, usa profundidade pós-colapso e retorna menos de dez se faltar material qualificado. Logs completos e fixtures ficam em reports/marco1c, regeneráveis com npm run report:m1c.
