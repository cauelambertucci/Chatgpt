# Marco 2d — ofícios e vida cotidiana

**Design para revisão · página 1 de 2 · nenhuma implementação.** Recorte inicial: comunidade existente, 40 fundadores/100 anos; benchmark também com 100. Regras abaixo são **suposições de design, não verificadas**, não reprodução comprovada de Dwarf Fortress. Mantêm-se linhagens, corpo, conhecimento e transformação do 1d. Civilizações, mercado monetário e novos perfis ficam no Marco 3.

## Objetivos e rotina compartilhada

Hoje o cenário de linhagens desativa objetivos pessoais e avançados. Religar amizade, proteção, criar obra e poder exige integrar seus custos: trabalho, ensino, sociabilidade, cuidado e descanso disputam o mesmo orçamento mensal de tempo. Não basta ativar os sinalizadores. Idade/capacidade limitam ações; crianças não herdam ofício, habilidade aprendida ou objetivos dos pais. Novos adultos entram no mesmo processo dos fundadores.

Amizade nasce de contato e ajuda percebidos; proteção responde a perigo conhecido, conserva estimativa de capacidade e alternativas de aviso/ajuda/afastamento. Perigo resolvido por outro encerra proteção sem falha. Não criar ameaças para manter objetivos ativos. Criar obra usa o estoque real; poder continua coordenação do grupo por apoios válidos, sem governo novo. Morte, saída, recusa e mudança de capacidade reavaliam objetivos. Preferências, evidências e alternativas ficam nas decisões; RNG separado por domínio evita que trabalho consuma sorteios demográficos. Regras novas recebem versão própria, sem reinterpretar checkpoints antigos.

## Seis ofícios emergentes

| Ofício | Produção ou serviço | Restrições relevantes |
|---|---|---|
| Cultivador | Alimento colhido | Mobilidade, esforço, área e ferramenta |
| Coletor | Madeira, fibras, plantas e pigmentos | Acesso à reserva, mobilidade, carga |
| Artesão | Ferramentas, papel, tinta e ataduras | Materiais, destreza e equipamento |
| Cuidador | Tratamento já modelado no corpo | Conhecimento, tempo, materiais e alcance |
| Criador | Livro sobre experiência conhecida | Papel/tinta, habilidade e execução manual |
| Instrutor | Ensino de habilidade que domina | Aprendiz presente, competência e tempo |

Ofício descreve atividade predominante, não casta nem habilidade exclusiva. Utilidade combina habilidade, facetas/valores existentes, necessidade local percebida, oportunidade real, capacidade física e custos de esforço/risco/troca. Primeiro excluir ações impossíveis; depois comparar trabalhar, aprender, ajudar, descansar ou trocar. Reavaliar mensalmente e após acontecimentos relevantes; custo de transição evita troca gratuita a cada mês. Registrar termos do escore e causa da escolha, inclusive permanecer sem ofício viável.

Sequela altera requisitos por tarefa, nunca aplica uma penalidade genérica à pessoa. Mão ausente impede ação que exige aquela preensão; não impede ensinar oralmente. A mesma limitação pode levar a pedir ajuda, treinar outra habilidade ou abandonar o ofício conforme valores, personalidade e oportunidades. Adaptar tarefa exige recurso/ajuda real. O vínculo de mestre e aprendiz depende de aceitação de ambos, diferença de competência, presença e idade adequada; não pressupõe parentesco. Prática útil e ensino aumentam habilidade com rendimentos decrescentes, teto e tempo consumido dos dois. Habilidade pode crescer sem mestre; ensino não transfere toda a habilidade nem duplica produção.

## Materiais, consumo e falta

Estoque por domicílio/lugar, receitas versionadas e unidades fixas. Balanço por recurso: **final = inicial + extrações/produção + entradas − insumos/consumo − saídas − perdas**. Transferência tem débito e crédito atômicos; estoque negativo é inválido. Extração reduz reserva ambiental; renovação sazonal, se usada, é entrada explícita e limitada. Inventário inicial é declarado, sem abastecimento silencioso. Receitas registram conversão, resíduos e desgaste; obra conserva os materiais incorporados, não os torna disponíveis novamente.

Comida atende necessidades por idade; prioridade local de distribuição é regra registrada, não decisão onisciente. Déficit acumulado causa fome, reduz capacidade e aumenta estresse; privação prolongada pode causar morte única por inanição, sem kill list, acionando família/guarda. Faltam ferramentas: certas tarefas param, outras têm alternativa manual mais lenta. Falta cuidado: prognóstico do corpo segue sem benefício fictício; coagulação espontânea continua independente. Os limiares de fome e receitas precisam de fixtures antes de avaliar demografia; não ajustar fertilidade para compensar escassez.

---

**Página 2 de 2 — informação, custo e validação**

## Obras, reputação e dados mínimos

Preservar como primeira obra o livro do 1c: três unidades de papel, duas de tinta e seis períodos de trabalho efetivo, sujeito à capacidade e ao tempo disponível. Consumo/progresso ficam ligados ao projeto; interrupção não devolve automaticamente insumos. Tema referencia fato e prova de conhecimento anterior do criador: percepção ou notícia recebida. Não selecionar no log global. Uma notícia pode ser parcial; o texto retrata o que foi aprendido, sem acrescentar participantes, motivos ou detalhes desconhecidos.

