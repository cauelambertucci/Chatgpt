# Interface mínima do motor v2 — revisão

Implementada sobre o Marco 2c atual. Página inicial em `index.html`, interface em `src/ui/v2/`. Nenhuma regra do motor foi alterada. Leve é o recorte solicitado de **40 fundadores e 100 anos**, com `replacement-2c`; não implementa seleção de perfis, civilizações ou armazenamento do Marco 3.

## Uso

`npm run dev` abre a interface via HTTP. Seed → Gerar história → progresso anual → arquivo de pessoas e linha do tempo. Cancelar encerra o Worker. Uma geração nova não substitui o arquivo anterior antes de terminar; falhas tratadas também preservam o arquivo anterior. Não há geração automática ao abrir a página.

Busca ignora acentos e distingue IDs; filtros combinam vivo/morto, parte corporal ausente e geração. Geração 0 são fundadores, demais gerações usam a maior distância até um fundador. Mutilação significa parte registrada como ausente; fratura ou sequela sem amputação não são tratadas automaticamente como mutilação.

A ficha contém origem, situação, responsáveis registrados, parceria vigente, filhos, árvore ascendente navegável e biografia cronológica. A árvore mostra até três níveis por ficha; abrir um ancestral permite continuar. Não cria pais para fundadores. Registros familiares podem incluir acontecimentos posteriores à morte da pessoa; a interface deixa isso explícito e nunca atribui percepção com base apenas em parentesco.

Biografias usam modelos de frase e campos existentes: nascimentos, parcerias, guarda, lesões, sequelas, percepção registrada, emoções, mudanças numéricas de facetas/valores e mortes com causa/autoria informadas. Sem LLM, adjetivos inferidos, gênero inventado ou participantes fabricados. Ausência de campo não vira fato. Cada trecho abre **Por quê?**, com participantes/papéis, causas diretas navegáveis, decisão/alternativas quando registradas e campos originais.

Linha do tempo permite todos os eventos, incluindo rotina, em páginas de 40. A lista de pessoas usa páginas de 30, e biografias de 20. Apenas metadados e IDs são projetados para navegação; não há expansão de efeitos nem cópia de pessoa/corpo por evento. O log compacto e suas causas são preservados. A paginação não modifica a história.

## Validação delimitada

- **7 testes unitários**: configuração exata; ausência de ancestral/infância inventados e imutabilidade; filtros combinados; gerações/ciclos; lesão e transformação com campos conhecidos; morte natural sem autor inventado; referências causais.
- **3 seeds únicas fixas**, sem lotes novos de centenas: `interface-2c-000`, `interface-2c-001`, `interface-2c-002`. Auditoria demográfica, validação causal e replay em cada uma. As mesmas seeds foram reexecutadas ao finalizar a apresentação; nenhuma foi substituída para obter história favorável.
- **22 verificações em Chromium**, reutilizando a seed `interface-2c-000`: geração/progresso, filtros, ficha, árvore, causas, teclado/Escape, paginação, layout móvel, cancelamento, falha simulada e preservação do arquivo anterior.
- Build TypeScript/Vite aprovado. Não houve nova calibração demográfica nem benchmark de perfil; tempos de validação são diagnósticos.

Dados: [validação das seeds](UI-V2-VALIDATION.json), [verificação de navegador](UI-V2-BROWSER.json), [biografias integrais](UI-V2-BIOGRAFIAS.md). Os exemplos são geração livre, não fixtures. A primeira biografia é curta porque os registros dessa pessoa são poucos; não foram inventados conflitos, lesões ou filhos para enriquecer o texto. Narrativas de lesões e amputação também têm teste unitário com campos controlados, distinto das histórias reais.

## Ocorrências e limites

O primeiro build detectou o discriminante incorreto `part` em vez de `bodyPart`; foi corrigido. Um getter do teste precisava de tipo de retorno explícito; corrigido. A primeira verificação de navegador detectou opções malformadas do filtro vivo/morto; a marcação foi corrigida e a navegação retestada. O sandbox impediu inicialmente a porta local e o Chromium; as verificações foram executadas com a permissão local apropriada. Não houve rejeição de aprovação.

Arquivo em memória nesta sessão: recarregar a página não recupera a história. Não foi implementada persistência, recuperação de OOM ou execução local do Marco 3. A projeção da interface não atribui pensamentos desconhecidos a pessoas. O navegador foi validado em Chromium; não há promessa de desempenho equivalente em todos os dispositivos.

**Parada para revisão**, com três biografias reais. Sem implementação do Marco 3 e sem publicação do site.
