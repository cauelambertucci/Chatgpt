import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const n=read('docs/MARCO2-BENCHMARK.json'),b=read('docs/MARCO2-BROWSER.json');
const a=read('docs/MARCO2-ACTIVE-BENCHMARK.json').rows[0],ab=read('docs/MARCO2-ACTIVE-BROWSER.json').rows[0];
const median=x=>[...x].sort((a,b)=>a-b)[Math.floor(x.length/2)];
const f=(n,d=2)=>n.toFixed(d).replace('.',',');
const summary=mode=>{const rows=n.rows.filter(r=>r.mode===mode),browser=b.rows.find(r=>r.mode===mode);return {core:median(rows.map(r=>r.coreMs))/1000,bytes:rows[0].jsonBytes,rss:median(rows.map(r=>r.exportPeakRssKiB))*1024/1e6,browser:browser.coreMs/1000,pss:Math.max(...browser.samples.map(s=>s.pssKiB))*1024/1e6,hwm:Math.max(...browser.samples.map(s=>s.rssHighWaterKiB))*1024/1e6,events:rows[0].events,entitiesHash:rows[0].entitiesHash,browserHash:browser.entitiesHash};};
const before=summary('before'),after=summary('after');
if(before.entitiesHash!==before.browserHash || after.entitiesHash!==after.browserHash || a.entitiesHash!==ab.entitiesHash)throw Error('Browser/Node states differ');
const apss=Math.max(...ab.samples.map(s=>s.pssKiB))*1024/1e6;
const section=`## Tempo, memória e tamanho do log

Mesma seed \`benchmark-pre-m2-100x100-v1\`, mesma população inicial e agenda: 100 agentes, 1200 meses. Três processos Node novos por versão, aquecimento de 12 meses, mediana. Motor e snapshot/exportação medidos separadamente; validação, digest e relatórios fora dos intervalos, sem outro motor concorrente. Limites de horizonte/eventos ampliados somente nas cópias de benchmark, sem alterar os limites de produção. As três baselines desta sessão foram preservadas após a última correção e comparadas com três execuções novas da versão final.

| Medida | 1d reexecutado | Marco 2 mínimo |
|---|---:|---:|
| Motor Node (mediana) | ${f(before.core)} s | ${f(after.core)} s |
| JSON exportável | ${f(before.bytes/1e6)} MB | ${f(after.bytes/1e6)} MB |
| Eventos | ${before.events} | ${after.events} |
| Pico RSS Node na exportação (mediana) | ${f(before.rss)} MB | ${f(after.rss)} MB |
| Motor Chromium (uma execução) | ${f(before.browser)} s | ${f(after.browser)} s |
| Máximo PSS amostrado, árvore Chromium | ${f(before.pss)} MB | ${f(after.pss)} MB |
| Soma conservadora dos máximos RSS dos processos | ${f(before.hwm)} MB | ${f(after.hwm)} MB |

MB = 10⁶ bytes. O log cresceu ${f((after.bytes/before.bytes-1)*100)}% com corpo; continua muito menor que os ~434 MB do formato antigo. A baseline compacta aprovada anteriormente tinha 31,03 s e os mesmos 65.467.593 bytes. Nesta sessão, o hash completo dos eventos da baseline reproduziu exatamente o anterior; cada modelo repetiu seu próprio hash nas três execuções, e estado final Chromium/Node conferiu.

**Limite da comparação:** nesta seed não surgiu nenhum duelo: são 100 corpos, zero feridas e zero mortes. Ela mede o custo de manter os corpos no cenário existente, não uma guerra nem acúmulo maciço de ferimentos. Não extrapolar esses números para esse caso.

**Diagnóstico suplementar ativo:** mesma seed e horizonte, com um duelo numérico explicitamente controlado (ajustes de habilidade, presença e cuidado; não faz parte dos lotes livres). Uma execução Node: ${f(a.coreMs/1000)} s, ${f(a.jsonBytes/1e6)} MB JSON, ${a.duels} duelo, ${a.wounds} ferida(s), ${a.deaths} morte(s). Chromium: ${f(ab.coreMs/1000)} s, máximo PSS ${f(apss)} MB. Exercita cuidado e evolução dentro dos 100 anos; também não é teste de combate em massa.

**Estimativa no navegador:** o diagnóstico mantém snapshot, cópia real em Worker congelada, string JSON, bytes UTF-8 e Blob; amostra a árvore Chromium a cada ano e fase. Pico PSS observado do Marco 2: ${f(after.pss/1000,3)} GB; com margem estimativa de 20%: ${f(after.pss*1.2/1000,3)} GB. O alvo de ~60 s foi atendido neste ambiente. A amostragem não garante teto rígido de 1 GB; a soma dos máximos RSS inclui páginas compartilhadas e picos não simultâneos e não deve ser apresentada como consumo efetivo. Hardware/navegador diferentes e múltiplos ferimentos podem mudar o pico. O cenário não inclui custo de uma futura interface v2.

Reprodução: \`npm run benchmark:m2\`, \`node scripts/benchmark-marco2-active.mjs\`, \`npm run benchmark:m2:browser\` e \`node scripts/benchmark-marco2-browser.mjs --active\` em sequência, sem testes/relatórios concorrentes. O diagnóstico Chromium requer Playwright e Chromium; configure \`CHRONICLE_PLAYWRIGHT_MODULE\` e, se preciso, \`CHRONICLE_CHROMIUM\`. [Node](MARCO2-BENCHMARK.json), [Chromium](MARCO2-BROWSER.json), [duelo ativo Node](MARCO2-ACTIVE-BENCHMARK.json), [duelo ativo Chromium](MARCO2-ACTIVE-BROWSER.json).
`;
const path='docs/MARCO2-REPORT.md';writeFileSync(path,readFileSync(path,'utf8').replace('<!-- BENCHMARK -->',section));
console.log({before,after,active:{coreMs:a.coreMs,pssMB:apss}});
