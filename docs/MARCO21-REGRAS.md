# Marco 2.1 — regras e limites

**Suposição de design, não verificado.** Regras próprias do jogo, sem alegação de fidelidade ao Dwarf Fortress ou à fisiologia real. A consulta da wiki continua dispensada. Esta revisão substitui as regras de sangramento e encerramento do Marco 2 mínimo; não inclui demografia ou Marco 2b.

## Sangramento e coagulação

Cada ferida registra `vessel`, `severity`, taxa e prazo `clotAt`, além da fonte do contato. O trajeto fornece uma aproximação vascular explícita:

| Trajeto / vaso aproximado | Gravidade | Taxa inicial | Coagulação espontânea |
|---|---|---:|---|
| Pele/músculo parcialmente atravessado → capilar | Leve | 2 mL/min | 5–20 minutos |
| Músculo inteiramente atravessado, sem amputação/órgão atingido → veia | Média | 6 mL/min | 40–100 minutos |
| Amputação ou contato com coração/cérebro → artéria | Grave | 18 mL/min | Não ocorre neste recorte; exige cuidado |

Prazo determinístico por seed, ID semântico do duelo e troca. A classificação é grosseira: não há árvore vascular detalhada, tamanhos de vasos ou trombose. Gravidade e vaso estão associados nesta primeira regra; não são diagnósticos médicos. `vesselOverride` só é usado pelos testes controlados, nunca nos lotes livres.

**Dor, nervo e capacidade não definem a taxa nem impedem a coagulação.** Uma ferida com lesão nervosa pode estancar e continuar dolorosa/incapacitante. O cuidado reduz a taxa e pode controlá-la antes do prazo espontâneo; estancar não regenera sangue, nervo ou membro. Dano vital ainda pode matar imediatamente. Hemorragia continua podendo matar depois da rendição/fuga/interrupção.

O motor salta entre limites clínicos, sem eventos diários/minuto a minuto. `blood.interval` registra volume perdido e IDs das feridas que coagularam. Estado persistido continua em deltas; nenhuma rotina nova copia pessoa ou árvore corporal. O calendário de reabilitação permanece mensal.

## Decisões de encerrar o duelo

Após cada troca não fatal, o ferido com mais dor decide primeiro, seguido do outro duelista e de terceiros em ordem de ID. Os candidatos devem estar vivos e presentes; terceiros precisam estar conscientes e não ter a informação bloqueada. A fixture numérica de um contato isola a fisiologia e não roda essas escolhas; os três lotes livres rodam todas.

`duel.observed` registra o testemunho e as fontes dos ferimentos visíveis. Perigo observado soma 10/30/60 por ferida visível leve/média/grave; é uma estimativa de jogo. O agente não lê o estresse ou a dor privada do adversário. O risco de intervenção considera arma visível, não habilidade secreta. O próprio agente usa seu estresse, dor e perda sanguínea atuais. `duel.choice` registra candidatos elegíveis, utilidades, escolha, papel, motivo e causas.

Utilidades (pesos fixados antes da avaliação dos lotes; nenhum limiar de distribuição):

- Continuar: hostilidade + coragem + orgulho + agressividade/2 − estresse/5 − dor − perda sanguínea/20.
- Render-se: cautela + estresse/4 + dor + perda sanguínea/15 − orgulho/2.
- Fugir: cautela + estresse/5 + dor + 20 − coragem/2 − honra/3. Exige pernas/pés conectados e função óssea/nervosa ≥ 0,5.
- Interromper, por duelista: compaixão + paz + 1,2 × perigo observado − hostilidade/2 + estresse/10.
- Terceiro interromper: compaixão + solidariedade/2 + paz/2 + perigo observado + estresse/10.
- Terceiro observar: 100 + cautela + risco de arma visível (0 ou 50) − coragem.

Escolhe a maior utilidade elegível; empate por ordem textual estável. A primeira escolha de saída encerra as trocas. O motivo identifica rendição, fuga ou interrupção pelo agressor, desafiado ou terceiro; também registra se o autor estava ferido. A regra anterior de rendição por limiar fixo de dor foi retirada.

**Convenção explicitamente assumida:** este é um duelo consentido; rendição e pedido de interrupção são respeitados. Não há recusa da rendição, perseguição ou intervenção física disputada nesta fatia. Fuga significa afastar-se do perímetro de combate; o agente permanece no lugar abstrato e ainda pode receber cuidado. Um primeiro golpe vital pode ocorrer antes de qualquer decisão entre trocas.

## Compatibilidade e avaliação

Versão `agents-slice-2.1`. Logs 2a continuam legíveis/reproduzíveis como fatos; checkpoints incompletos 2a são recusados para continuação sob novas regras, evitando reinterpretação silenciosa. Checkpoints 2.1 preservam replay e retomada.

Mesmas seeds `duelo-2a-000..099`, `reservado-2a-000..099`, mais `novo-21-000..099`. Sem rejeição, substituição ou repetição para preencher categorias. Motivo de encerramento e desfecho clínico são contados separadamente. [Resultados e orçamento](MARCO21-REPORT.md).
