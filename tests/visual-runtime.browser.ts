import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import {visualDocument} from '../src/agent/subagents/visual-document.ts';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const page=await browser.newPage();await page.setViewport({width:390,height:800});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.setContent('<meta charset="utf-8"><body style="margin:0"><iframe sandbox="allow-scripts" style="width:100%;border:0;height:700px"></iframe>');
 const html=visualDocument(`function Demo(){const [n,setN]=useState(2);return h(Stack,null,h(Text,null,'Квадрат '+n),h(Row,null,h(Button,{onClick:()=>setN(n+1)},'Увеличить')),h(Formula,{tex:'n^2='+n*n}),h(Figure,{label:'Фигура'},h('rect',{x:10,y:10,width:50,height:50})),h(Canvas,{label:'Холст',draw:(ctx,c)=>{ctx.fillStyle=c.primary;ctx.fillRect(0,0,20,20)}}));}return Demo;`);
 await page.$eval('iframe',(el,html)=>{(el as HTMLIFrameElement).srcdoc=html;},html);
 const frame=await (await page.$('iframe'))!.contentFrame();assert(frame);await frame.waitForSelector('button');
 await frame.click('button');await frame.waitForFunction(()=>document.getElementById('root')!.textContent!.includes('Квадрат 3'));
 await page.$eval('iframe',el=>(el as HTMLIFrameElement).contentWindow!.postMessage({type:'visual-theme',dark:false,tokens:{'--foreground':'rgb(20, 30, 40)','--primary':'rgb(255, 0, 0)'}},'*'));
 await frame.waitForFunction(()=>getComputedStyle(document.body).color==='rgb(20, 30, 40)');
 const result=await frame.evaluate(()=>({text:document.getElementById('root')!.textContent,background:getComputedStyle(document.body).backgroundColor,overflow:document.body.scrollWidth>innerWidth,canvas:Array.from(document.querySelector('canvas')!.getContext('2d')!.getImageData(1,1,1,1).data),isolated:(()=>{try{void parent.document;return false;}catch{return true;}})()}));
 assert(result.text?.includes('Квадрат 3'));assert.equal(result.background,'rgba(0, 0, 0, 0)');assert.equal(result.overflow,false);assert.deepEqual(result.canvas,[255,0,0,255]);assert(result.isolated);assert.deepEqual(errors,[]);
 console.log('PASS: interaction, theme without reset, SVG/Canvas, 390px layout, transparency, sandbox');
} finally {await browser.close();}
