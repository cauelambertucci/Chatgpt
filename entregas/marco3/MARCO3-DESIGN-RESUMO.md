# Marco 3 — mundo e perfis de execução

**Proposta para revisão; nada implementado.** Duas páginas. Regras ficcionais: suposição de design, não verificado. O Marco 2c permanece a última entrega. Esta revisão substitui metas históricas de 10 s/300 anos e qualquer adaptação de regras ao perfil.

## Mundo, dados e loop

Famílias, corpos, conhecimento e genealogias do 2b precedem civilizações. Lugares têm rotas, recursos e coortes; instituições têm cargos, membros, regras de sucessão e legitimidade. Produção, consumo e transporte conservam recursos. Guerra, migração e sucessão exigem agentes capazes, motivos, informação e decisões causais; vacância não cria adultos. Coortes não duplicam habitantes nomeados nem inventam memórias individuais.

Loop: prazos do calendário → produção/consumo e deslocamentos → percepções → decisões individuais/institucionais → resolução → eventos/deltas imutáveis → reações → gravação confirmada → progresso visual. Mantêm-se RNG determinístico, replay e cadeias causais. O mapa não escolhe decisões políticas. Implementação e validação do mundo ficam para aprovação posterior.

## Perfis: somente escala

| Perfil proposto | Fundadores | Anos | Pessoas detalhadas vivas: limite | Amostragem visual/telemetria |
|---|---:|---:|---:|---:|
| Leve | 12 | 50 | 64 | 12 meses simulados |
| Padrão | 40 | 100 | 256 | 24 meses simulados |
| Épico | 100 | 300 | 1.024 | 60 meses simulados |
| Personalizado | Inteiro ≥1 | Inteiro ≥1 | ≥fundadores detalhados | Inteiro ≥1 mês |

Valores candidatos, não capacidades já suportadas. O limite é de recursos, não teto de nascimentos. Mortos/logs permanecem contabilizados na memória. Se uma transição exigir ultrapassar o limite, parar antes dela e salvar o ponto anterior; nunca suprimir nascimento, adiar promoção elegível, apagar personagem ou simplificar decisões. A antiga proposta de esperar vaga para promoção fica revogada: seleção e resolução de coortes são regras comuns versionadas, independentes do perfil.

Amostragem controla apenas cópias para gráficos/progresso, não o passo mensal, eventos, RNG, persistência ou vigilância de recursos. Pesos de personalidade, fertilidade, mortalidade, combate e causalidade são idênticos. Mesma seed/escala/versão, com amostragem diferente ou limite não atingido, deve produzir eventos e estado idênticos. Manifesto: versão das regras, seed, quatro parâmetros, versão do estimador e runtime; nenhuma troca automática durante a geração. Nome do perfil, amostragem e limite de recursos não entram nas chaves de RNG.

## Tela de geração e números disponíveis

Escolher perfil → ver parâmetros, previsão, fonte e confiança → gerar/cancelar. Mostrar tempo do motor separado de persistência, relatório/exportação e total. “Medido” exige configuração ensaiada; “Extrapolação do motor 2c; Marco 3 ainda não medido” acompanha os demais números. O histórico real atualiza a previsão sem mudar regras.

