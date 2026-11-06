# Registro de execução — ajustes e Marco 1b

- Antes de alterar as regras, foi preservada uma cópia do motor anterior e medida a distribuição antiga nos lotes `livre-000..099` e `reservado-1a-000..099`. Hashes das fontes e resultados por seed estão em `MARCO1A-BASELINE.json`. Os resultados reservados não foram usados para escolher pesos.
- A primeira verificação nova teve 2 testes passando e 1 falhando: um objetivo com pedido pendente ainda encerrava por perdão no mês 4, antes do reencontro. Foi incluído o compromisso de aguardar nos fatores de utilidade da espera, mantendo perdão como alternativa independente.
- A regressão existente de 21 testes passou na primeira execução com a separação de ações.
- O relatório agora constrói um DAG de episódios antes de medir profundidade. O log original e todos os membros de cada episódio continuam disponíveis para auditoria.

Os resultados finais estão registrados abaixo.

- Um teste extra de interação amizade → proteção falhou porque a fixture alterava a chegada do agressor, mas preservava uma agenda periódica que o mantinha ausente. Sem ameaça, o motor corretamente não criou proteção. A fixture foi corrigida para tornar explícita a presença no mês 4; nenhuma regra ou desfecho livre foi alterado para passar no teste.

## Verificação final

- `npm run build`: passou.
- `npm test`: **46 testes passaram, zero falharam e zero foram pulados**, em 7 arquivos. Inclui 100 seeds legadas, 100 da vingança e 100 pessoais.
- Ajustes de acordo: 200 mundos (100 atuais e 100 reservados) sem erros de validação, com comparação completa e resultados por seed. Os pesos não foram calibrados contra o lote reservado.
- No lote atual, reconciliações foram de 0 para 24 e desistências de 70 para 36. No reservado, de 0 para 14 e de 53 para 23. Não houve categoria a 70% na nova distribuição. As demais contagens estão no relatório 1a; não houve quota de resultados.
- Treino/rotina são colapsados antes de calcular profundidade. Exemplo `livre-056`: 143 elos brutos e 19 após colapso. Um teste sintético mantém profundidade 3 ao passar de 1 para 24 períodos consecutivos. Esse teste é isolado de apresentação, não um mundo gerado.
- Marco 1b: 100 seeds livres válidas. Amizade: 578 cumpridas, 82 frustradas e 653 abandonadas. Proteção: 19 cumpridas e 1.351 frustradas, sem abandono. São objetivos, não mundos.
- A proteção apresenta **98,6% de falhas** e isso é uma limitação de qualidade real: a adoção é ampla, enquanto a única resposta protetora implementada é intervenção direta individual, frequentemente sem capacidade suficiente. Próxima proposta, não aplicada: avaliar plano/capacidade e permitir pedir apoio ou coordenar proteção; não mudar desfechos por quota nem esconder compromissos frustrados.
- Duas fixtures independentes do lote livre passaram: proteção com ameaça conhecida e intervenção que mantém o alvo vivo; amizade com três convites aceitos e confiança bilateral. Os logs estão em `reports/marco1b/`.
- Um teste metamórfico adicional demonstra causalidade entre objetivos: a amizade efetivamente construída motivou proteção; retirar a oportunidade de formar esse vínculo fez o alvo morrer na mesma ameaça.
- Chromium/Web Worker real: fixture de vingança e perfil `pessoal-1b-000` concluíram sem erros, com 19 mensagens de progresso cada; o perfil novo retornou 10 histórias pessoais. Medições aproximadas de 1,20 e 1,13 s em execução local concorrente. Não são medições do computador da faculdade.
- Checkpoints incompletos de versões de regras antigas são recusados em continuação, sem impedir leitura de históricos completos. Isso evita misturar regras novas com log antigo silenciosamente.
- UI e mapa continuam v1. Sem corpo, romance, catálogo completo de personalidade, commit, push ou publicação desta etapa. O trabalho para aqui para revisão.
