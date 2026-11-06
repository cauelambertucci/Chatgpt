# Formato compacto do 1d — efeitos e rotina mensal

O comportamento continua em `agents-slice-1d`; o contêiner exportado passa a **version 3 / delta-routine-v1**. O formato anterior, version 2 com eventos completos, continua disponível para compatibilidade. Não há corpo, índices de agentes, cache de utilidades ou alteração de personalidade nesta revisão.

## Representação e invariantes

Cada evento lógico continua existindo, com o mesmo ID, mês, causas, decisão, alternativas, fatores, ruído e evidências. O log físico guarda linhas numéricas imutáveis como strings, evitando reter milhões de pequenas arrays de codificação no heap. Dicionários de texto e de nomes de campos reduzem repetição; são parte da representação, não armazenam resultados para poupar decisões futuras.

A posição da linha deriva `event:N` e `seq`. O mês deriva ano/dia no calendário atual; a localização continua sendo `place:void`, única suportada por esta versão do cenário. `needs.period` e `activity.period` têm tipo e período mensal codificados pelo esquema. **Nenhum mês é pulado ou simulado novamente para reconstruir uma decisão.** Não se juntam eventos através de intervenções causais.

Efeitos de criação guardam o registro inicial. Substituições guardam somente caminhos alterados, valores e remoções explícitas, incluindo `lastBy`. O replay aplica esses deltas em ordem, sem RNG, reconstruindo o mesmo estado. Identidade não pode mudar num patch. As versões reconstruídas usam cópia dos caminhos alterados, preservando objetos anteriores e congelando as estruturas novas.

Linhas são strings imutáveis; arrays de snapshots são cópias congeladas. Acrescentar eventos ou novos termos ao motor não altera um snapshot já entregue. A projeção final e o cenário exportados também são cópias congeladas. Após transporte JSON/Worker, `openCompact` protege o payload recebido antes de expor sua leitura.

## API e compatibilidade

```ts
const sim = new SliceSimulation(scenario);
const saved = sim.runCompact(); // version 3; usar no caminho de memória reduzida
const projected = replayCompact(saved);
const errors = validateCompact(saved); // fora do trecho cronometrado
const logical = openCompact(saved); // consultas de eventos/metadados
const resumed = new SliceSimulation(saved.scenario, saved).runCompact();
```

`validateCompact` mantém os checks semânticos do validador anterior com um cursor sequencial de decodificação; a projeção é comparada por conteúdo, não por ordem de inserção das chaves JSON. `replayCompact` reconstrói sem expandir um histórico inteiro de entidades.

`run()`, `simulateSlice()` e `expandCompact()` retornam o formato completo version 2 e podem consumir muita memória. São caminhos de compatibilidade/diagnóstico, **não** o caminho para cumprir o alvo de 1 GB. Como `simulateSlice()` pede esse formato completo, ele produz diretamente o log antigo em vez de compactar e expandir novamente. Há comparação dedicada entre ambos os caminhos.

O Worker experimental, para cenários `emotionalDynamics`, entrega o compacto por padrão; `output: 'legacy'` mantém a resposta antiga. A resposta compacta não gera ranking/validação completos automaticamente. Relatórios podem ser solicitados separadamente; seu custo não está escondido no benchmark do motor. A UI/mapa v1 continua usando seu próprio motor.

`openCompact` permite ler metadados sem materializar todos os efeitos. Pedir efeitos de um evento isolado reconstrói seu prefixo sem manter um índice histórico; para percorrer todos os efeitos, usar o replay/validador sequencial. Não usar acesso aleatório a efeitos em um loop sobre o log inteiro.

## Exportação e limites

O tamanho informado no relatório é **JSON bruto**, sem gzip, Brotli ou promessa de compressão futura. A medição no navegador mantém produtor, payload em um Worker receptor real, congelamento, string JSON, bytes UTF-8 e Blob para observar o custo de exportar. Ela não transforma um diagnóstico em garantia de memória para todo dispositivo ou para a futura UI de corpos/civilizações.

Os limites de horizonte/eventos da API nativa não foram ampliados no jogo. O ensaio 100 agentes × 100 anos continua usando cópias com apenas essas guardas aumentadas, como na baseline. Os arquivos antigos continuam legíveis. Corpo, tecidos, armas e ferimentos não foram implementados.