Obra guarda ID, criador, fato/versão conhecida, evidência, qualidade, materiais incorporados, conclusão e dono. Qualidade deriva de habilidade, execução e materiais registrados; não de fama. Inicialmente pertence ao criador; presente exige transferência registrada. Na morte, passa ao espólio até decisão explícita, sem presumir herdeiro. Biografia: “concluiu [obra] sobre [fato conhecido], após saber por [fonte]; entregou a [pessoa]”, somente quando esses campos existirem, com **Por quê?** em cada elo.

Reputação por ofício é avaliação de entregas/serviços observados: qualidade, cumprimento e dano atribuível, com número de evidências e último evento. Observadores atualizam apenas o que viram ou souberam; agregar avaliações conhecidas não cria fama universal. Atualizar só por resultado distinto, sem multiplicar a mesma notícia. Reputação influencia pedidos de ensino, ajuda e apoio; não substitui habilidade. Dados adicionais: seis habilidades, ofício/última decisão, vínculo de aprendizagem, estoques/reservas, projetos/obras e avaliações esparsas com fontes. Eventos usam deltas; nunca copiar pessoa+corpo ou todo o histórico.

## Período e estimativa de custo

Loop mensal: calendário/capacidades → necessidades e oportunidades percebidas → alocação de tempo e materiais → trabalho/ensino/cuidado → consumo → percepções, emoções e reavaliações. Resolução determinística, com disputa explícita por recursos; a ordem não pode gastar o mesmo estoque duas vezes. Rotina gera **um registro por pessoa ativa/mês**, reunindo quantidades, tempo, prática, ensino, causas e deltas. Mudança de ofício, pacto de aprendizagem, falta grave, conclusão/transferência e transformação são acontecimentos separados. Monitoramento repetitivo integra a rotina. Episódios equivalentes são colapsados apenas na apresentação/profundidade causal; o replay conserva cada delta. Agregação não fabrica vínculos causais entre atividades independentes.

**Medido no 2c, 100×100, Chromium:** referência 26,42 s / 710 MB PSS / gzip 8,29 MB; seed livre suplementar 45,68 s / 1.033 MB / 13,53 MB. O segundo caso já excede 1 GB estrito. Esses números incluem o pico de transferência/exportação, não certificam o 2d nem a interface completa.

**Estimativa estrutural, não benchmark:** sejam W meses-pessoa trabalhados e A acontecimentos adicionais. Custo básico proporcional a 6W, mais contatos/objetivos e circulação de notícias; comparar todos os pares pode voltar a ser quadrático. Usar oportunidades locais e relações conhecidas; medir seus graus, sem quota de histórias. Um registro de 250–500 bytes por mês-pessoa seria 12–24 MB para W=48.000 (40 trabalhadores constantes/100 anos), ou 30–60 MB para W=120.000; nascimentos/mortes mudam W e A soma custo. Faixa de bytes é hipótese a medir; gzip e RAM não se deduzem dela. Como sensibilidade, +25–50% de tempo levaria a referência a 33–40 s e o caso livre a 57–69 s, **não previsão validada**. Não há garantia de ~60 s/~1 GB.

Antes de liberar: mesma seed de benchmark e livre suplementar, 40 e 100 fundadores; medir 2c e 2d isolados, aquecimento de 12 meses e três processos Node; Chromium com Worker real, pico antes/depois da transferência, encerramento do produtor e gzip. Validação/relatório fora do cronômetro. Separar motor, UI, exportação, PSS/RSS/heap, W, A e bytes; ablar objetivos e trabalho para atribuir custos. Sem lote de centenas nesta etapa. Exceder orçamento bloqueia a entrega, não autoriza apagar eventos ou reduzir nascimentos.

## Testes e novas biografias

Metamórficos pareados, com RNG controlado: retirar papel/tinta impede livro; bloquear conhecimento impede obra sobre aquele fato; retirar mão muda viabilidade e, em fixtures com personalidades contrastantes, escolhas justificadas; retirar mestre remove ganho por ensino, preservando prática; dividir/transferir estoque conserva totais; duplicar notícia não duplica reputação; bloquear notícia impede atualização de reputação e reação; retirar alimento/cuidado produz a consequência correspondente. Replay/checkpoint recompõem estoques, habilidades, donos e causalidade; morto não trabalha, aprendiz não aprende antes do pacto, tempo não é duplicado.

Histórias possíveis, ainda não geradas: cuidador que protege um parente e ensina seu sucessor; artesão com sequela que passa a ensinar ou aprende outro ofício; amizade formada na aprendizagem; livro sobre uma perda realmente conhecida que muda de dono; coordenação conquistada com apoio informado por trabalho observado. Biografias mostram tentativas, recusas e fracassos também, sem preencher histórias ausentes. **Parada para revisão antes de implementar.**

Fontes internas: [objetivos/obras 1c](MARCO1C-REPORT.md), [medições/limites 2c](MARCO2C-REPORT.md), [método](MARCO2C-METODO.md); conferidos `life-scenario.ts`, `engine.ts` e `types.ts`. O design do Marco 3 permanece reservado.
