import assert from "node:assert/strict";
import { createServer } from "node:http";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFile } from "node:fs/promises";
import puppeteer, { type Page } from "puppeteer-core";

// Real Chat, SessionModel and app CSS; only the server is scripted in the page.
const bundle = await build({ entryPoints: ["tests/fixtures/motion-feedback.tsx"], bundle: true, write: false, outdir: "/tmp/lh-motion-feedback", minify: true, format: "iife", platform: "browser", loader: { ".ttf": "empty", ".woff2": "empty", ".woff": "empty" }, define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "isolated", setup(b) {
	b.onResolve({ filter: /^next\/(navigation|link)$/ }, a => ({ path: a.path, namespace: "fixture" }));
	b.onResolve({ filter: /^node:crypto$/ }, a => ({ path: a.path, namespace: "fixture" }));
	b.onLoad({ filter: /.*/, namespace: "fixture" }, a => ({ loader: "tsx", resolveDir: process.cwd(), contents: a.path === "next/link" ? 'import React from "react"; export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}' : a.path === "node:crypto" ? 'export function createHash(){throw Error("server crypto")} export function randomBytes(){throw Error("server crypto")}' : 'const router={push(){},replace(){},refresh(){},prefetch(){}};export const useRouter=()=>router;export const usePathname=()=>"/chat/synthetic";export const useSearchParams=()=>new URLSearchParams();' }));
} }] });
const js = bundle.outputFiles.find(f => f.path.endsWith(".js"))!.text;
const fixtureCss = bundle.outputFiles.find(f => f.path.endsWith(".css"))?.text ?? "";
const appCss = (await postcss([tailwind()]).process(await readFile("app/globals.css", "utf8"), { from: "app/globals.css" })).css;
const server = createServer((req, res) => {
	res.setHeader("Content-Type", req.url === "/app.js" ? "text/javascript" : req.url === "/app.css" ? "text/css" : "text/html");
	res.end(req.url === "/app.js" ? js : req.url === "/app.css" ? appCss + fixtureCss : '<!doctype html><html class="dark"><meta charset="utf-8"><link rel="stylesheet" href="/app.css"><div id="root"></div><script>window.process={env:{}}</script><script src="/app.js"></script></html>');
});
await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const errors: string[] = [];

/** One tab with a logged Element.animate; `seed` builds the server's record. */
async function open(seed: string, reduced = false): Promise<Page> {
	const page = await browser.newPage();
	page.on("pageerror", e => { errors.push(String(e)); console.error("pageerror", String(e)); });
	await page.setViewport({ width: 1280, height: 800 });
	if (reduced) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
	await page.evaluateOnNewDocument(() => {
		(window as any).__name = (fn: unknown) => fn;
		const log: unknown[] = ((window as any).__motion = []);
		const raw = Element.prototype.animate;
		Element.prototype.animate = function (frames: any, options: any) {
			log.push({ duration: options?.duration, first: JSON.stringify(Array.isArray(frames) ? frames[0] : frames), tag: this.tagName });
			return raw.call(this, frames, options);
		};
	});
	await page.goto(url);
	await page.evaluate(`(()=>{const {call,quizArgs,save}=window.__fixture;const srv=window.__srv;if(!srv.seeded){${seed};srv.seeded=true;save();}window.__mount();})()`);
	await page.waitForSelector('[data-testid="dock-spacer"]');
	await wait(250);
	return page;
}
const motion = (page: Page) => page.evaluate(() => (window as any).__motion as Array<{ duration: number; first: string; tag: string }>);
const count = async (page: Page) => {
	const log = await motion(page);
	return { pop: log.filter(m => m.duration === 300).length, glare: log.filter(m => m.duration === 500).length, sparks: log.filter(m => m.duration === 450).length, fade: log.filter(m => m.duration === 160 && m.first.includes("opacity")).length };
};
const NONE = { pop: 0, glare: 0, sparks: 0, fade: 0 };
const OLD = 1000;
const history = `srv.messages.push({id:'u0',role:'user',content:'hi',timestamp:${OLD}},call('old-q','quiz',quizArgs('Old?'),${OLD}),{id:'r0',role:'toolResult',toolCallId:'old-q',toolName:'quiz',content:[{type:'text',text:'ok'}],details:{kind:'quiz',questionText:'Old?',answers:[{index:2}],options:[{index:1,label:'Venus'},{index:2,label:'Mercury'}],correct:true,correctIndices:[2]},isError:false,timestamp:${OLD}},call('old-c','conclude',{outcome:'solved',verdict:'old'},${OLD}),{id:'r1',role:'toolResult',toolCallId:'old-c',toolName:'conclude',content:[{type:'text',text:'ok'}],details:null,isError:false,timestamp:${OLD}});`;
const pendingQuiz = `srv.messages.push(call('q1','quiz',quizArgs('Closest planet?'),Date.now()));`;

