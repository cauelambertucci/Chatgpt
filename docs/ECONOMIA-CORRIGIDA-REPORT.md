# Correção econômica — revisão em uma página

## Diagnóstico anterior, em cinco linhas

1. **006:** primeira fome no mês 140; 43 cultivadores distintos, 3,8 trabalhando/mês; 23,1 unidades/cultivador-mês; consumo necessário mundial 89,1/mês; fome em 11/30 domicílios.
2. **011:** primeira fome no mês 158; 39 cultivadores, 4,3 trabalhando/mês; 23,3 unidades/cultivador-mês; consumo 93,7/mês; fome em 9/31 domicílios.
3. **028:** primeira fome no mês 98; 45 cultivadores, 3,9 trabalhando/mês; 23,1 unidades/cultivador-mês; consumo 87,4/mês; fome em 8/32 domicílios.
4. Adultos consomem 4 unidades/mês; crianças, 2. Médias mensais usam os 1.200 meses, inclusive após esvaziamentos; produção global não garante abastecimento de cada casa.
5. Falhas: reserva inicial de apenas três meses para um casal, uma ferramenta perdida por mês trabalhado, prioridade tardia e bloqueio total de produção por estresse alto.

## Ajuste e resultado

Reserva inicial **96 unidades**, equivalente a 12 meses de um casal. Cultivo pleno produz **48/mês** (12 adultos); idade, sequelas, fome e estresse reduzem esse rendimento. A utilidade cresce continuamente quando a reserva cai abaixo de 12 meses. Ferramentas duram 12 meses trabalhados; cultivo manual rende 60%. Estresse reduz produtividade em vez de proibir todo trabalho. Matéria-prima continua finita, consumo é real e a fome permanece letal nas fixtures de privação. São regras de design, sem quota de sobrevivência; fertilidade não foi alterada.

Nas **mesmas três seeds**, a produção observada foi **31,9–34,0 por cultivador/mês trabalhado**; **0/93 domicílios entraram em fome**. A amostra pequena não prova uma frequência universal de crises.

**A meta de maioria dos domicílios ainda ocupados aos 100 anos não foi atingida: 14/93 (15,1%).** As três populações chegaram ao horizonte, mas 68 domicílios fecharam junto de mortes naturais e 11 após mudança de residência. Não redefini “sobrevivência” para esconder essa diferença nem alterei demografia para atingir a meta.

## Narração e conferência

Vida adulta agora tem parágrafos por década, mantendo cronologia e resumo de personalidade por fase. Mortes no mesmo mês e pela mesma causa são agrupadas, com nomes, idades e fontes preservados.

**Alda:** os 29 anos anteriores estavam corretos: nascimento no mês −216 e morte no mês 143, totalizando 29 anos completos. Após a correção, morreu no mês 883, aos **91 anos**, por declínio natural. Isso é mudança do desfecho, não correção aritmética.

Build, **58 testes unitários** e **12 verificações no navegador** passaram; conservação, desgaste, trabalho sob estresse, fome, replay e cronologia foram verificados. As três comparações fecharam sem erros de validação ou divergência de replay. A única falha inicial de teste vinha de esperar toda a vida adulta no primeiro parágrafo; o teste foi adaptado à divisão por décadas.

[Duas biografias completas](ECONOMIA-CORRIGIDA-BIOGRAFIAS.md) · [Dados e fontes](ECONOMIA-CORRIGIDA-DADOS.json). Baseline: commit `d282fae`; seeds fixas `reservado-2b-006/011/028`, sem novas rodadas. Parei antes do Marco 3.
