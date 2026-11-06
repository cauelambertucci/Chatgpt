# Exemplo numérico de golpe — fixture implementada no Marco 2 mínimo

> Histórico do Marco 2 mínimo. No Marco 2.1, a lesão venosa deste exemplo pode coagular sem cuidado; o ramo hemorrágico antigo de 335 minutos é preservado aqui como baseline, não como regra atual. Veja [regras 2.1](MARCO21-REGRAS.md).

**O trajeto e o cuidado abaixo agora são reproduzidos pela fixture `fixture-golpe-numerico`; ela é controlada, separada das histórias livres.** A seção emocional mantém um cálculo ilustrativo do 1d; não representa o estado acumulado final da fixture. Tudo é **suposição de design, não verificado**. Os valores de resistência, função, risco e prognóstico são parâmetros propostos de jogo. Não foram extraídos da wiki: o estado da pesquisa está em [MARCO2-FONTES.md](MARCO2-FONTES.md). Massa/área/volume têm unidades explícitas; o orçamento de contato é uma escala própria, não energia em joules.

## 1. Elegibilidade, defesa e trajeto

Agressor P2 usa W1: lâmina de 1.000 g, alcance 70 cm, contato de 50 mm²; capacidades necessárias presentes. A intenção é atingir o antebraço esquerdo de P1. Pontuação ilustrativa de ataque: `65 habilidade + 20 capacidade + 5 postura − 3 variação = 87`; defesa: `55 habilidade + 10 equipamento + 5 postura + 4 variação = 74`. Margem 13 permite contato no trajeto escolhido. A fixture fixa esses números; seeds livres usam variação determinística.

Neste contato, o trajeto alcança pele, músculo, um ramo nervoso e osso; não atravessa vaso de grande calibre. Isso não significa que todo golpe ou toda parte tenha essas estruturas na mesma ordem. Orçamento inicial: **100 U**, unidades de contato do jogo.

| Camada/estrutura atingida | U entrando | Resistência proposta | U consumidas | U restantes | Resultado deste trajeto |
|---|---:|---:|---:|---:|---|
| Roupa | 100 | 5 | 5 | 95 | Camada atravessada |
| Proteção de couro | 95 | 15 | 15 | 80 | Camada atravessada |
| Pele | 80 | 8 | 8 | 72 | Corte local |
| Músculo | 72 | 30 | 30 | 42 | Ferida localizada; não secciona todo o membro |
| Ramo nervoso interceptado | 42 | 12 | 12 | 30 | Ruptura local da estrutura |
| Osso | 30 | 60 | 30 | 0 | Não atravessa; índice 30/60 = 0,50 |

Se o limiar proposto de fratura nesse contato for 0,60, não há fratura. O orçamento consumido soma `5 + 15 + 8 + 30 + 12 + 30 = 100 U`; não se cria orçamento ao converter ou atravessar camadas. **Não há amputação:** uma trajetória que rompe um ramo nervoso não secciona automaticamente toda a conexão anatômica.

## 2. Ferida, cuidado e evolução

E1 registra a intenção; E2, a defesa; E3, o contato; E4 cria a ferida com P2/W1 como fontes factuais. P1 mantém a mão, mas sua capacidade de preensão esquerda cai, neste modelo ilustrativo, de 1,0 para **0,4**. Arma que exige 0,8 de preensão em cada mão fica inelegível; equipamento incompatível é solto por evento próprio. A mão direita permanece em 1,0.

Para demonstrar conservação de volume, adotar reserva inicial de **5.000 mL** e perda local de **6 mL/min**:

| Intervalo | Processo ilustrativo | Perda | Reserva ao final |
|---|---|---:|---:|
| 0–5 min | Sangramento antes do cuidado | 6 × 5 = 30 mL | 4.970 mL |
| 5–15 min | Cuidado bem-sucedido reduz taxa para 1,2 mL/min | 1,2 × 10 = 12 mL | 4.958 mL |
| Após 15 min | Controle do sangramento, taxa 0 | 0 mL | 4.958 mL |

O cuidado exige alguém presente, material e ação elegível. Não é efeito automático da adoção de um objetivo de proteção. Para uma demonstração do risco, uma exposição elegível poderia ter risco proposto de infecção de 0,15 sem limpeza e 0,05 com limpeza. Um sorteio ilustrativo 0,42 não gera infecção em nenhum dos dois casos; tratamento reduz risco, não garante resultado. Infecção não está implementada nesta fatia; esses riscos são apenas uma extensão ilustrativa, não um resultado do motor.

