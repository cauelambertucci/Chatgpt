# Proteção antes do 1c

## pessoal-1b — 100 seeds

| Métrica | Antes | Depois |
|---|---:|---:|
| adopted | 1370 | 1283 |
| completed | 19 | 193 |
| failed | 1351 | 1090 |
| declined | 0 | 152 |
| deaths | 127 | 15 |
| threats | 256 | 1089 |

Falhas por compromisso: 98.6% → 85.0%. Recusas de adoção e mortes também são mostradas para não ocultar mudanças de denominador.

## reservado-protecao — 100 seeds

| Métrica | Antes | Depois |
|---|---:|---:|
| adopted | 1349 | 1269 |
| completed | 22 | 188 |
| failed | 1327 | 1081 |
| declined | 0 | 12 |
| deaths | 131 | 20 |
| threats | 293 | 1078 |

Falhas por compromisso: 98.4% → 85.2%. Recusas de adoção e mortes também são mostradas para não ocultar mudanças de denominador.

Erros de validação: 0. O novo lote reservado não foi usado para escolher pesos; não há quota de sucesso. Estimativas são heurísticas registradas, não probabilidades calibradas.

Antes da adoção cada interessado compara capacidade própria, ameaça observada e planos disponíveis; registra estimativas e pode recusar compromisso inviável. Novas respostas: avisar, solicitar apoio conhecido e afastar com consentimento. Apoio depende da resposta do aliado, aviso/afastamento da resposta do alvo. Permanência em abrigo dura três meses e o retorno é explícito.

## Auditoria de profundidade

No log histórico pessoal-1b-000, os 49 elos incluíam 44 blocos de rotina, não 44 fatos importantes. Com agregação da alternância treino/espera, a mesma história tem 12 elos. O motor anterior não emitia monitoramento periódico separado. Agora a rotina agrega também os objetivos monitorados; quantidade de períodos e IDs são preservados e uma sequência de monitoramento não aumenta a profundidade por passar o tempo. Novas ameaças e decisões concretas continuam sendo fatos separados.

O ranking subtrai uma penalidade explícita quando adoção e desfecho são no mesmo mês e não há decisão intermediária. Não completa a lista com casos abaixo do limiar; retorna até dez.

## Interpretação das falhas residuais

pessoal-1b: 979 falhas restantes ocorreram com responsável e alvo vivos, sem contribuição própria. Outro agente pode ter evitado o perigo. O critério de êxito exige contribuição efetiva, não apenas adoção ou presença.

reservado-protecao: 948 falhas restantes ocorreram com responsável e alvo vivos, sem contribuição própria. Outro agente pode ter evitado o perigo. O critério de êxito exige contribuição efetiva, não apenas adoção ou presença.
