# Marco 2b mínimo — dados, regras e limites

**Suposição de design, não verificado.** Reprodução, idade, herança e mortalidade são regras simplificadas do Chronicle World; não são regras verificadas do Dwarf Fortress nem modelos médicos/genéticos. A pesquisa da wiki continua dispensada.

## Registros

- `Life`: pessoa, mês de nascimento, fase, pais biológicos, responsáveis atuais, parceria atual, domicílio, papel reprodutivo, parâmetros genéticos, prazo natural de morte, filhos biológicos e gestação pendente. A pessoa continua sendo a identidade; `Life` não aumenta a população.
- `Household`: domicílio identificado e fonte de criação. Moradores derivam da ligação em `Life`; mudar de casa não cria pessoas. Não há capacidade habitacional ou economia nesta fatia.
- `Pregnancy`: pais, concepção, prazo de nove meses, risco/sorteio de perda e estado gestando/nascido/perdido. Feto ainda não é uma pessoa contada na população. Nascimento vivo cria pessoa e corpo; perda gestacional não conta como morte de pessoa.
- `Person` e `Body`: os mesmos registros do motor anterior. Corpo infantil usa o catálogo humanoide compartilhado, com reserva sanguínea e preensão proporcionais à idade; alterações continuam como deltas.

Fundadores têm **pais biológicos desconhecidos (`[]`)**. Idade e fenótipo inicial são dados de entrada, não uma infância reconstruída. Nenhum ancestral ou memória passada é fabricado. Parentesco já informado na entrada pode ser conhecido, sem atribuir pais inexistentes. Nos lotes livres desta fatia os 12 fundadores começam sem parentesco declarado.

## Calendário e capacidades

Calendário existente: 12 meses de 30 dias. Infância <12 anos; juventude 12–17; adulto 18–59; velhice ≥60. Crescimento/declínio é atualizado no aniversário anual; capacidade infantil é `max(0,12; idadeEmMeses/216)`, limitada a 1 na maioridade. Depois dos 60, declina até o piso 0,5. Sangue acompanha a capacidade, preservando a fração remanescente; crescer não cura ferimentos nem recupera partes perdidas.

Crianças não recebem arma, objetivos de vingança ou ações adultas; o treino infantil registrado só começa aos seis anos, em períodos de desenvolvimento com responsáveis presentes. Aos 18, a guarda infantil termina, o treino adulto se torna elegível e uma arma pode ser disponibilizada se a mão permite. Uma arma perdida por incapacidade não reaparece a cada aniversário. Velhos conservam capacidades residuais e podem defender-se/receber cuidado.

**Granularidade da fatia:** a IA estratégica mensal roda nos adultos (18–59). Crianças e idosos mantêm corpo, calendário, parentesco e reações a eventos; desenvolvimento infantil e envelhecimento são anuais. Não há simulação completa de atividades infantis nem de projetos estratégicos de idosos. O benchmark precisa ser lido como 100 fundadores com população/atividade variáveis, não 100 adultos ativos constantes acrescidos de filhos.

## Parceria e reprodução

Parceria exige adultos presentes, sem parceria ativa e sem ascendência em comum; parentesco conhecido também impede formar o par. A utilidade de cada participante considera família, amizade, confiança e diferença de idade, com bônus por possibilidade de prole quando ambos valorizam família. Ambos precisam superar a utilidade de permanecer sós (45). Pode existir parceria sem possibilidade biológica de prole. Papel reprodutivo simplificado (`gestational`/`contributor`) não representa identidade de gênero.

Concepção usa parceria existente, presença, gestante de 18–45 anos e contribuinte de 18–65. Desejo familiar deriva dos valores dos dois, de filhos já nascidos e estresse; o tamanho desejado varia de zero a três, como preferência individual deste recorte. Não há limite global de população nem quota por seed. Há intervalo mínimo de 24 meses após o término anterior de gestação; oportunidades são avaliadas anualmente, com chance de 40% quando elegíveis.