Âncoras reais de **100 fundadores × 100 anos**, Chromium: referência **26,42 s / 0,710 GB PSS**; primeira seed livre **45,68 s / 1,033 GB**; exportação gzip **8,29 / 13,53 MB**. Incluem cópia entre Workers e exportação no pico; produtor encerrado após transferência. Node: referência mediana **32,42 s**, caso livre **57,67 s** (uma execução). Não são percentis nem testes do Marco 3. [Medições e limites](https://github.com/cauelambertucci/Chatgpt/blob/codex/marco2c-relatorio-1050/entregas/marco2c/MARCO2C-REPORT.md).

| Perfil | Tempo exploratório do motor | Memória exploratória |
|---|---:|---:|
| Leve | ~2–3 s | ~0,71–1,03 GB |
| Padrão | ~11–18 s | ~0,71–1,03 GB |
| Épico | ~79–137 s | ~2,13–3,10 GB |
| Personalizado | Fórmula abaixo ou “sem estimativa confiável” | Fórmula abaixo ou “sem estimativa confiável” |

**Todas as linhas são extrapolações, não promessas.** Heurística inicial: tempo = âncora × (fundadores/100) × (anos/100); memória = âncora × max(1, fundadores/100) × max(1, anos/100). O piso evita alegar economia de memória ainda não medida nos perfis menores; não é teto garantido. Crescimento, instituições, pessoas ativas, limite escolhido e histórico acumulado podem invalidar ambas. Sem curva calibrada para esses fatores, mostrar também “incerteza alta”; fora da faixa ensaiada, preferir ausência de número a falsa precisão. O alvo de ~60 s/~1 GB segue referência para 100×100, não promessa para Épico.

## Dispositivo e recuperação

Usar, quando disponíveis, `deviceMemory` (aproximado/arredondado), `hardwareConcurrency` e um pequeno ensaio isolado de CPU/alocação, com seed própria descartável. Não inferir RAM pelo número de núcleos. APIs ausentes ou sinais conflitantes: capacidade desconhecida, recomendar Leve. O usuário pode escolher outro perfil. Nada enviado a servidor. UI: “A memória disponível para esta aba pode ser muito menor que a RAM do computador; outras abas e o sistema também consomem recursos.” `storage.estimate()` mede armazenamento, não RAM.

Recomendação futura cruza curva validada, margem medida, população/log projetados e custo de checkpoint/cópia/exportação. Até validar, Leve é recomendação prudente, não garantia; Épico é experimental, preferencialmente local. Personalizado mostra parâmetros fora do domínio validado. Não usar coleta de heap opcional como detecção universal de memória livre.

Antes de gerar, testar armazenamento e explicar disponibilidade/persistência. Planejar log append-only em blocos limitados, checkpoint periódico e manifesto de commit atômico em IndexedDB/OPFS. Confirmar mês/evento na UI só após gravar seu prefixo consistente; checkpoint inclui cursor, agendamentos e estado necessário ao replay. Compactação de armazenamento conserva eventos/deltas, identidades e causas. Pedir persistência quando suportada e oferecer exportação parcial em fluxo; uso offline continua sem backend.

Pressão detectável ou erro de alocação capturável: parar no limite transacional, preservar o último commit e liberar Worker; mensagem: “Geração interrompida por recursos insuficientes. Histórico salvo até ano X/mês Y. Exporte o parcial, retome localmente ou gere outro mundo com perfil menor.” Marcar parcial/incompleto; não apresentar fim natural. Falta de espaço tem mensagem própria. Checkpoints e exportação entram no orçamento, com reserva para encerramento medida em ensaio.

**Limite real:** OOM pode matar Worker/aba/processo sem executar tratamento. Ao reabrir, recuperar o último commit e descartar somente o bloco incompleto; computação ainda não confirmada pode ser perdida. Não é possível garantir preservação de dados apenas em RAM, nem recuperação se o navegador apagar armazenamento. “Sem perder o gerado” significa preservar todo progresso confirmado; para garantia mais forte, exigir gravação externa incremental. Nenhuma promessa de captura universal de OOM.

## Medição e alternativa local

Antes de oferecer qualquer perfil como validado: mesma seed de referência e seed livre suplementar do 2c, mais lote fixo novo/reservado, sem escolha por resultado. Ensaiar todos os perfis e bordas do Personalizado, crescimento intenso e limite atingido. Node: aquecimento de 12 meses, GC fora do cronômetro, três processos independentes; medir construtor/avanço sem relatório/validação concorrentes. Registrar máquina, SO, versões, parâmetros, pessoas vivas/detalhadas, eventos e bytes; reportar mediana, dispersão e pior caso observado.

Chromium: Worker real, cópia/transferência, amostra antes/depois de encerrá-lo, persistência, receptor imutável e gzip. Medir PSS da árvore de processos, RSS/heap como indicadores distintos, pico de checkpoint/exportação e duração por fase/total. Sem GC artificial nessas fases. Repetir em máquinas modestas e intermediárias; Firefox/Safari têm resultados próprios, sem transferir promessas do Chromium. Publicar falhas e extrapolações; um único ensaio não certifica todo perfil.

Testes previstos: invariância ao perfil nominal/amostragem e limite não atingido; prefixo causal íntegro no limite; retomada igual à execução contínua; encerramento abrupto de Worker/aba; quota de disco e commit incompleto; falta das APIs; equivalência navegador/Node. Calibrar modelo com lote de treino e verificar erro/margem no reservado antes de exibir números confiáveis. Nunca cumprir orçamento reduzindo fertilidade ou descartando eventos.

**Local:** avaliar primeiro CLI Node, depois invólucro desktop opcional. Mesmo motor, regras, manifesto, log e replay; escrita incremental em disco, checkpoints e retomada de exportação do navegador. Sem teto de aba, mas limitado por heap V8 configurado, RAM, disco e sistema operacional; ainda precisa abortar com recuperação. Comparar Épico no mesmo hardware/seed e medir RSS/tempo/exportação; desktop pode consumir mais RAM. Requer instalação/permissão, portanto não presumir disponibilidade no PC da faculdade. Nenhuma opção local implementada ou recomendada como capacidade comprovada.

**Parada para revisão:** aprovar parâmetros candidatos, contrato de progresso confirmado e plano de ensaio antes de codar. Perfis e tela de geração são proposta do Marco 3; a interface Legends completa continua em etapa posterior.
