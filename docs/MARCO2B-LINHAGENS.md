# Marco 2b — proposta original e implementação mínima

**Estado atual:** fatia autorizada e implementada. [Modelo e limites](MARCO2B-MODELO.md), [relatório](MARCO2B-REPORT.md). A pesquisa da wiki foi dispensada; os trechos abaixo são o histórico da proposta, não condições pendentes.

**Recomendação:** corpo/ferimentos/tratamento no Marco 2; família, nascimento, desenvolvimento, envelhecimento e morte natural no **2b**; culturas, assentamentos e instituições políticas no **3**. Não deixar a genealogia para depois das civilizações: elas devem se formar a partir de pessoas com passado, gerações e responsabilidades reais. Esta é uma proposta, sem código novo de simulação.

## Sequência e contratos

| Etapa | Conteúdo | O que deixa para a próxima |
|---|---|---|
| Marco 2 | Corpo funcional, ferimentos, cuidados, sequelas, morte física e kill list factual. Ponte com emoções/objetivos do 1d. | Não simula ainda reprodução ou uma sociedade completa. |
| Marco 2b | Parentesco, domicílio/guarda, nascimento, desenvolvimento, envelhecimento, morte natural, genealogias e balanço populacional. | Não cria automaticamente dinastias, reinos ou sucessão política. |
| Marco 3 | Pessoas/famílias/coortes formam assentamentos, culturas, grupos e instituições. | Sucessão política usa genealogias anteriores; custódia/herança de artefatos depende do sistema de objetos correspondente. |

**Família:** separar pais biológicos, responsáveis sociais, parceria e domicílio. Toda ligação tem início, origem e reconhecimento; irmãos derivam de filiação, não de nomes iguais. Registros fundadores podem ter pais desconhecidos: não inventar ancestrais. Filiação factual do mundo e informação conhecida pelos personagens são coisas diferentes. Não usar só amizade alta como condição suficiente para criar uma família.

**Nascimento:** elegibilidade reprodutiva por espécie, idade, capacidades e relações entre adultos; concepção e nascimento são processos abstratos agendados. Um nascimento cria identidade, corpo compatível com idade, filiação e responsáveis, todos com causas anteriores. Gestação não garante nascimento vivo. Evitar gerar adulto pronto com memória de uma infância que nunca foi simulada. Perda gestacional e morte infantil exigem causas e reações informadas, sem exploração narrativa automática.

**Desenvolvimento:** fase infantil, juvenil, adulta e idosa muda capacidades e elegibilidade. Criança não recebe ações adultas por herdar atributos. Aprendizado e vínculos decorrem de tempo, contato e cuidado. Traços não são cópia exata dos pais; parâmetros hereditários, experiências e RNG devem ser separados e auditáveis. O corpo do Marco 2 fornece a base para crescimento e declínio.

**Envelhecimento e morte natural:** idade avança pelo calendário; processos de deterioração têm parâmetros por espécie e prazos. Não sortear morte nova sem causa a cada decisão nem matar todos em um aniversário fixo. Registrar condição causal, morte única e cessação de ações; fonte natural aceita responsável/arma nulos e não incrementa kill list de um agressor antigo. Ferimento antigo só continua atribuído se sua cadeia causal justificar a morte. Familiares reagem depois de testemunhar ou receber notícia. Órfãos e dependentes requerem nova decisão de guarda, não tutela onisciente automática.

## População e custo antes do Marco 3

O benchmark 100×100 é só computacional: o motor 1d ainda não nasce nem envelhece, e seus 100 fundadores sobreviventes podem ficar com mais de 100 anos. Portanto não demonstra genealogias ou equilíbrio demográfico.

No 2b, proponho antecipar o balanço demográfico de coortes antes previsto para o 3, sem economia/civilização completa. Moradores anônimos usam contagens por idade/estado; pessoas identificadas preservam genealogia individual. Um registro genealógico identificado pode receber atualização biológica agendada sem IA social contínua; continua identificável e não é somado também à coorte anônima. A categoria e qualquer transição ficam explícitas. Esta distinção é proposta a avaliar, não uma otimização já implantada.

Conservação: `população final = inicial + nascimentos − mortes + entradas − saídas`, com contagens identificadas e anônimas reconciliadas. Ativar IA social detalhada não cria uma pessoa extra nem inventa memórias passadas. Atingir o orçamento de agentes não apaga parentes vivos ou mortos, não impede biologicamente o nascimento por conveniência e não fabrica genealogia para alguém promovido de coorte.

## Aceitação antes de abrir o Marco 3

- Gerar pelo menos três gerações com pais anteriores aos filhos, identidade estável, intervalos biológicos possíveis, ascendência acíclica e guarda coerente.
- Nascimento/morte fecham o balanço e não duplicam registros; morto não age nem participa de concepção posterior.
- Mesma seed reproduz genealogia, idade, causas e conhecimento; impedir uma concepção impede aquela descendência sem trocar IDs dos não envolvidos por deslocamento de RNG global.
- Morte natural não cria kill artificial; morte por sequela preserva atribuição quando demonstrada. Notícia bloqueada impede luto por morte desconhecida.
- Medir novamente 100 agentes ativos por 100 anos **com** nascimentos, saídas, registros genealógicos e corpos. Não extrapolar o custo do 1d para esse cenário.

Pesquisa dispensada pelo usuário. Regras próprias marcadas como suposições; nenhuma nova consulta é necessária. Parada após o relatório do Marco 2b, antes de civilizações.
