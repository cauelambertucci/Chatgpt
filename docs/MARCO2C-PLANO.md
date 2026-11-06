# Marco 2c — protocolo fechado antes de abrir os lotes de avaliação

Diagnóstico original: `linhagem-2b-000..099`, 12 fundadores, 100 anos, regras 2b intactas. 354 nascimentos; 711/1554 adultos formaram parceria; 268/459 parcerias nunca conceberam. TFT sintética agregada por idade: 0,702; fecundidade da coorte feminina nascida na simulação com janela completa: 0,536; idade média ao primeiro nascimento observado: 27,520 anos.

**Suposição de design, não verificado.** Ajuste candidato único: custo marginal de filho e divisor do desejo 60→30, máximo de preferência individual 3→5, limiar de utilidade 30→15. Com valores familiares adultos em torno de 47+47, a regra antiga só permite dois filhos; a nova permite três. O objetivo é permitir famílias maiores compensarem pessoas sem parceria/prole, em direção à referência aproximada de 2,1 por gestante. A regra depende apenas de valores, filhos e estresse individuais, nunca do total da população ou do resultado da seed. Não obriga concepção, parceria ou sobrevivência. Preferências de família negativas e desejo zero permanecem possíveis.

Não mudar chances de concepção/perda, intervalo, idades, papéis reprodutivos, parentesco proibido, parceria, valores dos filhos, estresse, mortalidade ou duelo. Não afrouxar restrições de parentesco para sustentar populações pequenas. Não garantir que este candidato atinja reposição; medir e registrar eventual insuficiência.

Avaliação pareada previamente definida: `demografia-2c-000..099` (novo) e `reservado-2b-000..099` (reservado da etapa anterior), cada qual nas regras antigas e candidatas, em 12, 40 e 100 fundadores: 1.200 execuções de 100 anos. O reservado já foi relatado no 2b, portanto é reservado para este ajuste, não um conjunto nunca observado historicamente. Nenhuma seed será substituída; erros/limites constarão nos resultados. As primeiras 12/20 pessoas mantêm a composição original; grupos adicionais vêm de sub-seeds fixas. Registrar número efetivo de fundadores.

A análise de barreiras é observacional: condições são lidas antes da avaliação anual, sem alterar decisões nem consumir RNG. Contagens simultâneas não são causas exclusivas. A ablação local identifica ocasiões em que remover uma única barreira tornaria a tentativa elegível; não estima nascimentos contrafactuais. Parcerias tardias sem janela fértil são separadas. Não se usa filhos/mulheres ao final como TFT: somar taxas específicas por idade com exposição mensal e apresentar também coortes completas e censura.

Performance isolada depois dos relatórios: mesma seed do benchmark 2b, 100 fundadores/100 anos, com e sem candidato; navegador real com snapshot/transferência/exportação. Nenhuma validação, ablação ou lote concorrente durante o cronômetro. Parar antes do Marco 3.

## Emenda de escopo solicitada durante a execução

Em 6 de novembro de 2026, após 1.029 resultados salvos, o usuário reduziu a avaliação de 1.200 para 1.050 mundos. Mantêm-se os 1.000 casos completos: 800 nas escalas de 12/40 fundadores e 200 no lote novo de 100 fundadores. A comparação reservada de 100 fundadores passa a usar as primeiras 25 seeds (`reservado-2b-000..024`) em ambas as regras, totalizando mais 50 casos. São 25 pares, não 50 seeds independentes.

O corte é por ID, não por desfecho ou ordem de conclusão. Alguns resultados antigos do reservado com IDs maiores já existiam; são preservados separadamente em `MARCO2C-EXTRAS.json`, fora da comparação pareada. Nenhuma regra ou parâmetro foi alterado. Esta é uma emenda durante a execução, não se apresenta a matriz reduzida como pré-registrada antes de observar qualquer resultado. A precisão do último grupo é menor; os demais grupos continuam com 100 seeds por regra. O diagnóstico original de 100 seeds, já concluído antes do candidato, permanece separado.