A concepção registra utilidade conjunta, desejo, sorteio, pais e prazo. A gestação termina nove meses depois em nascimento ou perda; risco de perda = 8% mais um ponto por ano da gestante acima dos 35. Sorteio é fixado na concepção. Morte da gestante encerra a gestação no mesmo mês. Isso não é uma árvore obstétrica completa nem negociação reprodutiva individual detalhada.

## Herança, experiência e memória

Fundadores recebem parâmetros genéticos independentes do fenótipo adulto fornecido; sua experiência prévia permanece desconhecida. Para cada faceta do filho, o evento de nascimento separa:

1. Parâmetros materno e paterno, preservados no `Life` dos pais mesmo após transformações emocionais.
2. Média parental + segregação aleatória de −10 a +10 → parâmetro genético do filho, limitado a 0–100.
3. Variação de desenvolvimento de −8 a +8 → fenótipo inicial, também limitado a 0–100.
4. Experiência inicial zero. Cuidados efetivamente vividos alteram confiança, valor de família e habilidade em eventos posteriores; emoções do 1d podem mudar outras facetas/valores. O genótipo permanece inalterado.

RNG tem chaves semânticas por pessoa/gestação/faceta; não depende de um contador aleatório global. Filhos não copiam personalidade, crenças, habilidade, memória ou objetivos dos pais. Valores iniciais são neutros, com vínculo familiar basal; valores aprendidos não são tratados como DNA.

Um recém-nascido não recebe notícias ou memórias anteriores. Percepção narrativa de morte/lesão começa aos quatro anos nesta aproximação; notícias posteriores precisam ser eventos simulados. O modelo não descreve emoções pré-verbais em detalhe.

## Família, guarda e morte

Parceiros, pais, filhos, irmãos e responsáveis conhecidos alimentam o parentesco próximo usado pelo 1d. Percepção/notícia de morte ou sequela precede emoção, estresse e transformação. Bloqueio de informação impede a reação à notícia desconhecida. Não atribuímos conhecimento automático a toda a árvore genealógica.

Ao morrer um responsável, a guarda é revista: o sobrevivente mantém a responsabilidade; sem sobrevivente, adultos presentes e informados são avaliados por família, compaixão, parentesco, carga de filhos e estresse. Aceitação é por utilidade, com registro dos candidatos e do motivo. Sem aceitação, a guarda fica explicitamente pendente e volta a ser considerada. Guarda social não altera pais biológicos; adoção não altera genes. A morte fecha relações ativas, preservando o histórico.

Vida natural é agendada individualmente: 68–92 anos mais 0–11 meses. O declínio fisiológico é registrado aos 60 anos e causa a morte no prazo próprio; não há novo sorteio a cada decisão nem morte de todos na mesma idade. O prazo é um fato do motor, não conhecimento usado pelo agente para planejar o futuro. Morte natural tem responsável/arma nulos e não entra na kill list. Uma morte anterior por duelo impede nova morte natural. Doenças, mortalidade infantil livre, infertilidade clínica e reprodução assistida estão fora deste recorte.

## Conservação e compatibilidade

`vivos = fundadores + nascimentos vivos − mortes`. Sem imigração/emigração nesta fatia. Perdas gestacionais e mudança de domicílio não entram como pessoas ou mortes. Balanços anuais e final usam fatos reais; a auditoria confere também gestação, idade dos pais, herança, ausência de ciclos, corpo de cada pessoa e unicidade de morte.

Versão `agents-slice-2b`; logs anteriores continuam legíveis e checkpoints incompatíveis não são continuados sob regras novas silenciosamente. Registros de mortos e ancestrais simulados são retidos para genealogia. Sem índices de agentes ou cache de decisões novos. Não há civilizações, sucessão política, economia familiar ou publicação nesta entrega.
