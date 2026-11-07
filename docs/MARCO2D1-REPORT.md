# Marco 2d-1 — objetivos, Criador e Cuidador

Entrega para revisão; parada antes do 2d-2. Interface Leve: **40 fundadores, 100 anos**. Regras ficcionais são suposições de design, não verificadas. Sem fome, novas cadeias de produção, reputação ou ensino.

## Comportamento entregue

- O cenário `dailyScenario` mantém genealogia, corpo, gestação, envelhecimento e fertilidade 2c, e religa amizade, proteção, obra e coordenação. Versão `agents-slice-2d1`; o cenário 2c continua disponível para comparação. Objetivos não são copiados dos pais. Adultos e idosos podem agir; crianças não recebem ofício nem votam. Quórum considera adultos/idosos vivos e presentes.
- Sorteios são funções de seed e chave, sem gerador global consumível. Ofício, contato de amizade e decisões por ação têm domínios explícitos `2d1:occupation`, `2d1:friendship` e `2d1:decisions:<ação>`. As chaves independentes já existentes de demografia/corpo são preservadas. Isso separa sorteios, mas não promete população idêntica: decisões mudam estresse, vínculos e oportunidades causalmente.
- Criador, Cuidador ou sem ofício são escolhidos por utilidade: habilidade, valores, facetas, capacidade da tarefa, necessidade presencial de cuidado, oportunidade material conhecida e custo de trocar. Escore e alternativas constam em `occupation.changed`. Um nome de ofício não garante produção ou tratamento.
- Escrita usa destreza ponderada das duas mãos (75% direita, 25% esquerda, hipótese de dominância desta fatia); requer capacidade ≥0,5. Compressão usa a melhor preensão e exige ≥0,5, consciência e condições já modeladas pelo corpo. Ausência de um segmento conectado afeta a mão. Sequela na perna não torna automaticamente impossível escrever. Não há sistema de reaprendizagem da mão nesta etapa.
- Um cuidador presente é selecionado por habilidade, compaixão, solidariedade, capacidade e disponibilidade. A oportunidade causa reavaliação de ofício; a pessoa ainda pode não assumir cuidado. O corpo verifica consentimento, disposição e ataduras. O mês usado na oferta de cuidado não produz também uma ação mensal de escrita/rotina. Materiais médicos e coagulação são os já existentes no Marco 2.1.
- Cada um dos 40 domicílios fundadores declara **6 papéis e 4 tintas**, total inicial 240/160. Não há reposição nem crédito de material por nascimento. Descendentes usam seu domicílio registrado. Cada livro consome 3/2 no início e exige seis períodos efetivos. Fracasso não restitui insumos incorporados. Após descobrir estoque insuficiente, a pessoa não reabre projetos enquanto aquela fonte de estoque não mudar.
- Nesta fatia os temas são **mortes conhecidas**. O projeto aponta para a morte real e para o recebimento anterior da notícia pelo criador. Não consulta o arquivo mundial como conhecimento pessoal. Conserva criador, qualidade, materiais, dono e causa da conclusão; transferência por presente exige vínculo conhecido e decisão registrada. Na morte do dono, registra espólio; não inventa herdeiro.
- Ficha e prosa mostram ofício, obras, qualidade, dono/espólio, fontes e tentativas frustradas. Criação, início, transferência, mudança de ofício e cuidado têm “Por quê?”. Rotina permanece compacta e recolhida; efeitos são deltas imutáveis. Não há cópia de pessoa+corpo por novo evento do 2d-1.

## Benchmark pareado no Leve

Seed `benchmark-pre-m2-100x100-v1`, **reduzida explicitamente para 40 fundadores**, 100 anos em ambas as versões. Não comparar seus números diretamente ao antigo ensaio 100×100. Node: aquecimento de 12 meses, GC antes do cronômetro e três processos independentes por versão; construtor/avanço medidos sem validação, relatório ou outro lote concorrente. Exportação e hashes ficam fora do tempo do motor. Browser: Worker real, pico antes/depois da transferência, receptor imutável, encerramento do produtor e gzip em fluxo. Uma repetição Chromium por versão final. MB decimais; PSS pondera páginas compartilhadas, RSS é outra medida.

