import {readFileSync,writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.CHRONICLE_PLAYWRIGHT_MODULE||'playwright');
const selected=JSON.parse(readFileSync('docs/MARCO2D1-HISTORIAS.json','utf8')).stories;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const checks=[];const assert=(ok,name)=>{if(!ok)throw Error(name);checks.push(name);};
try{for(const row of selected){
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{window.Worker=class{onmessage;onerror;stopped=false;terminate(){this.stopped=true;}postMessage(data){fetch(`/reports/marco2d1/${encodeURIComponent(data.seed)}.after.world.json`).then(r=>r.json()).then(world=>{if(!this.stopped)this.onmessage?.({data:{type:'complete',world}})}).catch(error=>this.onerror?.({message:String(error),preventDefault(){}}));}};});
 await page.goto('http://127.0.0.1:5173/');await page.locator('#seed').fill(row.seed);await page.locator('#start').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('História concluída'),{},{timeout:60000});
 await page.locator('#search').fill(row.person.id);await page.locator(`#person-list [data-person="${row.person.id}"]`).click();
 assert((await page.locator('#person-detail').textContent()).includes('ofício registrado')||(await page.locator('#person-detail').textContent()).includes('Ofício registrado'),`${row.seed}: ofício visível`);
 const wanted=row.person.facts.filter(e=>['work.started','work.created','work.transferred','work.blocked','care.compression','occupation.changed','sequela.confirmed'].includes(e.type));
 for(const fact of wanted){
  while(await page.locator(`#biography [data-why="${fact.id}"]`).count()===0){if(await page.locator('#next-bio').isDisabled())throw Error(`Fato ausente ${fact.id}`);await page.locator('#next-bio').click();}
  await page.locator(`#biography [data-why="${fact.id}"]`).click();const text=await page.locator('#why-body').textContent();
  assert(!text.includes(fact.type),`${row.seed}: rótulo ${fact.id}`);
  assert(await page.locator('.principal-chain').count()===1,`${row.seed}: cadeia ${fact.id}`);
  if(fact.type==='work.started')assert(text.includes('Fonte:'),`${row.seed}: livro com notícia e fonte`);
  await page.locator('#close-why').click();
 }
 await page.screenshot({path:`reports/marco2d1/${row.category}-desktop.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${row.seed}: mobile sem overflow`);
 await page.screenshot({path:`reports/marco2d1/${row.category}-mobile.png`,fullPage:true});assert(errors.length===0,`${row.seed}: sem erro JS`);await page.close();
}
writeFileSync('docs/MARCO2D1-UI-CHECKS.json',JSON.stringify({method:'Três mundos reais auditados carregados por adaptador de teste; nenhuma seed extra.',checks},null,2));console.log({passed:checks.length});
}finally{await browser.close();}
