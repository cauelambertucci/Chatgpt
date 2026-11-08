# Narração e diagnóstico emocional após o 2d-1

## Resultado

A narração foi reorganizada por fase/tema e momento, com variação determinística por ID. O motor não foi alterado. Há saturação emocional persistente em uma minoria; olhar apenas os sobreviventes esconde esse efeito. Não há predominância universal de luto irado.

As [três biografias completas](BIOGRAFIAS-2D1-REESCRITAS.md) reutilizam Elian, Alda e Syl e os mesmos registros do relatório anterior. As fontes de cada parágrafo permanecem acessíveis em “Por quê?”. Títulos como “Caderno sobre a morte de Runa” são apresentação derivada do tema conhecido; o log histórico não foi reescrito.

## Contrato da apresentação

Origem, juventude, ofício e obras, família, perdas e ferimentos, velhice aparecem quando há fatos. Um momento fica inteiro em um parágrafo, mesmo quando contém fatos de mais de um tema; dentro de cada seção a ordem é temporal. Fundadores não recebem infância inventada. Variação de sintaxe usa hash do ID, sem RNG do motor.

Mudanças menores são qualitativas. Limiares de diferença absoluta para números na explicação: faceta 10, valor 20, estresse 100. Na prosa, o estresse é descrito por direção; variação zero não produz frase. Isso não esconde os dados do diagnóstico. Lideranças coletivas resumem o resultado; os participantes completos continuam na explicação causal. Notícias e reações no mesmo momento são agrupadas, conservando todos os IDs de origem.

## Método

Exatamente dez seeds consecutivas fixadas antes da execução: `saturacao-2d1-000` até `009`, 40 fundadores, 100 anos, regras 2d-1 intactas, sem quota ou seleção posterior. Foram observadas 783 pessoas: 219 vivas no final e 564 mortas. A duração em cada faixa conta apenas meses simulados em vida, excluindo infância anterior ao início e tempo após a morte. Distribuição de luto é por evento, não por pessoa. Estes dados descrevem este lote, não uma estimativa universal.

Dados compactos por pessoa: [JSON](SATURACAO-2D1-DADOS.json). Agregados, resultados por seed e trajetória suplementar de Alda: [resumo JSON](SATURACAO-2D1-RESUMO.json). Alda vem de um mundo já gerado (`reservado-2b-006`), analisado separadamente; não é uma 11ª seed nova.

### Distribuição de rancor

| Faixa | Vivos ao final | Último estado dos mortos |
|---|---:|---:|
| 0–24 | 4 | 102 |
| 25–49 | 95 | 180 |
| 50–74 | 104 | 162 |
| 75–89 | 16 | 70 |
| 90–99 | 0 | 39 |
| 100 | 0 | 11 |

Mediana dos vivos: 52; dos mortos: 49,5. Uma pessoa já começou com rancor 100; outras dez chegaram a esse valor.

### Distribuição de estresse

| Faixa | Vivos ao final | Último estado dos mortos |
|---|---:|---:|
| 0–249 | 176 | 382 |
| 250–499 | 33 | 83 |
| 500–749 | 10 | 62 |
| 750–899 | 0 | 14 |
| 900–999 | 0 | 5 |
| 1000 | 0 | 18 |

Mediana dos vivos: 26; dos mortos: 116. Nos vivos adultos de 18–59 anos, estresse médio 81,3; nos de 60+, 196,8. A comparação é descritiva e não isola causalidade.

### Persistência enquanto vivos

| Estado | Pessoas com duração positiva | Pelo menos 10 anos contínuos | Maior período contínuo |
|---|---:|---:|---:|
| Rancor ≥90 | 50 | 47 | 92,75 anos |
| Rancor =100 | 11 | 8 | 53,92 anos |
| Estresse ≥900 | 36 | 20 | 51,33 anos |
| Estresse =1000 | 23 | 19 | 50,17 anos |

Portanto, há saturação localizada e duradoura: 19/783 pessoas passaram pelo menos dez anos consecutivos no teto de estresse, embora nenhum sobrevivente esteja no teto ao final. A fotografia final sozinha seria enganosa.

### Tipos de luto

