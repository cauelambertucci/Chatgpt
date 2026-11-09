# Marco 3 mínimo — contrato implementado

Suposições de design, não verificadas: três assentamentos recebem os domicílios fundadores por ordem declarada, sem ancestrais ou eventos anteriores. Parcerias/guarda já alteram domicílio; residência política acompanha esse domicílio. A interface Leve permanece em 40 fundadores e 100 anos.

O cargo de coordenador tem mandato de 60 meses. Adultos vivos e presentes são candidatos; apoio considera valores, confiança, liderança e parentesco, e a escolha considera apoio, ambição e estresse. Morte ou fim do mandato provoca nova escolha. Sem adulto elegível, o cargo fica vago. O antigo objetivo de coordenar um grupo informal não concede autoridade sobre assentamentos.

Nesta fatia, um participante sobrevivente pode relatar uma tentativa de golpe real; um familiar que recebeu notícia de morte com autoria conhecida também pode relatar. Sem esse registro de conhecimento não há petição. Rotas abstratas de 60–90 km custam 1–2 meses ao relato e 2–3 meses à campanha. O relato chega ao líder atual. Este compara confronto e acordo por personalidade, valores e estresse; a declaração exige mandato vigente e notícia correspondente. A mudança de mandato durante a viagem cancela a campanha, sem transferir autorização ao sucessor.

O confronto é um único encontro abstrato por petição. Adultos presentes dos dois assentamentos recebem um sorteio independente no domínio político: risco de morte de 5–30%, reduzido pela habilidade existente. Crianças não combatem; a morte dos pais passa pelo fluxo existente de viuvez, guarda, notícia e emoção. Sem executor individual conhecido, não se inventa autoria nem crédito pessoal de morte. Sem quota, represália automática ou morte garantida. Cada morte é registrada uma única vez.

Nesta entrega, os incidentes já simulados são os gatilhos; não foram acrescentados roubo, guerra por escassez, comércio ou reputação. A distância organiza relatos e campanhas; as interações pessoais anteriores ainda usam sua abstração original de presença. Não há mapa, cerco, exércitos persistentes ou tomada de estoques.

Todos os estados políticos usam entidades pequenas e deltas no log existente. Não há evento político de rotina mensal quando nada muda. O replay e a retomada reconstituem mandatos e campanhas pendentes. O validador rejeita declaração sem autoridade ou incidente conhecido; o catálogo da interface cobre todos os novos eventos.

Correção demográfica separada: o cultivo/artesanato deixava de consultar a decisão de recuperação. Agora essa decisão pode interromper o trabalho, salvo cultivo urgente com menos de dois meses de comida. É a única mudança prévia à política: nenhuma fertilidade, preferência por filhos ou regra de parentesco foi alterada.

Reprodução: `npm run report:m3` gera somente as três seeds livres; `npm run report:m3 -- --fixture` gera a fixture de 40 fundadores/15 anos. A fixture altera condições iniciais e o duelo declarado; digitar seu nome no formulário comum não aplica essas condições. Os mundos compactos ficam em `reports/m3/`.
