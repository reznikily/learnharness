import {DOMParser} from 'linkedom';

export interface DiagramResource {engine:'plantuml'|'mermaid'; source:string; svg:string}
const MAX_SVG = 2_000_000;

export function prepareDiagramSource(engine:DiagramResource['engine'], source:string):string {
 if(!source.trim() || Buffer.byteLength(source)>100_000) throw new Error('Diagram source must be 1–100000 bytes.');
 // Renderers have file/network primitives; only self-contained ER notation is accepted.
 if(/[!%$]|\[\[|(?:https?|file|data|ftp):|<\/?(?:img|image|style|script)\b/i.test(source)) throw new Error('External resources, preprocessing and embedded markup are not allowed.');
 if(engine==='plantuml') {
  if(!/^\s*@startuml\s*\n[\s\S]*\n@enduml\s*$/.test(source) || (source.match(/@/g)||[]).length!==2 || /\b(?:skinparam|skin|theme|sprite|url)\b|<style|#[a-z0-9]/i.test(source)) throw new Error('Use @startuml / @enduml and entity notation without custom styles or resources.');
  return source.replace(/@startuml\s*\n/, '@startuml\nskinparam backgroundColor transparent\nskinparam defaultFontName SansSerif\nskinparam defaultFontSize 16\nskinparam shadowing false\nhide circle\n');
 }
 if(engine!=='mermaid' || !/^\s*erDiagram(?:\s|$)/.test(source) || /\b(?:click|style|classDef|linkStyle|callback)\b|[<>]/i.test(source)) throw new Error('Use Mermaid erDiagram without directives, links or custom styles.');
 return '%%{init: {"theme":"base","htmlLabels":false,"look":"classic","er":{"useMaxWidth":false},"themeVariables":{"fontFamily":"sans-serif","fontSize":"16px"}}}%%\n'+source;
}

const tags=new Set('svg g defs marker path rect circle ellipse line polyline polygon text tspan title desc clipPath'.split(' '));
const attrs=new Set('id class viewBox xmlns x y x1 y1 x2 y2 cx cy r rx ry width height d points transform fill stroke stroke-width stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin fill-rule clip-rule opacity fill-opacity stroke-opacity marker-start marker-end marker-mid markerWidth markerHeight markerUnits refX refY orient text-anchor dominant-baseline dy dx font-size font-weight font-style textLength lengthAdjust clip-path'.split(' '));
const geometryStyles=new Set('stroke-width stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin fill-rule opacity fill-opacity stroke-opacity font-size font-weight font-style text-anchor'.split(' '));

export function normalizeDiagramSvg(input:string):string {
 if(Buffer.byteLength(input)>MAX_SVG || /<!DOCTYPE|<!ENTITY/i.test(input)) throw new Error('Invalid or oversized diagram SVG.');
 const doc=new DOMParser().parseFromString(input,'image/svg+xml') as unknown as Document;
 const root=doc.documentElement;
 if(root?.localName!=='svg' || !input.trim().endsWith('</svg>')) throw new Error('Kroki did not return SVG.');
 const box=root.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number);
 if(!box || box.length!==4 || box.some(n=>!Number.isFinite(n)) || box[2]!<=0 || box[3]!<=0 || box[2]!>100000 || box[3]!>100000) throw new Error('Invalid diagram dimensions.');
 for(const filter of Array.from(root.querySelectorAll('filter, linearGradient, radialGradient'))) filter.remove();
 for(const el of [root,...Array.from(root.querySelectorAll('*'))]) {
  if(el.localName==='style') {el.remove();continue;}
  if(!tags.has(el.localName)) throw new Error(`Unsupported diagram SVG element: ${el.localName}`);
  for(const attr of Array.from(el.attributes)) {
   if(/^on/i.test(attr.name) || /href$/i.test(attr.name) || /url\(\s*(?!#[\w-]+\s*\))/i.test(attr.value)) throw new Error('Unsafe diagram SVG resource or handler.');
   if(attr.name==='style') {
    for(const declaration of attr.value.split(';')) {
     const colon=declaration.indexOf(':');const key=declaration.slice(0,colon).trim();const value=declaration.slice(colon+1).trim();
     if(geometryStyles.has(key)||key==='fill'||key==='stroke') el.setAttribute(key,value);
    }
   }
   if(!attrs.has(attr.name)) el.removeAttribute(attr.name);
  }
  for(const key of ['fill','stroke']) {
   const value=el.getAttribute(key);
   if(value && !['none','transparent'].includes(value)) el.setAttribute(key,key==='stroke' || /^#(?:000(?:000)?|181818|333(?:333)?)$/i.test(value)?'currentColor':'var(--background)');
  }
  if(el.localName==='text'||el.localName==='tspan') {el.setAttribute('fill','currentColor');el.setAttribute('stroke','none');}
  if(el.classList.contains('relationshipLine')) {el.setAttribute('fill','none');el.setAttribute('stroke','currentColor');}
  if(el.classList.contains('edge-pattern-dashed')) el.setAttribute('stroke-dasharray','8 8');
  if(el.localName==='marker') {el.setAttribute('fill','none');el.setAttribute('stroke','currentColor');}
  if(el.localName==='rect' && !el.hasAttribute('fill')) {
   el.setAttribute('fill','var(--background)');
   if(el.classList.contains('label-container') || el.classList.contains('entityBox')) el.setAttribute('stroke','currentColor');
  }
  el.removeAttribute('class');
 }
 root.removeAttribute('id');root.setAttribute('width',String(box[2]));root.setAttribute('height',String(box[3]));
 root.setAttribute('fill','none');root.setAttribute('font-size','16');
 return root.outerHTML;
}

export async function renderDiagram(engine:DiagramResource['engine'],source:string,signal?:AbortSignal,request:typeof fetch=fetch):Promise<DiagramResource> {
 const body=prepareDiagramSource(engine,source);
 const combined=AbortSignal.any([AbortSignal.timeout(20_000),...(signal?[signal]:[])]);
 combined.throwIfAborted();
 let response:Response;
 try {response=await request(`http://127.0.0.1:8001/${engine}/svg`,{method:'POST',headers:{'Content-Type':'text/plain; charset=utf-8'},body,signal:combined,redirect:'error'});}
 catch(error) {combined.throwIfAborted();throw new Error('Локальный Kroki недоступен (127.0.0.1:8001). Запустите его вручную и повторите render_diagram.',{cause:error});}
 if(!response.ok) {await response.body?.cancel();throw new Error(`Kroki: ошибка рендера (${response.status}). Проверьте синтаксис схемы.`);}
 const reader=response.body?.getReader();if(!reader)throw new Error('Empty Kroki response.');
 const chunks:Uint8Array[]=[];let size=0;
 try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_SVG)throw new Error('Diagram SVG exceeds 2 MB.');chunks.push(value);}}
 finally {await reader.cancel();reader.releaseLock();}
 combined.throwIfAborted();
 return {engine,source,svg:normalizeDiagramSvg(Buffer.concat(chunks).toString('utf8'))};
}
