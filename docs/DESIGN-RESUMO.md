# Chronicle World — modelo atual em uma página

**Estado:** motor experimental até o 1d; UI/mapa v1. Sem corpo. Consulta direta da wiki ainda pendente.

| Registro | Modelo e responsabilidade |
|---|---|
| Mundo | Seed, versão, cenário, calendário, fila transitória, log imutável; 20 agentes e até 240 meses. |
| Pessoa | 30 facetas 0–100; 20 valores −100–100; habilidades, conhecimentos, memórias, vínculos, objetivos e procedência de cada mudança. |
| Psicologia | Estresse 0–1000; necessidades de segurança, descanso, vínculo e expressão 0–100; última emoção e prazo de isolamento. |
| Objetivo | Vingança, proteção, amizade, coordenação e obra; adoção, percepção, estimativa, progresso e encerramento com motivo. Proteção pode ser “resolvido por outro”. |
| Lugar/obra | Estoque, coordenação e registro público de incidentes por agressor; livro com criador, recursos, qualidade e tema conhecido. |
| Evento | ID/ordem, mês, tipo, participantes, causas anteriores, efeitos e decisão com escores/evidências. Emoção e transformação são eventos próprios com antes/depois. |
| Relatório | Replay sem RNG; profundidade após colapso de rotina, monitoramento e obra. Contabilidade mensal de necessidades remete às causas sem inflar elos; realimentação por outro evento separa os episódios para preservar o DAG. |

**Loop mensal:** encontros/ausências → atualização de necessidades do período anterior → reações informadas → elegibilidade → objetivos e ações possíveis → utilidades → resolução → eventos/efeitos → novas reações locais → checkpoint com fila drenada. Mesma seed, versão e cenário reproduzem o log.

**Emoções:** estímulo percebido (perda, ameaça, vitória, traição, fracasso) → avaliação por personalidade/valores → emoção/estresse → mudança pequena e registrada de faceta/valor → novas utilidades. Notícia bloqueada impede luto por perda desconhecida. Promessa política explícita precisa ser quebrada e percebida para haver traição. Vitória alivia estresse. Atributos saturados não geram transformação fictícia.

**Necessidades/crise:** rotina mensal, sem treino diário. Descanso/isolamento recuperam; interação aceita atende vínculo; escrita/observação atende expressão. Estresse ≥650 habilita isolamento por dois meses, hostilidade verbal a rival conhecido e abandono de um posto existente, com escolha conforme personalidade. Recuperação também compete. São regras ficcionais, não um modelo clínico.

**Proteção/reincidência:** percepção → estimativa antes da adoção → intervenção, aviso, aliado conhecido ou afastamento consentido. Quem presencia outro resolver sem contribuir encerra “resolvido por outro”, sem crédito próprio ou falha. Terceira ameaça do agressor leva a confronto, expulsão, perdão condicional ou pedido de acordo; nova infração após consequência leva à expulsão persistente (máximo quatro ameaças por agressor neste cenário).

**Outros objetivos:** acordo bilateral, perdão unilateral, amizade recíproca, poder por maioria, obra por seis períodos com material e tema conhecido. Pesos de proteção, amizade e obra congelados. Ranking penaliza adoção/desfecho no mesmo mês sem decisão intermediária; retorna menos de dez se necessário.

**Evidência e limites:** números e histórias reais em [MARCO1D-REPORT.md](MARCO1D-REPORT.md); falhas em [MARCO1D-EXECUTION-NOTES.md](MARCO1D-EXECUTION-NOTES.md). Dois lotes de 100 seeds sem quota; mortes continuam abstratas. Parada no 1d para revisão, sem publicação nem início do Marco 2.