| Medida | 2c | 2d-1 |
|---|---:|---:|
| Motor Node, mediana | 11,13 s | 20,61 s |
| Faixa das 3 repetições Node | 10,50–13,80 s | 18,97–21,49 s |
| Maior RSS do motor Node | 376,43 MB | 444,49 MB |
| Maior RSS Node até JSON bruto/exportação | 431,73 MB | 521,87 MB |
| Motor Chromium | 9,69 s | 15,98 s |
| Pico PSS Chromium, incluindo transferência/exportação | 464,78 MB | 537,37 MB |
| PSS +20% — margem estimada, não medida | 557,74 MB | 644,84 MB |
| Eventos | 88.824 | 108.237 |
| JSON descomprimido | 26,78 MB | 38,63 MB |
| Exportação gzip Chromium | 3,23 MB | 5,53 MB |

Nesse ensaio, o motor e o ciclo de memória medido ficam abaixo de ~60 s/~1 GB. Não é garantia universal, nem medição do pico da interface com todos os painéis abertos. Os hashes de entidades e tamanhos JSON de Node/Chromium coincidem. [Node completo](MARCO2D1-BENCHMARK.json) · [Chromium completo](MARCO2D1-BROWSER.json).

O aumento inclui 3.561 pedidos e 3.561 respostas de coordenação, além de mensagens compartilhadas que passaram de 13.231 para 21.882. Há somente 99 mudanças de ofício e 60 períodos de escrita. Portanto a ampliação social já existente, e não apenas os dois ofícios, explica grande parte do volume adicional. Isso é atribuição por contagem de eventos, **não perfil de CPU**: não se afirma que contagem prove domínio do tempo. Não introduzidos índices ou cache de decisões para maquiar o orçamento.

## Três seeds fixas de exemplo

Escolhidas pelos acontecimentos já conhecidos dos relatórios anteriores, sem novas buscas grandes ou troca por resultado. Cada uma tem 40 fundadores/100 anos. Seleção de biografias dentro delas é intencional; não estima distribuição populacional.

| Seed | Eventos | Livros concluídos | Tentativas de obra bloqueadas | Cuidado por compressão | Amizades formadas | Trocas de coordenação |
|---|---:|---:|---:|---:|---:|---:|
| reservado-2b-006 | 126.909 | 17 | 8 | 1 | 2 | 0 |
| reservado-2b-011 | 101.458 | 14 | 7 | 0 | 0 | 0 |
| reservado-2b-028 | 89.227 | 12 | 6 | 1 | 1 | 2 |

Zero erros finais de auditoria causal/demográfica/material/propriedade; replay idêntico nas três. Proteção está ligada e tem teste de integração com ameaça conhecida, mas **não houve avaliação de proteção nessas três seeds livres**; não se fabricaram ameaças para preencher o relatório. Os livros encontrados retratam mortes reais conhecidas na comunidade, sem obra sobre perda familiar do autor nesta amostra. Limites do estoque inicial restringem projetos posteriores.

Os arquivos JSON dos exemplos têm respectivamente 47,14 / 35,06 / 30,21 MB; gzip Node 7,19 / 4,56 / 3,93 MB. São dados suplementares, não novas medianas do benchmark. [Resultados por pessoa e fontes](MARCO2D1-EXEMPLOS.json).

## Três biografias selecionadas

**Elian — reservado-2b-006.** Integrava os fundadores aos 31 anos. Iniciou um livro sobre a morte conhecida de Runa no ano 36, mês 5, e o concluiu no mês 10, qualidade 71/100. Entregou-o a Tala. Depois escreveu sobre a morte de Bram, concluindo outro livro no ano 38, mês 3, qualidade 75/100, também entregue a Tala. No ano 40, tentou outro projeto e falhou por falta de papel ou tinta; houve raiva registrada e alteração de facetas/valores. No mês seguinte passou de Criador a Cuidador. Morreu naturalmente aos 91 anos. Não se atribui parentesco entre Elian e Runa/Bram.

