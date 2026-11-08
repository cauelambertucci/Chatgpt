import {writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.CHRONICLE_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const checks=[];const assert=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
try{for(const mode of ['before','after']){
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(({mode})=>{window.Worker=class{onmessage;postMessage(data){const dir=mode==='before'?'economy-fix':'books';fetch(`/reports/${dir}/${data.seed}.after.world.json`).then(r=>r.json()).then(world=>this.onmessage?.({data:{type:'complete',world}}));}terminate(){}};},{mode});
 await page.goto('http://127.0.0.1:5173');await page.locator('#seed').fill('reservado-2b-006');await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('História concluída'),{},{timeout:60000});
 assert((await page.locator('#summary').textContent()).includes('0 domicílios com menores de 18 anos'),`${mode}: métrica de crianças explícita`);
 await page.locator('#search').fill('person:01');await page.locator('#person-list [data-person="person:01"]').click();const text=await page.locator('#biography').textContent();
 if(mode==='before'){assert(text.includes('escreveu 14 livros sobre mortes que conheceu'),'14 livros resumidos');assert((text.match(/concluiu Caderno/g)||[]).length===2,'só primeiro e último detalhados neste caso');}
 else{assert(text.includes('Caderno sobre a parceria entre Mael e Alda'),'tema vivido: parceria');assert(text.includes('Caderno sobre a sequela de Mael'),'tema vivido: sequela');}
 assert(!text.includes('undefined'),'sem dado desconhecido impresso');
 for(const s of await page.locator('#biography details summary').all())await s.click();
 const buttons=page.locator('#biography [data-why]').filter({hasText:'Obra concluída'});
 assert(await buttons.count()===(mode==='before'?14:5),`${mode}: fontes de todos os livros preservadas`);
 await buttons.nth(mode==='before'?6:0).click();assert(await page.locator('.principal-chain').count()===1,`${mode}: causas preservadas`);await page.locator('#close-why').click();

 while(await page.locator('#biography details[open] summary').count())await page.locator('#biography details[open] summary').first().click();
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${mode}: móvel sem overflow`);await page.screenshot({path:`reports/books/${mode}-mobile.png`,fullPage:true});assert(!errors.length,`${mode}: sem erro JS`);await page.close();
}writeFileSync('docs/LIVROS-UI-CHECKS.json',JSON.stringify({method:'Dois mundos salvos; nenhuma seed extra.',checks},null,2));console.log({passed:checks.length});}finally{await browser.close();}
