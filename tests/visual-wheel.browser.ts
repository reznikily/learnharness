// Round-2 probe: real Chat + real DemoOutputCard + real stick-to-bottom, synthetic demos.
// Measures the SCREEN position of the pressed control per frame (iframe rAF + parent rAF joined on wall time).
// Usage (repo root): npx tsx work/demo-ux-opus/round2/probe2.ts <round1|after>
import { build } from "esbuild";
import fs from "node:fs";
import { createServer } from "node:http";
import puppeteer, { type Page, type Frame } from "puppeteer-core";
import { visualDocument } from "../src/agent/subagents/visual-document.ts";
import { stepperSource } from "./fixtures/visual-wheel-source.ts";
import assert from "node:assert/strict";
const label = process.env.DEMO_WHEEL_BASELINE ? "before" : "after";
const out = process.env.DEMO_WHEEL_OUTPUT ?? `work/demo-wheel-astra/${label}`;
fs.mkdirSync(out, { recursive: true });
const bundle = await build({ entryPoints: ["tests/fixtures/visual-chat.tsx"], bundle: true, write: false, minify: true, format: "iife", platform: "browser", define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "isolated", setup(b) {
	b.onResolve({ filter: /^next\/(navigation|link)$/ }, a => ({ path: a.path, namespace: "fixture" }));
	b.onResolve({ filter: /^node:crypto$/ }, a => ({ path: a.path, namespace: "fixture" }));
	b.onLoad({ filter: /.*/, namespace: "fixture" }, a => ({ loader: "tsx", resolveDir: process.cwd(), contents: a.path === "next/link" ? 'import React from "react"; export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}' : a.path === "node:crypto" ? 'export function createHash(){throw Error("server crypto")} export function randomBytes(){throw Error("server crypto")}' : 'const router={push(){},replace(){},refresh(){},prefetch(){}};export const useRouter=()=>router;export const usePathname=()=>"/chat/synthetic";export const useSearchParams=()=>new URLSearchParams();' }));
	// round1 = the first round's demo-card (in memory only; working file untouched).
	b.onLoad({ filter: /components\/artifacts\/demo-card\.tsx$/ }, a => !!process.env.DEMO_WHEEL_BASELINE ? { loader: "tsx", resolveDir: a.path.replace(/\/[^/]+$/, ""), contents: fs.readFileSync(process.env.DEMO_WHEEL_BASELINE!, "utf8") } : undefined);
} }] });
const runtime = JSON.parse(fs.readFileSync("src/generated/visual-runtime.json", "utf8"));
const doc = visualDocument(stepperSource);
const server = createServer((req, res) => {
 res.setHeader("Content-Type", req.url === "/app.js" ? "text/javascript" : req.url === "/style.css" ? "text/css" : "text/html");
 res.end(req.url === "/app.js" ? bundle.outputFiles[0]!.text : req.url === "/style.css" ? runtime.css + fs.readFileSync("components/chat-width-rails.css", "utf8") : `<!doctype html><html class="dark"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><div id="root"></div><script>window.__name=f=>f;window.process={env:{}};window.demoHTML=${JSON.stringify(doc).replace(/</g,"\\u003c")}</script><script src="/app.js"></script></html>`);
});
await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${(server.address() as {port:number}).port}/?after=long`;
const wait = (ms:number) => new Promise(r=>setTimeout(r,ms));
const SC='[role="log"] > div';
type Write={t:number;before:number;after:number;stack?:string};
type Trace={start:number;writes:Write[];cancel:number[];inputs:{type:string;trusted:boolean;t:number;source:string}[]};
declare global {interface Window { wheelTrace:Trace; delayFollow:boolean; __name:unknown }}
const browser = await puppeteer.launch({executablePath:process.env.CHROME_PATH??"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",headless:true});
const results:unknown[]=[];
try {
 const page=await browser.newPage();
 await page.evaluateOnNewDocument(()=>{
  addEventListener('message',e=>{if(window.delayFollow&&e.data?.follow){window.delayFollow=false;e.stopImmediatePropagation();setTimeout(()=>dispatchEvent(new MessageEvent('message',{data:e.data,source:e.source,origin:e.origin})),180)}},true);
  const d=Object.getOwnPropertyDescriptor(Element.prototype,'scrollTop')!;
  Object.defineProperty(Element.prototype,'scrollTop',{get(){return d.get!.call(this)},set(v){const before=d.get!.call(this);d.set!.call(this,v);if(window.wheelTrace&&this.matches?.('[role="log"] > div'))window.wheelTrace.writes.push({t:performance.timeOrigin+performance.now(),before,after:d.get!.call(this),stack:new Error().stack})},configurable:true});
  addEventListener('message',e=>{if(!window.wheelTrace)return;if(e.data?.type==='demo-follow-cancel')window.wheelTrace.cancel.push(performance.timeOrigin+performance.now());if(e.data?.type==='test-input')window.wheelTrace.inputs.push(e.data.input)});
  for(const type of ['wheel','keydown','touchstart','click'])addEventListener(type,e=>window.wheelTrace?.inputs.push({type,trusted:e.isTrusted,t:performance.timeOrigin+performance.now(),source:"parent"}),true);
 });
 async function setup(width:number){
  await page.setViewport({width,height:900});await page.goto(url);
  const f=(await(await page.waitForSelector('iframe'))!.contentFrame())!;await f.waitForSelector('#next');await wait(700);
  const box=(await(await page.$(SC))!.boundingBox())!;
  await page.mouse.move(box.x+4,200);await page.mouse.wheel({deltaY:-800});await wait(250);
  const inner=await f.$eval('#next',e=>e.getBoundingClientRect().top);
  await page.evaluate((inner,SC)=>{const s=document.querySelector(SC)!;s.scrollTop+=document.querySelector('iframe')!.getBoundingClientRect().top+inner-s.getBoundingClientRect().top-s.clientHeight*.4},inner,SC);await wait(200);
  await f.evaluate(()=>{for(const type of ['wheel','keydown','touchstart','click'])addEventListener(type,e=>parent.postMessage({type:'test-input',input:{type,trusted:e.isTrusted,t:performance.timeOrigin+performance.now(),source:"iframe"}},'*'),true)});
  const b=(await(await f.$('#next'))!.boundingBox())!;assert(b.y>40&&b.y+b.height<650,'control visibly clickable');
  await page.evaluate(SC=>{window.wheelTrace={start:document.querySelector(SC)!.scrollTop,writes:[],cancel:[],inputs:[]}},SC);
  const outside=await page.evaluate(SC=>{const s=document.querySelector(SC)!;const r=s.getBoundingClientRect();for(const x of [r.left+16,r.right-16,r.left+40,r.right-40])for(const y of [r.top+50,r.top+100,r.bottom-200]){const el=document.elementFromPoint(x,y);if(el&&el.tagName!=="IFRAME"&&s.contains(el))return {x,y,target:el.tagName+"."+el.className};}throw Error("No native scroll target outside iframe")},SC);
  console.log("outside target",outside);
  return {f,x:b.x+b.width/2,y:b.y+b.height/2,outsideX:outside.x,outsideY:outside.y};
 }
 // Deterministic message-hop race: native wheel arrives before a queued follow report.
 {const {f,x,y,outsideX,outsideY}=await setup(420);
  await page.evaluate(()=>{window.delayFollow=true});await page.mouse.click(x,y);await wait(30);
  await page.mouse.move(outsideX,outsideY);await page.mouse.wheel({deltaY:-300});await wait(500);
  const trace=await page.evaluate(()=>window.wheelTrace);const wheel=trace.inputs.find(e=>e.type==='wheel')!;
  const late=trace.writes.filter(w=>w.t>wheel.t);const end=await page.$eval(SC,e=>e.scrollTop);
  fs.writeFileSync(`${out}/queued-case.json`,JSON.stringify({trace,end},null,2));
  await page.screenshot({path:`${out}/queued-cancel.png`});
  assert(wheel.trusted,'queued-plan race uses native wheel');
  assert.equal(late.length,0,'queued pre-wheel plan must not restart autoscroll');
  assert.equal(end-trace.start,-300,'native wheel survives queued resize');
  assert(await f.evaluate(()=>document.body.textContent?.includes('Шаг 1 из 3')),'race clicked demo');
  console.log('PASS queued plan cancellation');
 }
 const widths=process.env.DEMO_WHEEL_WIDTHS === "none" ? [] : process.env.DEMO_WHEEL_WIDTHS?.split(",").map(Number)??[420,640,1024,1440];
 for(const width of widths)for(const slow of [0,25])for(const delay of [0,40,50,100])for(const direction of [-1,1])for(const outside of [false,true]){
  const {f,x,y,outsideX,outsideY}=await setup(width);
  if(slow)await page.evaluate(ms=>{const end=performance.now()+1400;const tick=()=>{const start=performance.now();while(performance.now()-start<ms){}if(performance.now()<end)requestAnimationFrame(tick)};requestAnimationFrame(tick)},slow);
  await page.mouse.click(x,y);await wait(delay);
  if(outside)await page.mouse.move(outsideX,outsideY);
  await page.mouse.wheel({deltaY:direction*300});await wait(420);
  const clicked=await f.evaluate(()=>document.body.textContent?.includes('Шаг 1 из 3'));if(!clicked){await page.screenshot({path:`${out}/failed-click.png`});console.log('failed click',await f.evaluate(()=>document.getElementById("root")?.textContent?.slice(0,500)),{x,y},await page.evaluate((x,y)=>document.elementFromPoint(x,y)?.outerHTML.slice(0,200),x,y));}assert(clicked,'native click advanced demo');
  // Let the old plan finish, but remain inside the bridge's 1 s interaction window.
  // Without clearing the iframe anchor, this starts another burst after an outside wheel.
  await f.$eval('#next',e=>(e as HTMLElement).click());await wait(450);
  const trace=await page.evaluate(()=>window.wheelTrace);
  const end=await page.$eval(SC,e=>e.scrollTop);
  const wheel=trace.inputs.find(e=>e.type==='wheel');assert(wheel?.trusted,'native trusted wheel reached a document');
  const native=end-trace.start-trace.writes.reduce((n,w)=>n+w.after-w.before,0);
  const cancelled=wheel.source==="parent"?wheel.t:trace.cancel.find(t=>t>=wheel.t);
  assert(cancelled!==undefined,"iframe cancellation reaches parent");
  const later=trace.writes.filter(w=>cancelled!==undefined&&w.t>cancelled);
  const click=trace.inputs.find(e=>e.type==='click');
  const result={width,slow,delay,actualDelay:click?wheel.t-click.t:null,direction,outside,native,writesAfterCancel:later.length,trace,end};results.push(result);
  fs.writeFileSync(`${out}/native-wheel.json`,JSON.stringify({browser:await browser.version(),results},null,2));
  assert(Math.abs(native-direction*300)<2,`native wheel displacement lost: ${JSON.stringify({...result,trace:undefined})}`);
  assert.equal(later.length,0,`autoscroll after cancellation: ${width}/${slow}/${delay}/${direction}/${outside}`);
  if(width===420&&slow===25&&delay===50&&direction===-1&&!outside)await page.screenshot({path:`${out}/wheel-420.png`});
  console.log('PASS wheel',width,slow,delay,direction,outside,native);
 }
 for(const kind of ['PageUp','PageDown','touch'] as const){
  const {f,x,y}=await setup(1024);await page.mouse.click(x,y);await wait(50);
  if(kind==='touch'){
   const cdp=await page.createCDPSession();
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+70}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  }else await page.keyboard.press(kind);
  await wait(340);const marker=await page.evaluate(()=>performance.timeOrigin+performance.now());
  await f.$eval('#next',e=>(e as HTMLElement).click());await wait(400);
  const trace=await page.evaluate(()=>window.wheelTrace);
  results.push({kind,trace});fs.writeFileSync(`${out}/native-wheel.json`,JSON.stringify({results},null,2));
  assert(trace.inputs.some(e=>e.trusted&&e.type===(kind==='touch'?'touchstart':'keydown')),`native ${kind}`);
  assert.equal(trace.writes.filter(w=>w.t>marker).length,0,`${kind} must clear iframe follow anchor`);
  console.log('PASS',kind);
 }
 fs.writeFileSync(`${out}/native-wheel.json`,JSON.stringify({browser:await browser.version(),results},null,2));
}finally{await browser.close();server.close()}
