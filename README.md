# Chronicle World

Um atlas de fantasia com geografia e história determinísticas, inteiramente no navegador. TypeScript, Vite, Canvas 2D e Web Worker; sem backend, telemetria, fontes remotas ou dependências de runtime.

## Executar

Requer Node.js 22.12+ (validado com Node 24) e npm.

```sh
npm ci
npm run dev
```

Abra o endereço que o Vite indicar. O mundo `aurora` é gerado automaticamente. Use **Novo mundo** para escolher seed, mapa (64, 128 ou 256), 50–1000 anos, 3–8 civilizações e caos. A API do motor também aceita tamanhos inteiros de 32 a 256.

```sh
npm test
npm run build
npm run preview
```

O diretório `dist/` pode ser servido por qualquer hospedagem estática na raiz do domínio. Não abra `index.html` diretamente pelo protocolo `file:`: os módulos e o Worker precisam de um servidor HTTP. Não são necessárias chaves ou variáveis de ambiente.

## Explorar e preservar

- Mapa: arraste para mover; use a roda, os botões ou `+`/`-` com foco no Canvas para ampliar. Clique em assentamentos/covis ou no terreno para abrir fichas. Alterne biomas, elevação, temperatura e política.
- As abas oferecem registros de todas as entidades. Nomes relacionados são links para outras fichas. Figuras têm biografias, parentesco e posses; artefatos têm proveniência e eventos.
- Linha do tempo: filtre por ano exato, civilização, tipo ou nome de pessoa; carregue os registros em lotes de 100. Filtros de civilização incluem participantes e assentamentos atualmente pertencentes a ela.
- `/` foca a busca global e `Esc` fecha fichas. O botão da seed copia seu texto. **Mundo aleatório** usa `crypto.getRandomValues` apenas para escolher a seed; o motor nunca usa aleatoriedade externa.
- O botão de download no cabeçalho reúne exportação JSON, crônica Markdown, importação e salvar/carregar no navegador. Importações passam por validação antes de substituir o mundo atual. Limite: 50 MB. O localStorage tem uma única posição e depende da cota do navegador; para mapas grandes, use JSON. Os arquivos incluem os parâmetros e todo o estado final. Nenhum mundo é enviado a servidores.
- O botão **Cancelar** termina o Worker sem substituir o mundo anterior. Processos não bloqueiam os controles da página.

## Organização

- `src/engine/rng.ts`: hash e Mulberry32; fluxos separados para mapa, civilizações e história.
- `noise.ts`, `mapgen.ts`: ruído de valor suavizado em cinco oitavas, clima, 11 biomas, drenagem e nomes geográficos.
- `civs.ts`: culturas, panteões simples, assentamentos, recursos, territórios e ameaças.
- `history.ts`: simulação anual e consequências sobre o estado.
- `validate.ts`: integridade temporal, referências, genealogia, população, diplomacia e cadeia de posse.
- `world.ts`: entrada pura do motor; `worker.ts`: protocolo `{progress}`, `{world}` ou `{error}`.
- `narrative.ts`: biografias e textos de eventos.
- `src/data`: sílabas, características, catálogo de eventos, templates e catálogo principal de strings pt-BR.
- `src/ui`: renderização, navegação e Canvas. Nenhuma dependência do DOM no motor.
- `src/types`: formato JSON versionado.

Cada tarefa em nuvem já é isolada: use o checkout existente, sem criar worktrees. Em uma nova sessão, execute `npm ci` se as dependências não estiverem restauradas e `npm run dev` para reiniciar o servidor; processos não sobrevivem a snapshots.

## Modelagem e decisões simples

1. **Determinismo:** mesmos parâmetros e mesma versão do motor produzem JSON idêntico, inclusive a ordem dos eventos. Alterações no algoritmo podem mudar mundos futuros; arquivos exportados preservam o mundo já gerado.
2. **Geografia:** o ruído é de valor interpolado (sem biblioteca simplex/perlin). O mapa é um continente com costas. Rios descem estritamente; mínimos locais viram lagos de uma célula. Regiões são setores fixos nomeados; montanhas, bosques, rios e lagos recebem nomes adicionais. Não há erosão, navegabilidade ou simulação climática física.
3. **Culturas:** até oito povos, quatro estilos silábicos, uma religião e divindade por cultura. Cada civilização começa com três assentamentos e recursos agregados. A fronteira inicial usa proximidade e pode mudar com conquistas em batalhas/cercos. Capitais não são conquistadas nesta versão.
4. **História:** habitantes comuns são números; apenas figuras relevantes são detalhadas. Personagens fundadores podem nascer antes do ano zero. Novos adultos sem ancestrais conhecidos entram nos registros como figuras já adultas; isso é explicitado no evento. Filhos registrados têm pais adultos existentes. Casamentos são pares simétricos; morte dissolve o vínculo atual, mas a história continua preservada nos eventos. Famílias e relações são um modelo ficcional simples, sem genética ou sexo biológico.
5. **Causa e efeito:** guerras mudam relações; batalhas/cercos reduzem população e podem transferir cidades e território; pragas, fomes, desastres e ataques reduzem população; morte transmite posses e causa sucessão. Crescimento altera população; artefatos mantêm um diário de criação, roubo, perda, herança ou destruição. Eventos diretamente encadeados usam `cause`; os demais influenciam a simulação pelo estado compartilhado. Missões, cultos, cismas e descobertas são registros narrativos, sem sistemas econômicos ou religiosos independentes.
6. **Visualização:** mapa mostra estado final, não uma reconstrução de cada ano. Fichas mostram os 100 eventos mais recentes e a linha do tempo permite consultar o restante. Nomes silábicos podem se repetir; IDs sempre distinguem as entidades. A árvore familiar mostra pais, cônjuge atual e filhos, navegáveis.
7. **Idioma:** o catálogo `strings.ts` centraliza navegação e ações principais; templates e catálogos do domínio estão separados. Alguns textos descritivos da UI ainda estão em português nos componentes e precisam migrar para um catálogo ao adicionar outro idioma.

## Adicionar um evento

1. Inclua o tipo em `src/data/catalog.ts` e suas variantes verbais em `templates.ts`.
2. Em `history.ts`, escolha entidades vivas com o RNG do motor, aplique a consequência ao estado e chame `event(ano, tipo, participantes, local, consequência, causaOpcional)`.
3. Toda entidade deve existir antes de ser referenciada. Morte e abate podem participar apenas até o ano do registro. Objetos devem passar por `transfer` para manter posses e proveniência sincronizadas.
4. Adicione um teste que verifica a consequência (por exemplo, redução de população ou mudança de posse), e rode `npm test` e `npm run build`.

## Verificação

Vitest cobre reprodução do mundo completo, geografia, capitais, 100 seeds com até 1000 anos, pelo menos 15 tipos de evento, referências inválidas, personagens fora de sua vida, proveniência e round-trip JSON. Um teste mede a geração de 500 anos com cinco civilizações em 128×128 contra a meta de 10 segundos; o desempenho varia por dispositivo. Os 29 tipos disponíveis não são garantidos em toda seed, pois dependem das condições e do caos.