**Alda — reservado-2b-006.** Integrava os fundadores aos 18 anos e formou parceria com Mael. No ano 10, mês 10, ofereceu cuidado após o ferimento dele: aplicou compressão e controlou o sangramento. Mael sobreviveu à ferida, mas ficou com sequela na perna; tratamento não significou cura completa. Alda viveu até 91 anos, com perdas familiares e reações documentadas. Sua ficha liga a oferta, a avaliação de tratamento e as intervenções ao ferimento real.

**Syl — reservado-2b-028.** Era Criador. No ano 19, mês 9, o duelo com Zarek causou fratura e lesão nervosa no antebraço direito. Sua capacidade calculada de escrita caiu para 0,475, abaixo do requisito 0,5; deixou o ofício e ficou sem ofício viável. A sequela foi confirmada no ano 20, mês 3, seguida de percepção, luto temeroso e transformação. A mudança ocorreu no mês do ferimento, antes da confirmação posterior da permanência: não se inverte essa cadeia. Morreu naturalmente aos 79 anos.

[Biografias completas em prosa com IDs de fonte](MARCO2D1-BIOGRAFIAS.md) · [Seleção verificável](MARCO2D1-HISTORIAS.json). São três pessoas em duas das três seeds avaliadas; a 011 permanece no relatório, embora não tenha fornecido um dos três exemplos mais informativos.

## Testes, problemas encontrados e limites

A suíte dirigida de regressão passou em 76 testes, com três testes de lotes grandes excluídos. Acrescentados depois testes de elegibilidade/quórum adulto e integração de proteção. Na última execução específica: **9 testes do 2d-1 + 18 da interface = 27 aprovados**. Build aprovado. As fixtures cobrem material ausente, notícia bloqueada, limitação manual com preferências diferentes, RNG, conservação/replay, retomada e proteção alcançável. [39 verificações de interface](MARCO2D1-UI-CHECKS.json), usando os mundos auditados já salvos, sem novas gerações, incluindo “Por quê?” e tela móvel.

Ocorrências, sem ocultação:

1. Por erro de escopo, foi iniciada a suíte ampla; um teste legado executou **100 seeds do Marco 1c** antes da interrupção. Não eram seeds do 2d-1 e não foram usadas para selecionar biografias ou estimar seu desempenho. A suíte dirigida passou a excluir explicitamente lotes.
2. A revisão encontrou domínio RNG aplicado só a um lado do comparador de contatos; corrigido antes das medições finais e dos três exemplos. A adaptação de poder inicialmente permitia quórum infantil; corrigida e medida novamente.
3. A auditoria da seed 028 apontou duas “lideranças sem maioria”: o motor já usava adultos, mas o validador ainda incluía crianças. Corrigido o validador e acrescentada fixture que distingue os dois quóruns. Reauditados os dados salvos, sem regerar a seed: zero erros.
4. A fixture adicional de proteção inicialmente falhou por usar o catálogo antigo, incompleto, de personalidade. Foi adaptada ao catálogo completo sem mudar as regras livres; teste aprovado.
5. O sandbox bloqueou subprocessos do benchmark (EPERM); as tentativas sem resultados não entraram na tabela. O ensaio foi executado com processos isolados autorizados. O primeiro teste visual encontrou servidor local desligado; foi iniciado e as verificações passaram.

Nada do 2d-2 foi implementado. Ofícios ainda não têm reputação, aprendizagem ou produção de insumos. A dominância da mão direita é hipótese desta fatia. A entrega inclui só o livro do 1c e cuidado existente, não uma economia geral.

## Reproduzir

`npm run test:2d1` executa os testes pequenos. `npm run report:2d1` gera apenas as três seeds fixas e seus arquivos em `reports/marco2d1/`; depois `node scripts/render-marco2d1-stories.mjs` produz as biografias. `npm run benchmark:2d1` e `npm run benchmark:2d1:browser` devem rodar separados de testes/relatórios. O navegador exige Chromium e Playwright; o script aceita `CHRONICLE_PLAYWRIGHT_MODULE`. Os mundos grandes não são versionados; seeds, código e relatórios permitem reproduzi-los. Para testar no Codespaces, atualizar esta branch, iniciar `npm run dev` e gerar uma das três seeds acima.