async function answer(page: Page, label: string) {
	await page.waitForSelector('[data-kbdrow="0"], [data-testid="question-dock-bar"], [data-testid="teach-check-reveal"]', { timeout: 5000 });
	const bar = await page.$('[data-testid="question-dock-bar"], [data-testid="teach-check-reveal"]');
	if (bar) await bar.click();
	await page.waitForSelector('[data-kbdrow="0"]', { timeout: 5000 }).catch(async (e) => { await page.screenshot({ path: "work/ui-motion/fail.png" }); console.error(await page.evaluate(() => document.body.innerText.slice(-600))); throw e; });
	const clicked = await page.evaluate((l) => { const b = [...document.querySelectorAll<HTMLElement>("[data-kbdrow]")].find(e => e.textContent?.includes(l)); if (b?.getAttribute("aria-checked") !== "true") b?.click(); return !!b; }, label);
	assert(clicked, "option present");
	await page.evaluate(() => { [...document.querySelectorAll("button")].find(b => b.textContent === "Submit answer")!.click(); });
}

try {
	// History: old correct quiz and solved conclude stay still, also after reload.
	{
		const page = await open(history);
		assert.equal(await page.$$eval('[data-testid="answered-card"]', e => e.length), 1, "old quiz rendered");
		await page.waitForSelector('[data-testid="conclude-card"]');
		assert.deepEqual(await count(page), NONE, "history plays nothing");
		await page.reload();
		await page.evaluate(() => (window as any).__mount());
		await wait(400);
		assert.deepEqual(await count(page), NONE, "reload plays nothing");
		await page.close();
	}
	// A refused POST never celebrates; acceptance plays once, without moving layout.
	{
		const page = await open(`${pendingQuiz};srv.postStatus=500;`);
		await answer(page, "Mercury");
		await wait(300);
		assert.deepEqual(await count(page), NONE, "a refused POST shows no success");
		await page.evaluate(() => { (window as any).__srv.postStatus = 200; (window as any).__srv.postDelay = 200; });
		await answer(page, "Mercury");
		await page.waitForSelector('[data-testid="answered-card"]');
		assert.deepEqual(await count(page), NONE, "optimistic card waits for acceptance");
		await page.waitForFunction(() => (window as any).__motion.some((m: any) => m.duration === 450), { timeout: 3000 });
		assert.deepEqual(await count(page), { pop: 1, glare: 1, sparks: 6, fade: 0 });
		await page.screenshot({ path: "work/ui-motion/mid-effect.png" });
		const frames = await page.evaluate(async () => {
			const card = document.querySelector('[data-testid="answered-card"]')!;
			const scroller = card.closest('[role="log"]') ?? document.scrollingElement!;
			const out: number[][] = [];
			for (let i = 0; i < 30; i++) { const r = card.getBoundingClientRect(); out.push([r.height, r.width, scroller.scrollHeight]); await new Promise(requestAnimationFrame); }
			return out;
		});
		assert.equal(new Set(frames.map(f => f.join())).size, 1, `no layout change during the effect: ${JSON.stringify(frames.slice(0, 3))}`);
		await page.screenshot({ path: "work/ui-motion/after-effect.png" });
		await wait(700);
		assert.equal(await page.$$eval('[data-testid="answered-card"] span[style*="position: absolute"]', e => e.length), 0, "transient nodes removed");
		assert.equal(await page.evaluate(() => (window as any).__srv.posts), 2);
		await page.reload();
		await page.evaluate(() => (window as any).__mount());
		await wait(400);
		assert.deepEqual(await count(page), NONE, "accepted answer stays still after reload");
		await page.close();
	}
	// A wrong answer has no effect.
	{
		const page = await open(pendingQuiz);
		await answer(page, "Mars");
		await page.waitForSelector('[data-testid="answered-card"]');
		await wait(500);
		assert.deepEqual(await count(page), NONE, "wrong answer stays calm");
		await page.close();
	}
	// Reduced motion: only the chip's fade.
	{
		const page = await open(pendingQuiz, true);
		await answer(page, "Mercury");
		await page.waitForFunction(() => (window as any).__motion.some((m: any) => m.duration === 160), { timeout: 3000 });
		assert.deepEqual(await count(page), { pop: 0, glare: 0, sparks: 0, fade: 1 });
		await page.close();
	}
	// Practice: live solved, hints pop only; replayed and failed conclude stay still.
	const liveConclude = (outcome: string, opts: { timestamp?: string; isError?: boolean } = {}) => `const m=call('c1','conclude',{outcome:'${outcome}',verdict:'v'},${opts.timestamp ?? "Date.now()+500"});srv.stream=[{type:'agent_start'},{type:'message_start',message:m},{type:'message_end',message:m},{type:'tool_execution_end',toolCallId:'c1',toolName:'conclude',isError:${opts.isError ?? false},result:{content:[{type:'text',text:'ok'}],details:null}}];srv.afterStream=[m,{id:'r-c1',role:'toolResult',toolCallId:'c1',toolName:'conclude',content:[{type:'text',text:'ok'}],details:null,isError:${opts.isError ?? false},timestamp:Date.now()},{id:'a-after',role:'assistant',content:[{type:'text',text:'Дальше.'}],stopReason:'stop',timestamp:Date.now()}];`;
	for (const [outcome, opts, expected, why] of [
		["solved", {}, { pop: 1, glare: 0, sparks: 6, fade: 0 }, "solved celebrates"],
		["solvedWithHints", {}, { pop: 1, glare: 0, sparks: 0, fade: 0 }, "hints only pop"],
		["surrendered", {}, NONE, "surrender is calm"],
		["solved", { isError: true }, NONE, "a rejected conclude is no success"],
		["solved", { timestamp: String(OLD) }, NONE, "a replayed conclude is history"],
	] as const) {
		const page = await open(liveConclude(outcome, opts));
		await page.evaluate(() => (window as any).__emit("turn-started", { chatId: "synthetic" }));
		await page.waitForFunction(() => (window as any).__srv.afterStream.length === 0, { timeout: 4000 });
		if (!("isError" in opts)) await page.waitForSelector('[data-testid="conclude-card"]', { timeout: 4000 });
		await wait(500);
		assert.deepEqual(await count(page), expected, why);
		await page.close();
	}
	// Jobs: witnessed running → done pops; a job first seen done does not.
	{
		const job = (status: string) => `{id:'j1',kind:'research',chatId:'synthetic',toolCallId:'t1',input:{},status:'${status}',activity:[],createdAt:'2026-10-27T00:00:00Z',updatedAt:'2026-10-27T00:00:00Z'}`;
		const dispatch = `srv.messages.push(call('t1','research',{},1000),{id:'rt',role:'toolResult',toolCallId:'t1',toolName:'research',content:[{type:'text',text:'ack'}],details:'ack',isError:false,timestamp:1000});`;
		let page = await open(`${dispatch}srv.jobs=[${job("done")}];`);
		await page.waitForSelector('[data-testid="dispatch-settled"]');
		await wait(200);
		assert.deepEqual(await count(page), NONE, "history job is still");
		await page.close();
		page = await open(`${dispatch}srv.jobs=[${job("running")}];`);
		await page.waitForSelector('[data-testid="dispatch-card"]');
		await page.evaluate(`window.__srv.jobs=[${job("done")}];window.__emit("jobs-changed",{chatId:"synthetic"})`);
		await page.waitForSelector('[data-testid="dispatch-settled"]', { timeout: 3000 });
		await wait(100);
		assert.deepEqual(await count(page), { pop: 1, glare: 0, sparks: 0, fade: 0 }, "finished job pops once");
		await page.close();
	}
	// Press: immediate scale, keeps an edge click, never with reduced motion.
	for (const reduced of [false, true]) {
		const page = await open(pendingQuiz, reduced);
		const bar = await page.$('[data-testid="question-dock-bar"], [data-testid="teach-check-reveal"]');
		if (bar) await bar.click();
		await page.waitForSelector('[data-kbdrow="0"]');
		const row = await page.$('[data-kbdrow="0"]');
		const box = (await row!.boundingBox())!;
		const edge = { x: box.x + 1, y: box.y + box.height / 2 };
		await page.mouse.move(edge.x, edge.y);
		await page.mouse.down();
		await wait(100);
		const scale = await row!.evaluate(e => getComputedStyle(e).scale);
		assert.equal(scale, reduced ? "none" : "0.99", "press feedback");
		await page.mouse.up();
		assert.equal(await row!.evaluate(e => e.getAttribute("aria-checked")), "true", "edge click lands");
		await page.close();
	}
	// Input stays live through the effect: the composer takes typing right after.
	{
		const page = await open(pendingQuiz);
		await answer(page, "Mercury");
		await page.waitForFunction(() => (window as any).__motion.some((m: any) => m.duration === 450), { timeout: 3000 });
		await wait(150);
		const area = await page.waitForSelector("textarea, [contenteditable]");
		await area!.click();
		await page.keyboard.type("дальше");
		assert.equal(await area!.evaluate(e => (e as HTMLTextAreaElement).value ?? e.textContent), "дальше");
		await page.screenshot({ path: "work/ui-motion/success-frame.png" });
		await page.close();
	}
	// Sent message: rises once from the optimistic card; history never does.
	{
		const page = await open(`srv.messages.push({id:'u0',role:'user',content:'старое',timestamp:${OLD}},{id:'a0',role:'assistant',content:[{type:'text',text:'Ответ.'}],stopReason:'stop',timestamp:${OLD}});srv.postDelay=400;`);
		const rising = () => page.$$eval('[data-testid="user-message"]', e => e.map(n => getComputedStyle(n).animationName));
		assert.deepEqual(await rising(), ["none"]);
		const area = await page.waitForSelector("textarea, [contenteditable]");
		await area!.click();
		await page.keyboard.type("новое");
		await page.keyboard.press("Enter");
		await page.waitForFunction(() => document.querySelectorAll('[data-testid="user-message"]').length === 2);
		assert.deepEqual(await rising(), ["none", "lh-card-enter"]);
		await page.close();
	}
	// Dialogs and the fresh artifact: fade or pop on arrival, Esc and repeats stay immediate.
	for (const reduced of [false, true]) {
		const page = await open("", reduced);
		for (let i = 0; i < 3; i++) {
			await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true })); });
			const scrim = await page.waitForSelector(".lh-fade-in.fixed", { timeout: 2000 });
			assert.equal(await scrim!.evaluate(e => getComputedStyle(e).animationName), "chrome-fade-in");
			await page.keyboard.press("Escape");
			await page.waitForFunction(() => !document.querySelector(".lh-fade-in.fixed"), { timeout: 1000 });
		}
		await page.close();
	}
	{
		const job = (status: string, result = "") => `{id:'j2',kind:'demo',chatId:'synthetic',toolCallId:'t2',input:{},status:'${status}',activity:[],${result}createdAt:'2026-10-27T00:00:00Z',updatedAt:'2026-10-27T00:00:00Z'}`;
		const result = "result:{html:'<p>demo</p>',title:'d',notes:''},";
		const text = `srv.messages.push({id:'a2',role:'assistant',content:[{type:'text',text:'Смотри:\\n\\n[visual](lh-artifact:j2)\\n\\nДальше.'}],stopReason:'stop',timestamp:${OLD}});`;
		let page = await open(`${text}srv.jobs=[${job("done", result)}];`);
		await page.waitForSelector("iframe");
		assert.equal(await page.$(".lh-fade-in iframe"), null, "history demo has no fade wrapper");
		await page.close();
		page = await open(`${text}srv.jobs=[${job("running")}];`);
		await page.waitForFunction(() => document.body.innerText.includes("Подготовка визуализации"));
		await page.evaluate(`window.__srv.jobs=[${job("done", result)}];window.__emit("jobs-changed",{chatId:"synthetic"})`);
		await page.waitForSelector(".lh-fade-in iframe", { timeout: 3000 });
		await page.close();
	}
	assert.deepEqual(errors, []);
	console.log("motion feedback browser: PASS");
} finally {
	await browser.close();
	server.close();
}
