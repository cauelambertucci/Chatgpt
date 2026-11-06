# Marco 2 — falhas encontradas e correções

- A validação inicial rejeitava a nova versão do motor e as fontes de emoção por lesão. Foram adicionados contratos explícitos para a versão 2a, percepção de ferimento/sequela, capacidade, orçamento de contato e morte corporal, preservando os testes do 1d.
- A reação à lesão inicialmente ficava na fila até depois de uma morte hemorrágica posterior e podia ser descartada. A percepção e sua reação agora ocorrem antes dessa deterioração; um teste verifica a ordem.
- A classificação inicial podia confundir uma morte externa posterior com desfecho letal do duelo. Agora a ferida primária da kill list deve pertencer ao duelo; teste injeta morte externa posterior e verifica a distinção.
- A edição do override de armadura deixou temporariamente um parêntese ausente; corrigido antes de build, testes e medições finais.
- O primeiro filtro de exemplos do relatório removia também emoções relevantes por usar a chave de fonte errada. Corrigido para `stimulusSource` e a referência `emotion`; não altera o motor nem os desfechos.

- A revisão detectou decisão “adaptar”/“abandonar” cujo efeito podia ser ignorado quando o objetivo ainda era viável; aplicar a escolha e preservar a adaptação ao escolher continuar corrigiu o problema. Uma nova regressão cobre o efeito. Os desfechos dos lotes permaneceram iguais, mas Doran passou a realizar reabilitação e atingir preensão 0,7.

Validação: a suíte completa passou com 104 testes em 13 arquivos (66,10 s). Após a última correção, os 17 testes corporais passaram (5,96 s), incluindo a nova regressão e 200 cenas verificadas. Build TypeScript/Vite passou. Os quatro hashes das regras congeladas do 1d continuam iguais. As medições isoladas e seus limites ficam no relatório; duração da suíte não é duração do motor.

As três medições da baseline completaram antes da última correção; foram preservadas. Uma tentativa inicial de medir a versão corporal anterior foi interrompida e descartada. A comparação final usa essas três baselines e três execuções novas do corpo corrigido; `--reuse-session-baseline` só reutiliza esse lote local. O comando sem opção refaz ambas as versões.