A ferida é reavaliada em prazos agendados. Neste exemplo, após reabilitação e 180 dias, a preensão recupera até **0,7**, e a limitação restante é reconhecida como permanente. A hipótese de prognóstico e o prazo são do exemplo, não uma afirmação de que toda lesão nervosa seja irreversível. O corpo registra função residual; a narrativa não apaga a ferida anterior. A arma de duas mãos ainda não atende o requisito 0,8/0,8; uma alternativa com requisito 0,5 pode tornar-se viável.

## 3. Ponte numérica com a transformação do 1d

O reconhecimento de permanência é um fato novo percebido, não uma reaplicação mensal da mesma perda. Identificar o episódio evita contar duas vezes diagnóstico e notícia idênticos. Enquanto inconsciente ou sem notícia de lesão alheia, o agente não recebe uma conclusão onisciente sobre prognóstico.

Usando **a fórmula já existente do 1d** para o estímulo `perda`, sensibilidade 60 e esperança 40 produzem `intensidade = round(45 + 60/3 − 40/5) = 57`; variação de estresse `4 × 57 = 228`. Partindo de 270, chega a **498**, abaixo do limiar de crise 650.

| Personalidade antes da perda | Avaliação do 1d | Transformação |
|---|---|---|
| A: rancor 80, agressividade 70, vingança 60; compaixão 20, paz 10, autocontrole 20 | Raiva 210; cuidado 50; ansiedade+cautela 50 → luto irado | Rancor 80→83; vingança 60→63 |
| B: rancor 10, agressividade 10, vingança 0; compaixão 80, paz 70, autocontrole 80 | Raiva 20; cuidado 230; ansiedade+cautela 50 → luto solidário | Compaixão 80→82; solidariedade 30→32 |

O estresse é **igual nos dois casos** porque sensibilidade/esperança e estado anterior são iguais; as transformações são diferentes. Não inventar diferença numérica que a fórmula do 1d não produz. Dor e necessidades crônicas terão atualização agregada no período do futuro corpo; não são motivo para emitir a mesma perda 12 vezes por ano.

O objetivo de voltar ao combate precisa de nova estimativa com preensão 0,7. P1 pode decidir adaptar equipamento, treinar outra técnica, buscar ajuda/reabilitação ou abandonar esse objetivo. A mudança de valor altera utilidades, mas não escolhe automaticamente vingança, profissão ou agressão. Neste ponto não houve crise: nenhuma resposta de crise deve ser forçada para tornar a história dramática.

## 4. Morte e kill list: trajetória principal e contraprova

**Trajetória principal:** P1 sobrevive; a kill list de P2 não recebe entrada. Sobrevivência com sequela não é morte nem “kill parcial”. E4 continua como fonte de ferida e eventual responsabilidade futura.

**Ramo didático sem cuidado:** supondo perda constante de 6 mL/min, sem interrupção espontânea, passos de 5 min e um limiar de morte proposto em 3.000 mL, no minuto 330 restariam 3.020 mL; no minuto 335, **2.990 mL**. Esse ramo emitiria uma única morte por hemorragia, com E4 como ferida causal e P2 como responsável primário. A lista acrescentaria P1 uma vez, mesmo que haja vários eventos de deterioração. O limiar e a linearidade são hipóteses de teste do jogo, não fisiologia humana estabelecida.

Se P1 sobreviver e muito depois morrer por envelhecimento sem ligação causal demonstrada com E4, a morte é natural, responsável nulo, e a lista de P2 continua sem essa vítima. Infecção tardia atribuível à ferida exige a cadeia explícita; falha de cuidado não transforma automaticamente o cuidador em assassino. Contribuições podem ser registradas separadamente sem duplicar a contagem principal.

**Verificação implementada:** camadas 100→95→80→72→42→30→0; sangue final 4958 mL com cuidado e preensão residual 0,7. Sem cuidado, a mesma lesão causa uma morte no minuto 335 e uma única entrada na kill list. Sem armadura, o orçamento que alcança o osso cruza o limiar de fratura. Ver testes em `src/engine/v2/body.test.ts` e resultados no relatório do Marco 2.
