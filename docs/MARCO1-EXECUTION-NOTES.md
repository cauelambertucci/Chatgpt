# Marco 1 — resultados e falhas durante a implementação

## Primeira execução, antes das correções

- Build passou.
- Primeiro lote livre `livre-000` a `livre-099`: vingança cumprida 13, desistência 70, alvo morto por outra causa 1, reconciliação 0, fuga 14, objetivo frustrado 2. Todos os 100 mundos e a fixture passaram no validador inicial.
- Primeira suíte específica: **16 testes passaram, 1 falhou**, de 17. A falha foi igualdade de pausa/retomada via JSON: campos opcionais `undefined` desapareciam e `-0` virava `0`. O log serializado era equivalente, mas o contrato de igualdade de estado não era satisfeito. Correção: normalização JSON explícita na fronteira dos registros/snapshots, mantendo o teste original.
- O limiar de concentração foi tornado conservador: avisar já em 70%, não apenas acima dele. Não mudar a distribuição para passar em uma quota.
- A causa do objetivo foi ligada ao próprio evento de adoção, para que decisões posteriores passem pelo objetivo e não pulem diretamente para a memória.
- A primeira amostra livre não encontrou reconciliação. O teste positivo controlado de reconciliação passou: a ação é possível com alvo presente e aceitação calculada, mas isso não demonstra frequência satisfatória em geração livre. A avaliação de desfechos finais e proposta de calibração ficam no relatório final.

Nenhum resultado inicial foi apresentado como sucesso irrestrito. A distribuição pode mudar se uma correção alterar a lógica; qualquer diferença será mostrada na execução final.

## Segunda execução completa

- 26 testes passaram e 1 falhou, de 27. A retomada já passou.
- Falhou o novo teste de retirada de mentor: ele assumia que um pedido de ajuda ocorreria antes do mês 30. Na fixture, treino ainda tinha utilidade maior nesse instante, e o pedido ocorria depois.
- Correção do teste: comparar a presença de ajuda e a intensidade efetiva dos períodos de treino assistidos na execução completa, contra a mesma seed sem apoiadores. Não alterar pesos ou adiantar um pedido para satisfazer a expectativa de data. A rotina continua mensal, e o bônus não aparece sem resposta positiva.

## Revisão de causalidade e conhecimento

- Pessoas aparentadas e rivais passaram a ser criadas atomicamente, eliminando referências iniciais a pessoas ainda não registradas.
- O estado interno ficou privado; inspeção devolve snapshot congelado. O validador confere procedência de campos alterados, fontes de notícias e referências das relações.
- Na revisão foi identificado risco de onisciência: o preparo consultava a habilidade atual de um alvo ausente. Foi substituída por estimativa registrada na notícia da ofensa; atividade co-presente é pública neste cenário abstrato. Adicionado teste de intervenção na habilidade oculta.
- Notícias agora podem circular entre quaisquer presentes ainda não informados, sem o emissor precisar saber de um objetivo privado alheio. Essa correção pode alterar a distribuição final; não é seleção de categorias por seed.

## Resultado final verificado

- `npm run build`: passou, incluindo verificação TypeScript da fatia e do Worker.
- `npm test`: **29 testes passaram, 0 falharam e 0 foram pulados**, em 5 arquivos. São 21 testes da fatia e 8 da versão anterior.
- Os testes metamórficos incluem informação removida, rancor, paz/vingança, habilidade, acesso a treino, retirada de apoiadores, reencontro, morte independente, nomes, agente desconectado e habilidade oculta.
- `npm run report:m1`: os 100 mundos livres e a fixture tiveram zero erros de validação. Distribuição final: 13/70/1/0/14/2, na ordem dos seis rótulos do relatório. A concentração e a ausência de reconciliação livre permanecem como limitações, não foram corrigidas por quota.
- Geração + validação + extração por mundo neste lote: p50 148 ms, p95 195 ms, máximo 321 ms. O lote completo levou aproximadamente 15,7 s; são medições locais de 20 anos, não de 300 anos.
- Chromium com Web Worker real: fixture e `livre-056` concluíram com 19 mensagens de progresso cada, sem erros de JavaScript; aproximadamente 0,72 e 0,88 s, incluindo o percurso do Worker. Ferramenta de verificação instalada somente em `/tmp`, sem dependência nova no app.
- O relatório inclui todos os ancestrais causais, além do maior caminho, para não esconder a morte independente atrás do ramo mais longo da motivação.
- Estado e log exportados são JSON normalizado; snapshots de inspeção não permitem alterar o estado interno. A retomada suportada é em fronteira mensal, com fila de reações drenada.
- Sem mudanças na interface, sem pessoa profunda completa, sem corpo e sem implantação. Os arquivos desta etapa estão no checkout desta conversa; não houve commit ou envio ao GitHub.

Próxima proposta, ainda não aplicada: separar a intenção de negociar reconciliação do perdão unilateral e permitir esperar uma oportunidade de acordo. Avaliar novamente no mesmo lote e em um lote reservado antes de alterar outros pesos. O teste controlado de reconciliação passou, mas isso não compensa sua ausência nas 100 seeds livres.
