import {readFileSync,writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.CHRONICLE_PLAYWRIGHT_MODULE || 'playwright');
const inline=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');
const lines=readFileSync('docs/MARCO2-DESIGN-RESUMO.md','utf8').split('\n');
let parts=[],table=false;
for(const line of lines){
 if(line.startsWith('|')){
  if(!table){parts.push('<table>');table=true;}
  if(/^\|[-| :]+\|$/.test(line))continue;
  parts.push('<tr>'+line.split('|').slice(1,-1).map(x=>'<td>'+inline(x.trim())+'</td>').join('')+'</tr>');continue;
 }
 if(table){parts.push('</table>');table=false;}
 if(!line.trim())continue;
 if(line.startsWith('# '))parts.push('<h1>'+inline(line.slice(2))+'</h1>');
 else if(line.startsWith('## '))parts.push('<h2'+(line==='## Loop'?' class="page"':'')+'>'+inline(line.slice(3))+'</h2>');
 else parts.push('<p>'+inline(line)+'</p>');
}
const html='<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Marco 2 mínimo — modelo e loop</title><style>@page{size:A4;margin:15mm}body{font:10.5pt/1.3 Arial;color:#17202a}h1{font-size:17pt}h2{font-size:13pt}p{margin:7pt 0}table{border-collapse:collapse;width:100%;font-size:10pt}td{border:1px solid #ccc;padding:6pt;vertical-align:top}tr:first-child{font-weight:bold;background:#eef2f6}tr{break-inside:avoid}.page{break-before:page}a{color:#174e79}code{font-size:9pt}</style><body>'+parts.join('\n')+'</body></html>';
writeFileSync('docs/MARCO2-DESIGN-RESUMO.html',html);
const browser=await chromium.launch({executablePath:process.env.CHRONICLE_CHROMIUM || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{const page=await browser.newPage();await page.setContent(html);await page.pdf({path:'docs/MARCO2-DESIGN-RESUMO.pdf',format:'A4',preferCSSPageSize:true,printBackground:true});}finally{await browser.close();}
