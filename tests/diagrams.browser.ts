import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createDemoBuilderTools} from '../src/agent/subagents/demo-builder.ts';
import {getHeadless} from '../src/agent/subagents/headless.ts';
const sources={plantuml:'@startuml\nleft to right direction\nentity "Пользователь" as U {\n* id : integer\n--\nимя : text\n}\nentity "Заказ" as O {\n* id : integer\n--\nuser_id : integer\n}\nentity "Товар" as P\nU ||--o{ O\nO }o..o{ P\n@enduml',mermaid:'erDiagram\n direction LR\n USER["Пользователь"]\n ORDER["Заказ"]\n PRODUCT["Товар"]\n USER ||--o{ ORDER : "оформляет"\n ORDER }o..o{ PRODUCT : "содержит"\n USER {\n int id PK\n string name "Имя"\n }\n ORDER {\n int id PK\n int user_id FK\n }'} as const;
const state={html:null as string|null,testedHtml:null as string|null,lastResult:null};
const tools=createDemoBuilderTools(state,getHeadless(),undefined,true);
const ids:Record<string,string>={};
for(const [engine,source] of Object.entries(sources)) {
 const result=await tools.render_diagram!.execute('render-'+engine,{engine,source});
 ids[engine]=(result.details as {id:string}).id;
}
await tools.write_demo!.execute('write',{html:`function Demo(){const [n,setN]=useState(0);return h(Stack,null,h(Button,{onClick:()=>setN(n+1)},'Обновить подпись'),h(Diagram,{id:'${ids.plantuml}',label:'PlantUML: заказы '+n}),h(Diagram,{id:'${ids.mermaid}',label:'Mermaid: заказы'}),h(Diagram,{id:'${ids.mermaid}',label:'Повтор'}));}return Demo;`});
const checked=await tools.run_demo!.execute('check',{probe:"document.querySelectorAll('[data-diagram] svg').length"});
assert(checked.content.some(part=>part.type==='text' && part.text.startsWith('PASSED:')));
assert.equal(state.testedHtml,state.html);
const html=state.html!;
mkdirSync('work/kroki',{recursive:true});writeFileSync('work/kroki/diagrams.html',html);
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const page=await browser.newPage();const errors:string[]=[];const requests:string[]=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 for(const width of [390,1024]) {
  await page.setViewport({width,height:1800});
  await page.setContent('<body style="margin:0"><iframe sandbox="allow-scripts" style="width:100%;height:1700px;border:0"></iframe>');
  await page.$eval('iframe',(el,html)=>{(el as HTMLIFrameElement).srcdoc=html;},html);
  const frame=await (await page.$('iframe'))!.contentFrame();assert(frame);
  await frame.waitForSelector('[data-diagram] svg',{timeout:5000});
  for(const dark of [true,false]) {
   await page.evaluate(dark=>{document.documentElement.style.colorScheme=dark?'dark':'light';document.body.style.background=dark?'rgb(20, 20, 20)':'rgb(250, 250, 250)';},dark);
   await page.$eval('iframe',(el,dark)=>(el as HTMLIFrameElement).contentWindow!.postMessage({type:'visual-theme',dark,tokens:{'--foreground':dark?'rgb(230, 230, 230)':'rgb(30, 30, 30)','--background':dark?'rgb(20, 20, 20)':'rgb(250, 250, 250)','--font-sans':'Georgia'}},'*'),dark);
   await frame.waitForFunction((dark)=>document.documentElement.classList.contains('dark')===dark && getComputedStyle(document.querySelector('[data-diagram] text')!).fill===(dark?'rgb(230, 230, 230)':'rgb(30, 30, 30)'),{},dark);
   await frame.click('button');
   await frame.waitForFunction(()=>document.querySelector('[data-diagram]')!.getAttribute('aria-label')!=='PlantUML: заказы 0');
   const metrics=await frame.evaluate(()=>({scheme:getComputedStyle(document.documentElement).colorScheme,overflow:document.body.scrollWidth>innerWidth,diagrams:[...document.querySelectorAll('[data-diagram]')].map(el=>({scroll:el.scrollWidth>el.clientWidth,svgWidth:el.querySelector('svg')!.getBoundingClientRect().width,text:el.textContent,fonts:[...el.querySelectorAll('text')].map(t=>getComputedStyle(t).fontFamily),fill:getComputedStyle(el.querySelector('text')!).fill})),ids:[...document.querySelectorAll('[id]')].map(el=>el.id)}));
   assert.equal(metrics.scheme,dark?'dark':'light');assert.equal(metrics.overflow,false);assert.equal(metrics.diagrams.length,3);assert.equal(new Set(metrics.ids).size,metrics.ids.length);
   for(const d of metrics.diagrams){assert(d.text?.includes('Пользователь'));assert(d.fonts.every(f=>f.includes('Georgia')));assert.equal(d.fill,dark?'rgb(230, 230, 230)':'rgb(30, 30, 30)');if(width===390)assert(d.scroll);}
   await page.screenshot({path:`work/kroki/${width}-${dark?'dark':'light'}.png`,fullPage:true});
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 console.log('PASS: real PlantUML/Mermaid, Cyrillic, keys, both themes, fonts, horizontal scroll, duplicate IDs, offline rendering');
}finally{await browser.close();}
// The production headless helper lives until its owning process exits.
process.exit(0);
