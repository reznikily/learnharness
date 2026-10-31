import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { visualDocument } from '../src/agent/subagents/visual-document.ts';

// Real runtime regression: unchanged formulas must keep their DOM during demo
// interaction; diagram measurements must not force one layout per label.
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
 const page = await browser.newPage();
 await page.setViewport({ width: 1024, height: 900 });
 const errors: string[] = [];
 page.on('pageerror', error => errors.push(String(error)));
 const source = `function Demo(){const [n,setN]=useState(0);return h('div',null,h(Button,{onClick:()=>setN(n+1)},'Next '+n),h('div',{id:'static-formula'},h(Formula,{tex:'x^2+y^2=z^2'})),h('div',{id:'dynamic-formula'},h(Formula,{tex:'n='+n})));}return Demo;`;
 await page.setContent(visualDocument(source));
 await page.waitForSelector('#static-formula .katex');
 await page.evaluate(() => { (window as unknown as { stableFormula: Element | null }).stableFormula = document.querySelector('#static-formula .katex'); });
 await page.focus('button');
 await page.keyboard.press('Enter');
 await page.waitForFunction(() => document.querySelector('button')?.textContent === 'Next 1');
 assert(await page.evaluate(() => document.activeElement === document.querySelector('button')), 'demo keyboard focus survives updates');
 assert.equal(await page.$eval('#dynamic-formula annotation', node => node.textContent), 'n=1', 'changed TeX updates');
 assert(await page.evaluate(() => (window as unknown as { stableFormula: Element }).stableFormula === document.querySelector('#static-formula .katex')), 'unchanged formula DOM survives unrelated state');

 const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700">' + Array.from({ length: 120 }, (_, i) => `<text x="${i % 4 * 220}" y="${20 + Math.floor(i / 4) * 20}" font-size="14"${i === 0 ? ' textLength="123" lengthAdjust="spacingAndGlyphs"' : ''}>Поле таблицы ${i}</text>`).join('') + '</svg>';
 const diagramSource = `function Demo(){const [n,setN]=useState(0);return h('div',null,h(Button,{onClick:()=>setN(n+1)},'Update label'),h(Diagram,{id:'test',label:'Схема '+n}));}return Demo;`;
 await page.goto('about:blank');
 const session = await page.createCDPSession();
 await session.send('Performance.enable');
 const before = await page.metrics();
 await page.setContent(visualDocument(diagramSource, { test: { engine: 'plantuml', source: 'synthetic saved SVG', svg } }));
 await page.waitForSelector('[data-diagram] text[textLength]');
 const after = await page.metrics();
 assert(before.LayoutCount !== undefined && after.LayoutCount !== undefined);
 assert(after.LayoutCount - before.LayoutCount < 12, 'diagram batches measurements rather than forcing a layout per label');
 const geometry = await page.$$eval('[data-diagram] text', nodes => nodes.map(node => ({ width: node.getAttribute('textLength'), font: (node as SVGTextElement).style.fontFamily })));
 assert.equal(geometry[0]!.width, '123', 'renderer-provided textLength survives');
 assert(geometry.every(text => Number(text.width) > 0 && text.font === 'var(--font-sans)'), 'all labels keep measured width and app font');
 await page.click('button');
 await page.waitForFunction(() => document.querySelector('[data-diagram]')?.getAttribute('aria-label') === 'Схема 1');
 assert.deepEqual(await page.$$eval('[data-diagram] text', nodes => nodes.map(node => ({ width: node.getAttribute('textLength'), font: (node as SVGTextElement).style.fontFamily }))), geometry, 'label-only updates preserve SVG text geometry');
 assert.deepEqual(errors, []);
 console.log('PASS: stable formula DOM, dynamic TeX, keyboard focus, batched SVG measurements, existing textLength and dynamic labels');
} finally { await browser.close(); }
