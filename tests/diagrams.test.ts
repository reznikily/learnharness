import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderDiagram, prepareDiagramSource, normalizeDiagramSvg} from '../src/agent/subagents/diagrams.ts';
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200"><rect width="500" height="100" fill="#fff" style="stroke:#181818;stroke-dasharray:7,7"/><text x="10" y="20">Ключ PK</text></svg>';
test('local-only request, original source and themed SVG survive',async()=>{
 const source='@startuml\nentity User\n@enduml';
 const result=await renderDiagram('plantuml',source,undefined,async(url,opts)=>{
  assert.equal(url,'http://127.0.0.1:8001/plantuml/svg');assert.equal(opts?.redirect,'error');
  assert.match(String(opts?.body),/skinparam/);return new Response(svg);
 });
 assert.equal(result.source,source);assert.match(result.svg,/var\(--background\)/);assert.match(result.svg,/stroke-dasharray="7,7"/);assert.match(result.svg,/Ключ PK/);
});
test('sources cannot read files, URLs or override app styling',()=>{
 for(const source of ['@startuml\n!include /etc/passwd\n@enduml','@startuml\n%load_json("x")\n@enduml','@startuml\n<img src="file:x">\n@enduml','@startuml\nskinparam dpi 500\n@enduml'])assert.throws(()=>prepareDiagramSource('plantuml',source));
 for(const source of ['%%{init:{}}%%\nerDiagram','flowchart LR\n A-->B','erDiagram\n click A "https://x"'])assert.throws(()=>prepareDiagramSource('mermaid',source));
 assert.match(prepareDiagramSource('mermaid','erDiagram\n A ||--o{ B : owns'),/"htmlLabels":false/);
});
test('reject unsafe or malformed SVG and oversized input',()=>{
 for(const fragment of ['<script/>','<image href="https://x"/>','<rect onclick="x()"/>','<foreignObject/>','<use href="file:x"/>','<rect style="fill:url(https://x)"/>'])assert.throws(()=>normalizeDiagramSvg(svg.replace('</svg>',fragment+'</svg>')));
 assert.throws(()=>normalizeDiagramSvg('<html>failure</html>'));
 assert.throws(()=>prepareDiagramSource('plantuml','x'.repeat(100_001)));
});
test('no success on server error, unavailable renderer, or abort',async()=>{
 await assert.rejects(renderDiagram('mermaid','erDiagram',undefined,async()=>new Response('syntax',{status:400})),/400/);
 await assert.rejects(renderDiagram('mermaid','erDiagram',undefined,async()=>{throw new Error('offline');}),/Kroki/);
 const c=new AbortController();c.abort();await assert.rejects(renderDiagram('mermaid','erDiagram',c.signal));
});

test('builder embeds assets in saved document and keeps legacy tools unchanged',async()=>{
 const {createDemoBuilderTools}=await import('../src/agent/subagents/demo-builder.ts');
 const state={html:null as string|null,testedHtml:null,lastResult:null};
 const headless={unavailableReason:()=>null,runDemo:async()=>({ok:true,consoleErrors:[],pageErrors:[],failedRequests:[]})} as any;
 const tools=createDemoBuilderTools(state,headless,undefined,true);
 assert(tools.render_diagram);
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(svg);
 try {
  const rendered=await tools.render_diagram.execute('render',{engine:'mermaid',source:'erDiagram\n A ||--o{ B : owns'});
  const id=(rendered.details as any).id;assert.equal(typeof id,'string');
  await tools.write_demo!.execute('write',{html:`function Demo(){return h(Diagram,{id:${JSON.stringify(id)},label:'Связи'});}return Demo;`});
  assert.match(state.html!,/visual-diagrams/);assert.match(state.html!,/erDiagram/);assert.match(state.html!,/Ключ PK/);
  assert.match(state.html!,/connect-src 'none'/);
  assert.equal(createDemoBuilderTools(state,headless).render_diagram,undefined);
 }finally{globalThis.fetch=original;}
});

test('bounded output and render deadline fail without an artifact',async(t)=>{
 await assert.rejects(renderDiagram('mermaid','erDiagram',undefined,async()=>new Response('x'.repeat(2_000_001))),/2 MB/);
 t.mock.method(AbortSignal,'timeout',()=>AbortSignal.abort(new DOMException('Timed out','TimeoutError')));
 await assert.rejects(renderDiagram('mermaid','erDiagram',undefined,async()=>{assert.fail('request after deadline');}),{name:'TimeoutError'});
});
test('preserve ER marker references, dashed relations and rounded entity geometry',()=>{
 const result=normalizeDiagramSvg('<svg viewBox="0 0 400 200"><defs><marker id="many"><path d="M0 0L2 2"/></marker></defs><rect rx="16" width="80" height="60"/><path class="relationshipLine edge-pattern-dashed" marker-end="url(#many)" d="M0 0L100 100"/></svg>');
 assert.match(result,/rx="16"/);assert.match(result,/marker-end="url\(#many\)"/);assert.match(result,/stroke-dasharray="8 8"/);
});
