# Registro de implementação — pré-condições e Marco 1c

- Baseline do motor anterior preservada antes das mudanças, nos lotes `pessoal-1b` e `reservado-protecao`, 100 seeds cada. Parâmetros foram definidos antes de inspecionar o reservado; sem quota.
- Auditoria do exemplo antigo: 49 elos = 44 blocos de rotina e 5 outros eventos. O motor não emitia monitoramento periódico separado; a fragmentação vinha principalmente da alternância treino/espera. Foram ampliados o colapso e os metadados de monitoramento.
- Primeiro build falhou por inferência do literal de efeito após acrescentar monitoramento; corrigida a tipagem, sem alterar regras.
- Primeira regressão teve 7 falhas: registro de nova versão incompleto no validador e duas expectativas antigas que exigiam morte mesmo quando novos avisos/afastamentos permitem resgate. Validador atualizado; testes passaram a medir agência daquele protetor e a ausência de intervenção direta após perder capacidade, sem proibir a alternativa autorizada.
- A fixture de proteção direta foi isolada de familiares que agora também podem avisar, para continuar testando especificamente o guardião; nenhum cenário livre foi alterado por isso.
- Um teste novo confundiu estimativa inicial com a última reavaliação do compromisso. O teste agora inspeciona o efeito imutável do evento de adoção; reavaliações posteriores continuam registradas, sem reescrever o passado.

- A comparação inicial mostrou ainda muitos compromissos redundantes: taxa de falha de aproximadamente 85,6%, mas mortes muito menores. A análise separa falha por compromisso de mortalidade.
- Foi corrigida a atribuição de contribuição em apoio conjunto: um aliado que realmente participou do resgate também recebe a contribuição no seu próprio compromisso, quando existente. Não se concede crédito a quem apenas presenciou o resgate. Essa correção de consistência foi aplicada aos dois lotes, sem mudar pesos por resultado reservado.

- 1c: acrescentados catálogo de 30 facetas/20 valores, escores detalhados, campanha por maioria e produção de livro com material/tema conhecidos. Os primeiros sete testes de 1c passaram.
- A faixa negativa de valores foi verificada: parentesco sozinho não força compromisso de proteção no perfil maior quando família/solidariedade e avaliação pessoal são contrárias. Essa regra só afeta o 1c, não a comparação do 1b.
- Um teste de falta de material usa agora parâmetros de origem declarados (`materials`), em vez de alterar um checkpoint sem evento; o cenário negativo também passa no validador.
- Respostas reativas com aceitação/recusa registrada contam como decisões intermediárias no ranking, além das ações agendadas.

## Resultado final

- `npm run build`: passou. `npm test`: **66 testes passaram, zero falharam e zero foram pulados**, em 9 arquivos. Inclui lotes de 100 seeds da vingança, proteção/amizade, perfil completo e versão legada; fixtures, metamórficos, replay e retomada.
- Proteção, lote atual: 1.370 → 1.283 compromissos; 19 → 193 cumpridos; 1.351 → 1.090 falhos; falha **98,6% → 85,0%**; mortes **127 → 15**. Houve 152 recusas de adoção por estimativa inviável.
- Proteção, reservado: 1.349 → 1.269 compromissos; 22 → 188 cumpridos; 1.327 → 1.081 falhos; falha **98,4% → 85,2%**; mortes **131 → 20**. Houve 12 recusas de adoção. Não há quota.
- Das falhas residuais, 979 no lote atual e 948 no reservado têm responsável e alvo vivos e nenhuma contribuição própria. A definição é estrita: adotar/observar não basta. Portanto taxa por compromisso não é taxa de mortes. Redundância e coordenação de responsabilidades permanecem problemas de qualidade.
- Ameaças aumentaram de 256 → 1.089 e 293 → 1.078: os avisos/afastamentos evitam mortes, mas abrigos temporários permitem retorno e novas tentativas do rival. Isso também precisa de planejamento mais duradouro, não de uma quota de desfechos.
- Auditoria histórica: 49 elos → 12; o antigo caminho tinha 44 blocos de rotina. O teste de 24 períodos de monitoramento mantém profundidade 3. Log bruto permanece intacto. Ranking conta apenas decisões/reações causalmente relevantes ao objetivo, penaliza encerramentos instantâneos sem decisão e não preenche dez posições artificialmente.
- O snapshot anterior foi preservado em `reference-baselines/marco1b-source.zip`, com SHA-256 na baseline. O log auditado também foi preservado em gzip, permitindo repetir a auditoria sem depender de relatórios ignorados pelo Git.
- Perfil 1c, 100 seeds válidas: poder 71 cumpridos/252 falhos; obra 411/36; proteção 152/225; amizade 35 cumpridas, 105 falhas e 474 abandonos. São objetivos, não mundos. As concentrações são sinalizadas; livros concluídos não equivalem a obras-primas, e vários candidatos disputam um único cargo.
- As duas fixtures novas passaram: eleição com maioria real e livro após seis períodos, com consumo de papel/tinta. Testes negativos cobrem recusa de votos, recursos ausentes, falta de criatividade e preferência contrária a poder; valores negativos não forçam proteção por parentesco.
- A execução do Worker sob carga concorrente chegou a aproximadamente 2,2 s. Foram removidas cópias completas do histórico que serviam apenas para progresso, com teste de equivalência. Medição final no Chromium: aproximadamente 0,35 s para a fixture e 0,53 s para o perfil 1c, 19 mensagens de progresso, 30 facetas e 3 obras, sem erros. Cargas eram diferentes: não usar esses números para afirmar um fator de aceleração controlado.
- O catálogo completo tem 30 facetas e 20 valores, todos ligados a utilidades com decomposição registrada. Isso ainda não inclui o sistema completo de necessidades/estresse e todas as transformações emocionais.
- Sem corpo, romance, novo mapa, UI migrada, commit, push ou publicação desta etapa. Parar no fim do 1c para revisão.
