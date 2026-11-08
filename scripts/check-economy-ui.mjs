import {readFileSync,writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.CHRONICLE_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const checks=[];const assert=(ok,name)=>{if(!ok)throw Error(name);checks.push(name);};
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{window.Worker=class{onmessage;onerror;postMessage(data){fetch(`/reports/economy-fix/${data.seed}.after.world.json`).then(r=>r.json()).then(world=>this.onmessage?.({data:{type:'complete',world}}));}terminate(){}};});
 await page.goto('http://127.0.0.1:5173');await page.locator('#seed').fill('reservado-2b-006');await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('História concluída'),{},{timeout:60000});
 for(const id of ['person:17','person:01']){
  await page.locator('#search').fill(id);await page.locator(`#person-list [data-person="${id}"]`).click();
  const bio=await page.locator('#biography').textContent();assert(!/Em \d+,/.test(bio),`${id}: ano completo`);assert(!bio.includes('estresse de 0 para 0'),`${id}: sem variação nula`);
  if(id==='person:17')assert(bio.includes('91 anos'), 'Alda: idade final conferida');
  assert(await page.locator('#biography .bio-paragraph').count()>3,`${id}: parágrafos por década`);
  const btn=page.locator('#biography [data-why]').first();await btn.click();assert(await page.locator('.principal-chain').count()===1,`${id}: causas acessíveis`);await page.locator('#close-why').click();
  for(const summary of await page.locator('#biography details summary').all())await summary.click();
  const hunger=page.locator('#biography [data-why]').filter({hasText:'Mudança na alimentação'}).first();
  if(await hunger.count()){await hunger.click();assert((await page.locator('#why-body').textContent()).includes('alimento'),`${id}: fome explicada`);await page.locator('#close-why').click();}
  while(await page.locator('#biography details[open] summary').count())await page.locator('#biography details[open] summary').first().click();
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${id}: layout móvel`);
  await page.screenshot({path:`reports/economy-fix/${id.replace(':','-')}-mobile.png`,fullPage:true});await page.setViewportSize({width:1280,height:900});
 }
 assert(!errors.length,'sem erros JavaScript');writeFileSync('docs/ECONOMIA-CORRIGIDA-UI-CHECKS.json',JSON.stringify({method:'Mundo de exemplo já gerado; nenhuma seed nova.',checks},null,2));console.log({passed:checks.length});
}finally{await browser.close();}
