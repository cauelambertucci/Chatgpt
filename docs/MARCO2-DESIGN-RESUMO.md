# Marco 2 mínimo — modelo e loop implementados

**Suposição de design, não verificado.** O usuário dispensou a pesquisa da wiki e autorizou esta fatia. [Fontes/limites](MARCO2-FONTES.md). Este resumo substitui a proposta anterior; a versão PDF acompanha este modelo atualizado.

## Dados

| Registro | Estado e contrato |
|---|---|
| Catálogo humanoide | 12 partes conectadas; tecidos de membros, tronco e cabeça. Compartilhado e imutável. Partes intactas são derivadas do catálogo. |
| `Body` | Pessoa, sangue, dor, consciência, relógio clínico, arma e armadura. Separado da pessoa; não contém cópia da árvore anatômica. |
| `Part` | Apenas partes alteradas: presença, função nervosa, osso e último evento. Ausência de conexão inutiliza descendentes; a outra mão pode continuar funcional. |
| `Wound` | Dono, parte, agressor, arma, duelo, fonte, sangramento, perda acumulada, fratura, lesão nervosa, amputação, cuidado, prazo e sequela. |
| `PhysicalGoal` | Objetivo marcial, requisitos de preensão, viabilidade, adaptação/abandono e períodos de prática. |
| `Duel` | Participantes, decisão de iniciar/aceitar, instante inicial, feridas, término e desfecho. |
| `Kill` | Chave única por vítima; morte factual, causa principal, ferida, arma, parte e responsável. Não confunde morte posterior externa com morte deste duelo. |
| Pessoa/lugar | Conhecimento de lesão aguda/permanente, habilidade médica; material finito de cuidado no lugar. Personalidade e valores vêm do 1d. |

O log compacto conserva eventos, deltas, causas e decisões. As substituições temporárias de entidades são convertidas em patches no armazenamento; sangramento não copia pessoa ou corpo anatômico completo. Replay e retomada mensal são determinísticos. Não foram adicionados índices de agentes ou caches de decisão.

## Loop

1. Inicializar corpos e materiais. Avaliar intenção/aceitação do duelo e elegibilidade do equipamento; sem arma não há golpe nesta fatia.
2. Até seis trocas: verificar arma, conexão, preensão e consciência; comparar ataque/defesa; escolher parte presente; consumir orçamento de contato na armadura e nos tecidos. Uma lâmina cortante e três opções de armadura (nenhuma, couro, malha).
3. Criar ferida e alterar somente os registros afetados. Soltar arma incompatível. Registrar percepção própria ou testemunhada; lesão vital que elimina consciência não produz percepção própria posterior.
4. Percepção → emoção do 1d → estresse → transformação (quando aplicável) → reavaliação explícita de objetivo. Bloquear informação impede a reação à lesão desconhecida. Notícias posteriores exigem emissor informado e presença.
5. Saltar aos limites clínicos: cuidado, coagulação ou morte. Cuidado exige presença, consentimento, mãos funcionais, habilidade, ferramentas e bandagens; pode falhar. Morte única interrompe ações; a ferida que mais contribuiu à hemorragia fundamenta a atribuição principal.
6. Por mês, agregar reabilitação em um evento por período; resolver prazos de recuperação (dois/seis meses), registrar sequela e nova percepção. Colapsar períodos repetidos antes de calcular profundidade causal no relatório.

A fixture fixa contato de 100 U no antebraço, couro, 6 mL/min e cuidado aos 5/15 minutos. Sangue 5000→4970→4958 mL; preensão 1→0,4→0,7 após cuidado e reabilitação. Sem cuidado há morte no minuto 335. São unidades e regras de jogo, não medicina real nem reprodução confirmada de Dwarf Fortress.

## Limites e próxima etapa

Sem infecção, regeneração sanguínea, desgaste de armadura, múltiplos modos de ataque, locomoção detalhada ou demografia. Sangue é uma reserva fisiológica; não substitui lesões e funções por HP global. A regra de lesão nervosa sem coagulação espontânea torna este protótipo letal e deve ser avaliada separadamente, sem quotas de desfecho. A proteção abstrata anterior ainda precede os duelos no cenário amplo.

A avaliação usa 100 seeds livres e 100 reservadas, sem regeneração seletiva; três exemplos são escolhidos depois de gerar o lote completo. Testes e benchmarks constam do [relatório](MARCO2-REPORT.md). Família, nascimento, envelhecimento e morte natural continuam propostos para o [Marco 2b](MARCO2B-LINHAGENS.md), antes das civilizações do 3. **Parar ao final desta fatia.**
