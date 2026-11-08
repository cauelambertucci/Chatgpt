# Marco 2d-2 — entrega para revisão

**Narração:** ordem cronológica global; fases apenas visuais; “ano X” completo; velhice somente a partir dos 60. Mudanças de personalidade são resumidas por fase. Viuvez e luto ficam juntos. Trocas repetitivas de ofício e fontes extensas ficam fora da prosa principal, mantendo o acesso pelo “Por quê?”.

**Emoções:** necessidades/recuperação agora incluem idosos. Morte natural de pessoa com 60+ anos, explicitamente conhecida pela notícia recebida, reduz o impacto agudo pela metade e a mudança permanente para 1 ponto. São suposições de design; não mudam o tipo de emoção por quota. Nas mesmas dez seeds, o percentual de pessoas com estresse 1000 por pelo menos dez anos contínuos passou de **2,43% para 2,18%**. Comparação feita antes de habilitar a economia, contando somente tempo vivo. [Dados mínimos](EMOCOES-2D2-COMPARACAO.json).

**2d-2:** estoque por domicílio; Cultivador e Artesão escolhidos por utilidade, necessidade e capacidade por tarefa; produção, consumo e fome mensais com deltas e replay. Fome reduz capacidade de trabalho, aumenta estresse e pode causar morte única, sem kill list, acionando guarda familiar. Sem reputação ou aprendizagem.

Regras explícitas desta fatia: alimento inicial 24, madeira/fibra 240 cada, pigmento 160 e ferramentas 6 por domicílio fundador, além de papel/tinta existentes. Colheita renovável registra entrada ambiental; fabricação gasta matéria-prima. Criança consome 2 unidades/mês, demais 4, com cobertura proporcional. Estoques de matéria-prima são finitos, sem comércio ou redistribuição automática entre domicílios.

**Validação:** 54 testes unitários e 11 verificações no navegador; conservação, falta de material, fome/alimentação, sequelas por tarefa, morte única, replay e fronteira dos 60 anos. Duas falhas iniciais foram corrigidas: fixture tentava editar snapshot imutável; validador não reconhecia morte por inanição. Um exemplo Leve (40/100), reutilizando `reservado-2b-006`: **18,5 s**, pico **345 MiB no Node**, JSON **23,3 MiB**, gzip **3,8 MiB**. Medição isolada do motor; memória do navegador não foi medida novamente. [Verificação](MARCO2D2-CHECKS.json).

**Biografias:** [Alda e Mael, completas](MARCO2D2-BIOGRAFIAS.md), com [fontes](MARCO2D2-BIOGRAFIAS.json). Ambos sobreviveram ao duelo; mais tarde, fome no domicílio levou à morte por inanição. O exemplo terminou sem sobreviventes; esta fatia ainda não demonstra equilíbrio demográfico. O resultado não foi substituído nem calibrado. Parei nesta etapa.

Reprodução: `npm run test:2d2`; comparação emocional via `node scripts/compare-emotions-2d2.mjs`. O script `scripts/example-2d2.ts` gera somente o exemplo acima; `--reuse` apenas reescreve as biografias do mundo salvo.
