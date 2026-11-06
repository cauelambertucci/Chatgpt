# Correções da interface v2 — revisão para o usuário

Motor e regras do Marco 2c preservados: 40 fundadores, 100 anos, perfil Leve deste recorte. Nenhuma implementação do Marco 3. Os 38 arquivos do motor v2 foram comparados byte a byte com a versão publicada anterior, sem diferenças; hashes e verificações estão no [resumo de checks](UI-V2-FEEDBACK-CHECKS.json).

## Histórico familiar e ficha

`FamilyHistory` percorre metadados de nascimento, registro de fundador, morte, guarda e parcerias. Não usa `Life.parents`, `Life.children`, `Life.partner`, `Person.alive` ou `Person.death` do estado final para reconstruir esses vínculos. Nomes permanecem associados às identidades existentes. Não expande efeitos do log.

- Todos os filhos biológicos são listados, incluindo mortos e mortes ocorridas depois da morte do progenitor, com ano de nascimento, estado, ano de morte e idade em anos completos. Nenhuma filtragem por sobrevivência. Ausência de data é mostrada como desconhecida, não como zero.
- Todas as parcerias têm parceiro, início, fim e motivo registrado. A morte da pessoa não apaga o histórico. Reatar com a mesma pessoa cria outro intervalo; ruptura e viuvez não são confundidas. Um intervalo sem fim documentado, mas com participante morto, não é apresentado como vigente.
- Pais biológicos e histórico de guarda são seções diferentes. Guarda ausente do log é apresentada como não especificada, com os pais conhecidos visíveis; não se afirma que esses pais eram automaticamente os guardiões.
- A árvore alterna ascendência, descendência e irmãos/parceiros. Cada nó mostra situação e anos de vida. Irmãos compartilham ao menos um progenitor; parceiros são de todo o histórico. Até três níveis são expandidos por ficha, com navegação para continuar; todos os filhos diretos também estão na tabela. Fundadores são raízes sem ancestrais fabricados.
- Homônimos recebem um identificador do registro de nascimento/fundação na apresentação. Isto evita atribuir duas mortes ou parceiros de pessoas diferentes à mesma identidade. Não é mudança de nome no motor.

## Prosa, conhecimento e causalidade

A biografia é organizada em parágrafos corridos com fontes consultáveis, cobrindo nascimento/filiação, parceiros, filhos, perdas, reações registradas, mudanças numéricas, ferimentos, sequelas e morte com idade/causa. A tabela familiar inclui toda a história; a biografia de vida termina na morte da pessoa. Não se atribuem percepções ou sentimentos só porque existe parentesco. Uma perda gestacional não vira nascimento ou morte de criança.

Notícias explicam qual fato foi sabido, a relação familiar conhecida e a fonte registrada: testemunho ou relato, com remetente quando o evento identifica quem transmitiu. Sem fonte, a interface declara a lacuna. O modelo não informa gênero: usa “pais biológicos”, “descendentes diretos” e “parceria”, sem deduzir mãe/pai a partir do nome.

Emoções só recebem uma causa textual se o evento de estímulo consta nas causas gravadas. A expressão emocional entre aspas vem do motor, não de adjetivação inventada. A avaliação de um duelo não é narrada como luta iniciada quando `started` é falso; o término usa o motivo registrado.

“Por que aconteceu?” abre primeiro um percurso causal principal em ordem cronológica. Referências explícitas de notícia/emoção/estímulo têm prioridade; relações como concepção→nascimento e ferimento→sequela também priorizam causas diretas existentes. Isto é seleção de apresentação, não nova regra do motor nem alegação de causa única. Outras causas continuam navegáveis. Necessidades, desenvolvimento e outras rotinas ficam recolhidos em **Contexto de rotina**. Percursos longos têm continuação, sem apagar eventos.

Todo tipo emitido pelo motor tem rótulo em português. O teste percorre as chamadas de emissão via AST, incluindo ramos condicionais, e falha se faltar rótulo. Os três mundos também verificam cobertura dos tipos efetivamente presentes. Códigos de tipo e JSON técnico foram retirados da explicação; um tipo desconhecido tem mensagem genérica na interface, mas reprova a validação.

## Somente três seeds

Seleção intencional a partir dos relatórios existentes: `reservado-2b-006`, `reservado-2b-011`, `reservado-2b-028`. Todas já tinham evidência de linhagem com sequela no 2b e medições no recorte de 40 fundadores/2c. Foram ordenadas por quantidade de eventos dessas medições; não se abriu um lote novo para procurar histórias. Cada mundo foi gerado uma vez nesta revisão; as correções de apresentação reutilizaram seus arquivos compactos. As histórias não são estimativas de frequência de desfechos.

Dentro de cada mundo, o ranking prioriza sequelas/ferimentos, viuvez e perda de filho durante a vida; pesos e candidatos constam no [JSON de validação](UI-V2-FEEDBACK-VALIDATION.json). Nenhuma seed foi substituída. As [três biografias integrais](UI-V2-FEEDBACK-BIOGRAFIAS.md) são Mael, Orin 0 e Syl: dois casos com sequelas e um com cinco viuvezes e duas perdas de filhos.

## Verificações

18 testes unitários: filhos vivos/mortos com estado final contraditório, datas/idades, guarda diferente de filiação, histórico de morte/ruptura/vigência, irmãos/gerações/ciclos, filtros, notícia/fonte/testemunho, emoção com causa explícita, rotina recolhida, prosa com fontes, ausência de fatos inventados, imutabilidade, duelo não iniciado, homônimos e catálogo completo.

As três seeds passaram pela auditoria demográfica, validação causal e replay idêntico. Build TypeScript/Vite aprovado. O teste de navegador reutiliza exatamente esses três mundos, com adaptador de Worker exclusivo do teste, e verifica tabelas, árvore, biografia e explicação causal sem gerar seeds adicionais. Foram aprovadas 77 verificações no Chromium, incluindo tela estreita sem transbordamento e ausência de erros JavaScript. [Resultados de navegador](UI-V2-FEEDBACK-BROWSER.json).

Durante a refatoração, o build identificou referências antigas aos campos de guarda/parceria final e inferências de tipo ambíguas no percurso causal; corrigidas antes da validação final. A revisão dos exemplos detectou homônimos e a narração indevida de avaliação de duelo como início garantido; ambos têm correção e teste específico.

Parada após estas correções e três exemplos. Sem sistemas novos do motor, nova calibração ou publicação do site.
