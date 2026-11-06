# Compactação de memória — execução e falhas

Escopo autorizado: efeitos compactos e rotina mensal compacta; nova meta ~60 s/100 agentes/100 anos, ~1 GB no navegador e exportação menor. Nenhum índice de agentes, cache de decisões ou mecânica de corpo foi adicionado. Os dicionários do codec são apenas representação de texto/campos; as utilidades continuam calculadas a cada decisão.

## Problemas encontrados e corrigidos

1. **Divergência falsa no replay:** objetos iguais reconstruídos por deltas tinham ordem de inserção diferente em campos aninhados. O teste por valor passava, mas a comparação textual do validador acusava divergência. O validador agora compara chaves canônicas, mantendo a detecção de valores adulterados e todos os checks causais.
2. **Checkpoint congelava o dicionário inteiro:** ao retomar, adicionar um nome de campo falhava com objeto não extensível. A importação copia o contêiner e preserva entradas imutáveis; o teste de retomada permaneceu.
3. **Validação aleatória quadrática:** o validador acessa eventos por índice, não pelo iterador. A primeira adaptação expandia o prefixo para cada evento e ficou lenta. A leitura para validação agora mantém apenas um cursor sequencial e o estado corrente. Não é índice de agentes nem cache de decisões.
4. **Primeira tentativa economizava arquivo, mas piorava o heap:** arrays numéricas aninhadas produziram JSON de 64.973.913 bytes, porém o núcleo chegou a 1.180.108 KiB de RSS e a exportação a 1.310.972 KiB. Essa tentativa foi rejeitada. Dados preservados em `MEMORY-INITIAL-ATTEMPT.json`. A representação final guarda cada linha como string imutável e decodifica sem reter árvores intermediárias.
5. **Timeouts de testes e caminho de compatibilidade:** uma execução completa teve 84 aprovações, quatro timeouts e três erros internos de RPC do Vitest. O helper que pede explicitamente o formato antigo fazia compactação e expansão desnecessárias. Ele agora gera esse formato diretamente; o caminho compacto possui testes próprios de equivalência, replay, checkpoint, imutabilidade e transporte. Os prazos dos testes antigos não foram aumentados. O teste novo de integração, que compara três cenários completos e seus relatórios, usa 30 s; seu prazo inicial padrão de 5 s foi insuficiente para cerca de 7 s de trabalho.
6. **Medição intermediária descartada:** uma tentativa começou com um teste ainda pendente; foi interrompida e não é tratada como benchmark isolado. A medição final só começa após os testes e o build terminarem.

7. **Strings com decodificação ansiosa:** a representação em strings baixou o pico do núcleo para 319.212 KiB, mas decodificava decisões completas ao consultar apenas IDs; o núcleo levou 97,20 s. Essa versão também foi rejeitada. `MEMORY-STRING-EAGER-ATTEMPT.json` preserva o resultado. A leitura agora decodifica apenas campos consultados, sem guardar ou reutilizar resultados de decisões entre períodos. Continua registrando todas as alternativas e fatores.

## Verificação antes do benchmark final

- `npm test -- --maxWorkers=2`: **88 passaram em 12 arquivos**, 0 falhas, 0 ignorados, sem erros internos; 69,08 s. Inclui os 82 anteriores e seis novos.
- `npm run build`: TypeScript e Vite passaram.
- Testes novos comparam todos os eventos expandidos, decisões, causas, projeções e ranking em cenários fixos, incluindo a regressão reservada 096; verificam importação de checkpoint antigo e compacto, remoções, patch aninhado, mutabilidade e causa futura adulterada.
- O benchmark final compara hashes canônicos de **cada evento completo** e da projeção final, em seis processos independentes, fora dos trechos cronometrados. Não se limita a comparar contagens.

Resultados finais e limites de memória do navegador serão registrados em `MEMORY-REPORT.md`, com os dados em `MEMORY-BENCHMARK.json` e `MEMORY-BROWSER.json`. Não se atribui a memória de RSS do Node ao heap do navegador. Nenhum push/publicação.


A baseline final de três processos isolados foi medida nesta mesma revisão e é reutilizada após corrigir apenas a representação posterior (`--reuse-before`). Não se usa o mínimo da baseline nem se troca a seed. Rodadas e dados intermediários permanecem identificados; a comparação final usa medianas e todos os hashes completos.


## Resultado final confirmado

- Leitura preguiçosa, após a última alteração: `npm test -- --maxWorkers=2` passou **88/88** em 12 arquivos, 0 ignorados/erros internos, 66,94 s. Os seis testes novos passaram novamente. TypeScript/Vite passaram.
- Seis resultados (três baseline e três finais): hash do cenário, hash canônico de todos os eventos completos e da projeção final idênticos. Não houve filtragem de seeds nem descarte de resultados finais para escolher os melhores tempos.
- A primeira tentativa de arrays e a tentativa de strings ansiosas foram rejeitadas como implementações intermediárias, com suas métricas preservadas. A baseline final veio das três medições isoladas da segunda tentativa; seu código não mudou desde então.
- Chromium executou os dois formatos por 1.200 meses e confirmou projeções iguais às do Node. Transferência para um receptor Worker real e exportação com JSON/UTF-8/Blob completaram nos dois casos.
- PSS amostrado máximo no Chromium final: 883.614 KiB (~905 MB). A estimativa com 20% de margem fica ~1,09 GB; não se apresenta o observado como garantia de pico absoluto abaixo de 1 GB. A soma conservadora de máximos RSS também está publicada.
- Nova consulta direta a todas as 20 URLs da wiki: nenhuma página recebida, todos os CONNECTs retornaram 403. Exemplo numérico documentado como proposta, sem corpo implementado e sem citações verificadas fictícias.

- Smoke real do Worker após a medição: saída compacta version 3 e fallback version 2 completaram com os mesmos 187 eventos; registro em `MEMORY-WORKER-SMOKE.json`. A conta emocional do exemplo foi conferida chamando apenas `appraise` existente; nenhum resolvedor de golpe foi codificado.