| Causa registrada | Irado | Solidário | Temeroso |
|---|---:|---:|---:|
| Morte natural aos 68+ | 379 | 370 | 345 |
| Morte não natural | 0 | 1 | 2 |
| Perda gestacional | 31 | 34 | 15 |
| Sequela | 1 | 1 | 6 |
| **Total** | **411 (34,7%)** | **406 (34,3%)** | **368 (31,1%)** |

Percentuais arredondados. Nem todo luto vira irado; entretanto, o modelo trata a perda natural esperada sem modulação contextual e pode reforçar a mesma resposta repetidamente em uma pessoa.

## Alda e Mael

Alda (`person:17`, `reservado-2b-006`) teve cinco lutos, todos irados. Seu rancor inicial era 81 e terminou em 100. Ficou em 100 por 7,25 anos, não por décadas. Seu estresse terminou em **965**: passou 20,5 anos acumulados em 1000, com maior trecho contínuo de 5,92 anos. Ficou em 900+ durante 59,67 anos acumulados, com 32,33 anos contínuos. A impressão de décadas no teto confunde faixa alta, teto exato e duração acumulada; a biografia anterior também omitia recuperações de rotina entre perdas.

Mael (`person:01`) sofreu o ferimento `wound:event:12589`, criado em `event:12590`, ano 10, mês 10: **perna esquerda, lesão nervosa, sem fratura**. Alda prestou compressão e controlou o sangramento (`event:12606`, `event:12608`). A apresentação agora busca a localização na cadeia causal do ferimento atendido, sem inferir pelo corpo final ou confundir com Syl, cujo ferimento foi no antebraço direito. A sequela de Mael foi percebida no ano 11, mês 4.

## Causas encontradas no código

Em [emotions.ts](../src/engine/v2/emotions.ts), `appraise` compara rancor/agressividade/vingança com compaixão/paz/autocontrole e ansiedade/cautela. Não recebe causa, idade da vítima ou expectativa da perda. A resposta irada aumenta rancor e vingança, criando reforço persistente; não há adaptação que reverta esse aumento.

Em [engine.ts](../src/engine/v2/engine.ts), `needsPeriod` atende apenas a fase adulta: os idosos ficam fora dessa rotina. **Já existe recuperação**: a rotina desconta 8, ou 45 em repouso, mas a pressão pode superar o desconto. Ações de crise ainda podem diminuir estresse em idosos: recuperação reduz 80; outras respostas reduzem 35. Essas ações competem com outras decisões. Logo, o problema não é ausência absoluta de recuperação, e sim cobertura e equilíbrio entre pressão, recuperação e reforço.

## Proposta — não aplicada

1. Incluir rotina de necessidades e recuperação apropriada à velhice; testar essa correção isolada antes de mexer em taxas.
2. Testar recuperação proporcional lenta como alternativa (por exemplo, candidato de 2% ao mês), preservando pressão atual e impacto agudo de perda. Esse valor não foi calibrado nem aprovado.
3. Modular perdas naturais esperadas apenas quando o observador conhece causa e idade: menor impacto agudo e menor mudança permanente, sem proibir luto irado nem conceder conhecimento global.
4. Avaliar limite de transformação persistente por tipo/janela de perda ou adaptação gradual, mantendo emoções agudas e sem quotas de desfecho.

Uma futura ablação deve separar cada ajuste, repetir estas dez seeds e usar dez reservadas, comparando duração em vida, mortos e sobreviventes. Nenhum desses ajustes ou novos lotes foi executado agora.

## Verificação e reprodução

- Build de produção e 22 testes unitários da apresentação passaram.
- Chromium: 39 verificações nas três biografias existentes, incluindo causas e layout móvel, sem nova geração.
- As dez trajetórias fecham com o estado final; lutos por pessoa fecham com o total; duração nunca excede a vida observada.
- SHA-256 dos 42 arquivos do motor conferido contra o início desta tarefa: nenhum alterado.

Para repetir o diagnóstico: `node scripts/emotional-diagnostic.mjs` (requer Node e Python 3; executa apenas dez seeds). `--resume` reutiliza os arquivos presentes em `reports/emotional-diagnostic/`; remova-os para medir novamente. Para apenas reagregar resultados existentes: `python3 scripts/summarize-emotional-diagnostic.py`. Arquivos brutos locais são ignorados pelo Git; os dados compactos estão nos links acima. O caso suplementar de Alda só entra no resumo quando seu arquivo local está presente.

O Marco 2d-2 não foi iniciado.
