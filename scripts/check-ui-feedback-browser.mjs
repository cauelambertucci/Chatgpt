import {readFileSync,writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.CHRONICLE_PLAYWRIGHT_MODULE||'playwright');
const rows=JSON.parse(readFileSync('docs/UI-V2-FEEDBACK-VALIDATION.json','utf8')).rows;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const checks=[];const assert=(ok,name)=>{if(!ok)throw Error(name);checks.push(name);};
try{
 for(const row of rows){
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  // Only the test harness substitutes the worker. It feeds the exact saved
  // compact output of one of the THREE audited simulations; no extra seed runs.
  await page.addInitScript(()=>{
   window.Worker=class {onmessage;onerror;onmessageerror;stopped=false;terminate(){this.stopped=true;}postMessage(data){fetch(`/reports/ui-feedback/${encodeURIComponent(data.seed)}.world.json`).then(r=>{if(!r.ok)throw Error('Mundo de teste ausente');return r.json();}).then(world=>{if(!this.stopped)this.onmessage?.({data:{type:'complete',world}});}).catch(error=>this.onerror?.({message:String(error),preventDefault(){}}));}};
  });
  await page.goto('http://127.0.0.1:5173/');await page.locator('#seed').fill(row.seed);await page.locator('#start').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('História concluída'),{},{timeout:60000});
  await page.locator('#search').fill(row.chosen.id);await page.locator(`#person-list [data-person="${row.chosen.id}"]`).click();
  assert(await page.locator('#children-table tbody tr').count()===row.children.length,`${row.seed}: todos os filhos`);
  const childText=await page.locator('#children-table').textContent();for(const child of row.children){assert(childText.includes(child.name),`${row.seed}: filho ${child.name}`);if(child.death!==undefined)assert(childText.includes(`ano ${Math.floor(child.death/12)}`),`${row.seed}: morte de ${child.name}`);}
  assert(await page.locator('#partnership-table tbody tr').count()===row.partnerships.length,`${row.seed}: parcerias históricas`);
  assert((await page.locator('#person-detail').textContent()).includes('Pais biológicos'),`${row.seed}: pais separados`);
  assert(!(await page.locator('#person-detail').textContent()).includes('Nenhum responsável registrado'),`${row.seed}: sem falsa ausência de responsáveis`);
  for(const mode of ['ancestors','descendants','relations']){await page.locator('#tree-mode').selectOption(mode);assert((await page.locator('#genealogy-tree').textContent()).length>0,`${row.seed}: árvore ${mode}`);}
  await page.locator('#tree-mode').selectOption('descendants');
  const descendantsText=await page.locator('#genealogy-tree').textContent();for(const child of row.children)assert(descendantsText.includes(child.name),`${row.seed}: descendente ${child.name}`);
  assert((await page.locator('#genealogy-tree').textContent()).includes('nascimento:'),`${row.seed}: anos de vida na árvore`);
  const important=row.facts.find(f=>f.type==='emotion.felt')||row.facts[0];
  while(await page.locator(`#biography [data-why="${important.id}"]`).count()===0){if(await page.locator('#next-bio').isDisabled())throw Error('Fonte ausente');await page.locator('#next-bio').click();}
  await page.locator(`#biography [data-why="${important.id}"]`).click();
  assert(await page.locator('.principal-chain').isVisible(),`${row.seed}: cadeia principal primeiro`);
  assert(await page.locator('.routine-context').getAttribute('open')===null,`${row.seed}: rotina recolhida`);
  const why=await page.locator('#why').textContent();assert(!row.usedTypes.some(type=>why.includes(type)),`${row.seed}: nenhum código de tipo`);
  assert(await page.locator('#why pre').count()===0,`${row.seed}: sem JSON técnico`);
  assert(!(await page.locator('.principal-chain').textContent()).includes('Necessidades do período'),`${row.seed}: rotina fora da cadeia principal`);
  await page.locator('#close-why').click();
  const news=row.facts.find(f=>f.type==='information.received');if(news){
    while(await page.locator(`#biography [data-why="${news.id}"]`).count()===0){if(await page.locator('#prev-bio').isDisabled())break;await page.locator('#prev-bio').click();}
    while(await page.locator(`#biography [data-why="${news.id}"]`).count()===0){if(await page.locator('#next-bio').isDisabled())throw Error('Notícia ausente');await page.locator('#next-bio').click();}
    await page.locator(`#biography [data-why="${news.id}"]`).click();assert((await page.locator('#why-body').textContent()).includes('Fonte:'),`${row.seed}: notícia com fonte`);await page.locator('#close-why').click();
  }
  await page.screenshot({path:`reports/ui-feedback/${row.seed}-desktop.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${row.seed}: mobile sem overflow`);
  await page.screenshot({path:`reports/ui-feedback/${row.seed}-mobile.png`,fullPage:true});
  assert(errors.length===0,`${row.seed}: nenhum erro de JavaScript`);await page.close();
 }
 writeFileSync('docs/UI-V2-FEEDBACK-BROWSER.json',JSON.stringify({method:'Renderização dos três mundos compactos auditados, reutilizados por adaptador de Worker exclusivo do teste. Nenhuma geração ou seed adicional.',browser:await browser.version(),checks},null,2));console.log(JSON.stringify({passed:checks.length,seeds:rows.map(r=>r.seed)}));
}finally{await browser.close();}
