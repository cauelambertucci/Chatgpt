# Marco 1b — proteção e amizade

100 seeds livres fixas: pessoal-1b-000..099. Cada cenário tem 20 pessoas e 240 meses. Atributos e agendas são seedados; nenhum desfecho é escolhido por quota. As contagens abaixo são **objetivos**, não mundos: uma pessoa pode ter mais de um compromisso.

| Objetivo | Cumprido | Frustrado/falhou | Abandonado |
|---|---:|---:|---:|
| amizade | 578 | 82 | 653 |
| proteger | 19 | 1351 | 0 |

proteger: failed = 1351/1370 (99%). Investigar capacidades, oportunidades e aceitação; sem quota.

Erros de validação: 0. Tempo total do lote: 18774 ms; maior geração/validação/extrator por mundo: 333 ms nesta máquina.

## Três histórias realmente encontradas

### pessoal-1b-000: proteger — completed

Alda assumiu o objetivo de proteger Syl no ano 15, mês 1.

O compromisso nasceu de uma ameaça de Corin que Alda presenciou, sem notícia global automática.

Intervenções bem-sucedidas: 1. Syl terminou o horizonte vivo.

Desfecho no ano 19, mês 12: completed. Pessoa protegida viva no horizonte e intervenção efetiva registrada.

Profundidade após colapso: 49; períodos repetidos removidos da contagem: 46. IDs do caminho: event:0 → event:1 → event:282 → event:318 → event:439 → event:490 → event:592 → event:645 → event:696 → event:764 → event:798 → event:900 → event:985 → event:1036 → event:1155 → event:1206 → event:1308 → event:1410 → event:1495 → event:1546 → event:1631 → event:1665 → event:1716 → event:1772 → event:1880 → event:1966 → event:2017 → event:2119 → event:2194 → event:2236 → event:2308 → event:2380 → event:2452 → event:2488 → event:2542 → event:2632 → event:2686 → event:2758 → event:2812 → event:2848 → event:2956 → event:2992 → event:3118 → event:3172 → event:3226 → event:3298 → event:3404 → event:3406 → event:4504.

### pessoal-1b-000: amizade — completed

Syl assumiu o objetivo de construir amizade com Mira no ano 0, mês 1.

Foram 3 convites aceitos e 0 recusados; amizade só foi reconhecida após confiança recíproca.

Desfecho no ano 0, mês 4: completed. Amizade recíproca construída por encontros aceitos.

Profundidade após colapso: 15; períodos repetidos removidos da contagem: 0. IDs do caminho: event:0 → event:1 → event:4 → event:5 → event:151 → event:152 → event:153 → event:195 → event:196 → event:197 → event:259 → event:260 → event:261 → event:262 → event:263.

### pessoal-1b-000: proteger — failed

Iria assumiu o objetivo de proteger Zarek no ano 0, mês 1.

O compromisso nasceu de uma ameaça de Syl que Iria presenciou, sem notícia global automática.

Intervenções bem-sucedidas: 0. Zarek terminou o horizonte morto.

Desfecho no ano 0, mês 1: failed. A pessoa-alvo morreu.

Profundidade após colapso: 7; períodos repetidos removidos da contagem: 0. IDs do caminho: event:0 → event:1 → event:6 → event:7 → event:8 → event:38 → event:52.


## Fixtures separadas do lote livre

### fixture-proteger

Runa assumiu o objetivo de proteger Sora no ano 0, mês 1.

O compromisso nasceu de uma ameaça de Iven que Runa presenciou, sem notícia global automática.

Intervenções bem-sucedidas: 1. Sora terminou o horizonte vivo.

Desfecho no ano 0, mês 12: completed. Pessoa protegida viva no horizonte e intervenção efetiva registrada.

### fixture-amizade

Vela assumiu o objetivo de construir amizade com Thorin no ano 0, mês 1.

Foram 3 convites aceitos e 0 recusados; amizade só foi reconhecida após confiança recíproca.

Desfecho no ano 0, mês 3: completed. Amizade recíproca construída por encontros aceitos.

## Escopo e limites

Amizade exige encontro conhecido, convites aceitos e confiança bilateral; após três recusas o agente desiste de insistir. Proteção exige testemunho local de ameaça, decisão por utilidade e capacidade de intervenção. O objetivo de proteção é monitorado até o horizonte ou a morte de um envolvido; não é declarado cumprido só por adotar o compromisso. Uma intervenção abstrata pode dissuadir uma rivalidade imediata, sem corpo ou física de combate. Relações e objetivos são persistidos por eventos e replay.

Ficam fora desta etapa corpo, romance, mapa novo, instituições e personalidade completa. A UI v1 não foi migrada. O lote reservado da condição 1a não foi usado para calibrar o 1b. Testes, fixtures e falhas de implementação estão em MARCO1B-EXECUTION-NOTES.md.
