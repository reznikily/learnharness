import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import puppeteer, { type Page } from "puppeteer-core";
import runtime from "../src/generated/visual-runtime.json" with { type: "json" };
import { visualDocument } from "../src/agent/subagents/visual-document.ts";
import { motionSource } from "./fixtures/visual-motion-source.ts";
import { followSource } from "./fixtures/visual-follow-source.ts";

// Keep the real card + chat scroller. Only detach the unrelated chat-page graph
// (its server-only crypto import cannot be bundled by this standalone fixture).
const bundle = await build({
	entryPoints: ["tests/fixtures/visual-motion.tsx"], bundle: true, write: false,
	platform: "browser", format: "iife", minify: true,
	define: { "process.env.NODE_ENV": '"production"' },
	plugins: [{ name: "chat-context", setup(b) {
		b.onResolve({ filter: /^@\/src\/core$/ }, () => ({ path: `${process.cwd()}/src/core/settings.ts` }));
		b.onResolve({ filter: /^@\/components\/chat$/ }, () => ({ path: "chat-context", namespace: "fixture" }));
		b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: 'import {createContext} from "react"; export const ChatActionsContext=createContext(null);', resolveDir: process.cwd() }));
	} }],
});
const fixtureHTML = (document: string, format?: string) => `<!doctype html><html class="dark"><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><style>body{margin:0}.fixture-chat{height:calc(100vh - 40px);max-width:800px;margin:auto}#theme{height:40px}</style><div id="fixture"></div><script>window.fixtureFormat=${JSON.stringify(format ?? null)};window.fixtureHTML=${JSON.stringify(document).replace(/</g, "\\u003c")}</script><script src="/fixture.js"></script></html>`;
const html = fixtureHTML(visualDocument(motionSource), "components-v1");
const legacy = fixtureHTML(`<!doctype html><body style="margin:8px"><button id="legacy-toggle" onclick="var c=document.getElementById('legacy-content');c.style.height=c.style.height==='800px'?'120px':'800px'">Изменить размер</button><div id="legacy-content" style="height:120px">Старый HTML</div></body>`);
const follow = fixtureHTML(visualDocument(followSource), "components-v1");
const legacyFollow = fixtureHTML(`<!doctype html><body style="margin:8px"><div id="legacy-rows" style="height:120px">Старый HTML</div><button id="next" onclick="var c=document.getElementById('legacy-rows');c.style.height=(parseInt(c.style.height)+200)+'px'">Следующий шаг</button><button id="reset" onclick="document.getElementById('legacy-rows').style.height='120px'">Сначала</button></body>`);
const server = createServer((req, res) => {
	res.setHeader("Content-Type", req.url === "/fixture.js" ? "text/javascript" : req.url === "/style.css" ? "text/css" : "text/html");
	res.end(req.url === "/fixture.js" ? bundle.outputFiles[0]!.text : req.url === "/style.css" ? runtime.css : req.url!.startsWith("/legacy-follow") ? legacyFollow : req.url!.startsWith("/legacy") ? legacy : req.url!.startsWith("/follow") ? follow : html);
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
if (process.argv.includes("--serve")) {
	console.log(url);
	await new Promise(() => {});
}

type Sample = { time: number; height: number; scroll: number; after: number };
async function startSamples(page: Page) {
	await page.evaluate(() => {
		const samples: Sample[] = [];
		const started = performance.now();
		const record = () => {
			const frame = document.querySelector("iframe")!;
			samples.push({ time: performance.now() - started, height: frame.getBoundingClientRect().height, scroll: document.querySelector('[role="log"] > div')!.scrollTop, after: document.querySelector("#after")!.getBoundingClientRect().top });
			if (performance.now() - started < 650) requestAnimationFrame(record);
		};
		(window as unknown as { samples: Sample[] }).samples = samples;
		record();
	});
}
async function samples(page: Page) {
	await new Promise(resolve => setTimeout(resolve, 700));
	return page.evaluate(() => (window as unknown as { samples: Sample[] }).samples);
}
function motionStats(frames: Sample[]) {
	return { start: frames[0]!.height, end: frames.at(-1)!.height, maxStep: Math.max(...frames.slice(1).map((f, i) => Math.abs(f.height - frames[i]!.height))), movingFrames: frames.slice(1).filter((f, i) => Math.abs(f.height - frames[i]!.height) > 0.1).length, scrollDrift: Math.max(...frames.map(f => Math.abs(f.scroll - frames[0]!.scroll))), maxFrameMs: Math.max(...frames.slice(1).map((f, i) => f.time - frames[i]!.time)) };
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
try {
	const page = await browser.newPage();
	// tsx preserves names in serialized evaluate callbacks via this helper.
	await page.evaluateOnNewDocument("window.__name = fn => fn");
	await page.setViewport({ width: 900, height: 850 });
	const errors: string[] = [];
	const metrics: Record<string, unknown> = { browser: await browser.version() };
	page.on("pageerror", e => { errors.push(String(e)); console.error(e); });
	page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
	await page.goto(url);
	assert.deepEqual(errors, []);
	const frame = await (await page.waitForSelector("iframe"))!.contentFrame();
	assert(frame);
	await frame.waitForSelector("#bulk");
	await page.evaluate(() => {
		(window as unknown as { resizeMessages: number[] }).resizeMessages = [];
		addEventListener("message", event => {
			if (event.source === document.querySelector("iframe")?.contentWindow && event.data?.type === "demo-resize")
				(window as unknown as { resizeMessages: number[] }).resizeMessages.push(event.data.height);
		});
	});
	await new Promise(resolve => setTimeout(resolve, 800));
	await page.evaluate(() => {
		const scroller = document.querySelector('[role="log"] > div')!;
		scroller.scrollTop += document.querySelector("iframe")!.getBoundingClientRect().top - 100;
	});
	await new Promise(resolve => setTimeout(resolve, 150));
	await frame.evaluate(() => {
		const positions: number[] = [];
		const start = performance.now();
		function record() {
			positions.push(document.getElementById("count")!.getBoundingClientRect().top);
			if (performance.now() - start < 650) requestAnimationFrame(record);
		}
		(window as unknown as { positions: number[] }).positions = positions;
		record();
	});
	await startSamples(page);
	await frame.click("#bulk");
	const growth = motionStats(await samples(page));
	metrics.growth = growth;
	console.log("growth", growth);
	assert(growth.end - growth.start > 600, "fixture must reproduce a large content resize");
	assert(growth.movingFrames >= 5, "large growth must spread over frames, not jump once");
	assert(growth.maxStep < (growth.end - growth.start) * 0.5, "no single-frame height jump");
	assert(growth.scrollDrift < 2, "reading beside demo must not move the chat scroll position");
	const positions = await frame.evaluate(() => (window as unknown as { positions: number[] }).positions);
	const innerSteps = positions.slice(1).filter((y, i) => Math.abs(y - positions[i]!) > 0.1).length;
	console.log("inner moving frames", innerSteps);
	assert(innerSteps >= 5, "content below added blocks must also move smoothly");
	metrics.innerMovingFrames = innerSteps;

	await startSamples(page);
	await frame.click("#bulk");
	const shrink = motionStats(await samples(page));
	metrics.shrink = shrink;
	console.log("shrink", shrink);
	assert(shrink.start - shrink.end > 600);
	assert(shrink.movingFrames >= 5, "removal must collapse smoothly");
	assert(shrink.maxStep < (shrink.start - shrink.end) * 0.5);
	assert(Math.abs(shrink.end - growth.start) <= 1, "exiting nodes must not leave stale iframe height");
	assert(shrink.scrollDrift < 2);
	assert.equal(await frame.$("[inert]"), null, "removed blocks must actually unmount after exit");

	await startSamples(page);
	for (let i = 0; i < 5; i++) {
		await frame.click("#bulk");
		await new Promise(resolve => setTimeout(resolve, 35));
	}
	const rapid = motionStats(await samples(page));
	metrics.rapid = rapid;
	assert.equal(await frame.$eval("#count", el => el.textContent), "Шагов: 6");
	assert(Math.abs(rapid.end - growth.end) <= 1, "interrupted resize must reach the latest target");
	assert(rapid.maxStep < 600, "retargeting must not restart from a stale height");
	const beforeQuiet = await page.evaluate(() => (window as unknown as { resizeMessages: number[] }).resizeMessages.length);
	await new Promise(resolve => setTimeout(resolve, 400));
	const messages = await page.evaluate(() => (window as unknown as { resizeMessages: number[] }).resizeMessages);
	metrics.resizeMessages = messages;
	assert.equal(messages.length, beforeQuiet, "no ResizeObserver/message feedback after settling");
	assert(messages.length < 16, "iframe animation must not report every intermediate viewport height");
	await page.evaluate(() => {
		const scroller = document.querySelector('[role="log"] > div')!;
		scroller.scrollTop += document.querySelector("#after")!.getBoundingClientRect().top - 60;
	});
	await new Promise(resolve => setTimeout(resolve, 150));
	assert(await page.evaluate(() => document.querySelector("iframe")!.getBoundingClientRect().bottom <= document.querySelector('[role="log"] > div')!.getBoundingClientRect().top), "reading-below scenario must put the entire demo above the viewport");
	await startSamples(page);
	await frame.$eval("#bulk", el => (el as HTMLButtonElement).click());
	const below = await samples(page);
	assert(Math.abs(below.at(-1)!.height - growth.start) <= 1, "offscreen demo must actually finish shrinking");
	const readingDrift = Math.max(...below.map(f => Math.abs(f.after - below[0]!.after)));
	metrics.readingBelowDrift = readingDrift;
	console.log("reading below", { readingDrift, start: below[0], end: below.at(-1) });
	assert(readingDrift <= 2, "resizing above the viewport must keep the paragraph being read anchored");

	await page.evaluate(() => {
		const scroller = document.querySelector('[role="log"] > div')!;
		scroller.scrollTop = scroller.scrollHeight;
	});
	await new Promise(resolve => setTimeout(resolve, 200));
	await frame.$eval("#bulk", el => (el as HTMLButtonElement).click());
	await new Promise(resolve => setTimeout(resolve, 900));
	assert(Math.abs(await page.$eval("iframe", el => el.getBoundingClientRect().height) - growth.end) <= 1, "offscreen growth must be reported");
	const bottomGap = await page.evaluate(() => { const el = document.querySelector('[role="log"] > div')!; return el.scrollHeight - el.clientHeight - el.scrollTop; });
	metrics.bottomGap = bottomGap;
	assert(bottomGap < 2, "chat must retain its existing stick-to-bottom behavior");
	await frame.$eval("#bulk", el => (el as HTMLButtonElement).click());
	await new Promise(resolve => setTimeout(resolve, 350));
	await page.evaluate(() => {
		const scroller = document.querySelector('[role="log"] > div')!;
		scroller.scrollTop += document.querySelector("iframe")!.getBoundingClientRect().top - 100;
	});
	await new Promise(resolve => setTimeout(resolve, 150));
	const frameBox = await (await page.$("iframe"))!.boundingBox();
	assert(frameBox);
	await page.mouse.move(frameBox.x + frameBox.width / 2, frameBox.y + 100);
	const beforeWheel = await page.$eval('[role="log"] > div', el => el.scrollTop);
	await page.mouse.wheel({ deltaY: 160 });
	await new Promise(resolve => setTimeout(resolve, 180));
	assert(await page.$eval('[role="log"] > div', el => el.scrollTop) > beforeWheel + 100, "wheel over demo must scroll the chat");
	assert.equal(await frame.evaluate(() => scrollY), 0, "iframe must not trap scrolling");
	await frame.focus("#add");
	await startSamples(page);
	await page.keyboard.press("Enter");
	const keyboard = motionStats(await samples(page));
	metrics.keyboard = keyboard;
	assert(keyboard.movingFrames <= 1, "keyboard actions must not acquire animated latency");
	assert.equal(await frame.evaluate(() => document.activeElement?.id), "add");
	await frame.focus("#remove");
	await page.keyboard.press("Enter");
	await new Promise(resolve => setTimeout(resolve, 350));

	await frame.evaluate(() => {
		const widths: number[] = [];
		const start = performance.now();
		function record() {
			widths.push(Number(document.querySelector("#square")!.getAttribute("width")));
			if (performance.now() - start < 350) requestAnimationFrame(record);
		}
		(window as unknown as { widths: number[] }).widths = widths;
		record();
	});
	await frame.click("#number");
	assert.equal(await frame.$eval("#value", el => el.textContent), "Площадь: 64", "exact feedback must update immediately");
	await new Promise(resolve => setTimeout(resolve, 400));
	const widths = await frame.evaluate(() => (window as unknown as { widths: number[] }).widths);
	assert(widths.some(w => w > 16 && w < 64), "SVG/Canvas parameter must interpolate for discrete changes");
	assert.equal(widths.at(-1), 64);
	metrics.geometry = widths;

	await frame.focus("#side");
	await page.keyboard.press("ArrowRight");
	assert.equal(await frame.$eval("#side", el => (el as HTMLInputElement).value), "9");
	assert.equal(await frame.$eval("#square", el => el.getAttribute("width")), "72", "keyboard input must bypass interpolation");
	await page.evaluate(() => document.documentElement.classList.remove("dark"));
	await frame.waitForFunction(() => !document.documentElement.classList.contains("dark"));
	assert.equal(await frame.$eval("#side", el => (el as HTMLInputElement).value), "9", "theme change must preserve state");
	assert.equal(await frame.evaluate(() => document.activeElement?.id), "side", "theme change must preserve focus");
	const slider = await (await frame.$("#side"))!.boundingBox();
	assert(slider);
	await page.mouse.move(slider.x + slider.width / 2, slider.y + slider.height / 2);
	await page.mouse.down();
	for (const fraction of [0.3, 0.7, 0.9]) {
		await page.mouse.move(slider.x + slider.width * fraction, slider.y + slider.height / 2);
		const direct = await frame.evaluate(() => ({ value: Number((document.getElementById("side") as HTMLInputElement).value), geometry: Number(document.getElementById("square")!.getAttribute("width")) }));
		assert.equal(direct.geometry, direct.value * 8, "pointer drag must never lag behind the thumb");
	}
	await page.mouse.up();

	for (const width of [320, 390, 768, 900]) {
		await page.setViewport({ width, height: 850, deviceScaleFactor: 2 });
		await new Promise(resolve => setTimeout(resolve, 350));
		const bounds = await frame.evaluate(() => ({ root: document.getElementById("root")!.offsetHeight, overflow: document.body.scrollWidth - innerWidth, width: innerWidth, canvas: document.querySelector("canvas")!.width, canvasDisplay: document.querySelector("canvas")!.getBoundingClientRect().width }));
		const height = await page.$eval("iframe", el => el.getBoundingClientRect().height);
		assert(bounds.overflow <= 1, `${width}px: no horizontal overflow`);
		assert(Math.abs(height - bounds.root) <= 1, `${width}px: frame must fit its content`);
		assert(bounds.canvas >= Math.round(bounds.canvasDisplay * 2) - 1, "canvas must remain sharp at device pixel ratio 2");
		metrics[`width${width}`] = bounds;
	}

	await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
	await startSamples(page);
	await frame.click("#bulk");
	const reduced = motionStats(await samples(page));
	metrics.reduced = reduced;
	assert(reduced.movingFrames <= 1, "reduced motion must disable height interpolation live");
	await frame.click("#number");
	assert.equal(await frame.$eval("#square", el => el.getAttribute("width")), "16", "reduced motion must disable geometry interpolation live");

	await mkdir("work/demo-motion", { recursive: true });
	await page.screenshot({ path: "work/demo-motion/wide.png" });
	await page.setViewport({ width: 390, height: 850, deviceScaleFactor: 2 });
	await new Promise(resolve => setTimeout(resolve, 350));
	await page.screenshot({ path: "work/demo-motion/narrow.png" });
	await frame.evaluate(() => document.getElementById("root")!.replaceChildren());
	await new Promise(resolve => setTimeout(resolve, 350));
	assert.equal(await page.$eval("iframe", el => el.clientHeight), 80, "removing all content must release the old frame height");

	await page.goto(`${url}/legacy`);
	const legacyFrame = await (await page.waitForSelector("iframe"))!.contentFrame();
	assert(legacyFrame);
	await legacyFrame.waitForSelector("#legacy-toggle");
	await page.waitForFunction(() => document.querySelector("iframe")!.clientHeight < 300);
	const legacyHeight = await page.$eval("iframe", el => el.clientHeight);
	await page.evaluate(() => { const scroller = document.querySelector('[role="log"] > div')!; scroller.scrollTop = scroller.scrollHeight; });
	await new Promise(resolve => setTimeout(resolve, 200));
	assert(await page.evaluate(() => document.querySelector("iframe")!.getBoundingClientRect().bottom <= document.querySelector('[role="log"] > div')!.getBoundingClientRect().top), "legacy regression must run offscreen");
	const legacyGrowStart = performance.now();
	await legacyFrame.$eval("#legacy-content", el => { (el as HTMLElement).style.height = "800px"; });
	await page.waitForFunction(() => document.querySelector("iframe")!.clientHeight > 800, { timeout: 3000 });
	const legacyGrowMs = performance.now() - legacyGrowStart;
	const legacyShrinkStart = performance.now();
	await legacyFrame.$eval("#legacy-content", el => { (el as HTMLElement).style.height = "120px"; });
	await page.waitForFunction(h => document.querySelector("iframe")!.clientHeight === h, { timeout: 3000 }, legacyHeight);
	metrics.legacyOffscreen = { growMs: legacyGrowMs, shrinkMs: performance.now() - legacyShrinkStart, restoredHeight: legacyHeight };

	await legacyFrame.click("#legacy-toggle");
	await page.waitForFunction(() => document.querySelector("iframe")!.clientHeight > 800);
	await legacyFrame.click("#legacy-toggle");
	await page.waitForFunction(h => document.querySelector("iframe")!.clientHeight === h, {}, legacyHeight);
	assert(await page.$('[data-testid="demo-download"]'), "legacy artifact controls remain available");

	// A visible demo the learner resizes at the chat bottom must stay put, not be chased by stick-to-bottom.
	// Tall enough that the whole short-tail demo, controls included, sits in view at the bottom.
	await page.setViewport({ width: 900, height: 1200 });
	await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
	const bottomPinned: Record<string, unknown> = {};
	for (const [path, control] of [["/?tail=short", "#bulk"], ["/legacy?tail=short", "#legacy-toggle"]] as const) {
		await page.goto(url + path);
		const demo = await (await page.waitForSelector("iframe"))!.contentFrame();
		assert(demo);
		await demo.waitForSelector(control);
		await new Promise(resolve => setTimeout(resolve, 800));
		const log = (await (await page.$('[role="log"] > div'))!.boundingBox())!;
		await page.mouse.move(log.x + 40, log.y + 80);
		for (let i = 0; i < 8; i++) { await page.mouse.wheel({ deltaY: 1500 }); await new Promise(resolve => setTimeout(resolve, 40)); }
		await new Promise(resolve => setTimeout(resolve, 400));
		const gap = () => page.$eval('[role="log"] > div', el => el.scrollHeight - el.clientHeight - el.scrollTop);
		assert(await gap() < 2, `${path}: scenario must start attached to the chat bottom`);
		const box = (await (await demo.$(control))!.boundingBox())!;
		const view = await page.$eval('[role="log"] > div', el => el.getBoundingClientRect().bottom);
		assert(box.y > log.y && box.y + box.height < view, `${path}: the control must be visible for a real click`);
		const top = () => page.$eval("iframe", el => el.getBoundingClientRect().top);
		const startTop = await top();
		const startHeight = await page.$eval("iframe", el => el.clientHeight);
		await page.evaluate(() => {
			const w = window as unknown as { tops: number[] };
			w.tops = [];
			const start = performance.now();
			const tick = () => { w.tops.push(document.querySelector("iframe")!.getBoundingClientRect().top); if (performance.now() - start < 800) requestAnimationFrame(tick); };
			tick();
		});
		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
		await new Promise(resolve => setTimeout(resolve, 900));
		const tops = await page.evaluate(() => (window as unknown as { tops: number[] }).tops);
		const grown = await page.$eval("iframe", el => el.clientHeight) - startHeight;
		const drift = Math.max(...tops.map(t => Math.abs(t - startTop)));
		bottomPinned[path] = { grown, drift, gapAfter: await gap() };
		console.log("visible demo at bottom", path, bottomPinned[path]);
		assert(grown > 400, `${path}: fixture must grow the visible demo`);
		assert(drift < 2, `${path}: a visible demo resized by the learner must keep its position`);
		assert(await gap() > grown - 50, `${path}: the grown demo extends below instead of dragging the chat`);
		// Back at the bottom, growth the learner did not cause (arrival, streaming) still follows the end.
		await page.mouse.move(log.x + 40, log.y + 80);
		for (let i = 0; i < 8; i++) { await page.mouse.wheel({ deltaY: 1500 }); await new Promise(resolve => setTimeout(resolve, 40)); }
		await new Promise(resolve => setTimeout(resolve, 400));
		assert(await gap() < 2, `${path}: wheeling back down re-attaches to the bottom`);
		await page.focus("#theme");
		await demo.$eval(control, el => (el as HTMLElement).click());
		await new Promise(resolve => setTimeout(resolve, 900));
		await demo.$eval(control, el => (el as HTMLElement).click());
		// The spring chase is the library's own pace; require it to arrive, not a fixed frame count.
		await page.waitForFunction(() => { const el = document.querySelector('[role="log"] > div')!; return el.scrollHeight - el.clientHeight - el.scrollTop < 2; }, { timeout: 2000 })
			.catch(async () => assert.fail(`${path}: unfocused growth keeps the existing stick-to-bottom (gap ${await gap()})`));
	}
	metrics.bottomPinned = bottomPinned;

	// The pressed control stays under the pointer while content ABOVE it grows or shrinks: the frame
	// and the chat scroll follow the runtime's 240 ms curve on the clock shared with the iframe.
	// Samples come from ResizeObserver callbacks (after every rAF callback, right before paint) in
	// both documents and are joined per frame, so they show what each frame actually paints.
	// Short enough that the transcript scrolls; the controls start in view at the chat bottom.
	await page.setViewport({ width: 900, height: 700 });
	const anchored: Record<string, unknown> = {};
	for (const path of ["/follow?tail=short", "/legacy-follow?tail=short"]) {
		await page.goto(url + path);
		const demo = await (await page.waitForSelector("iframe"))!.contentFrame();
		assert(demo);
		await demo.waitForSelector("#next");
		await demo.evaluate("window.__name = fn => fn");
		await new Promise(resolve => setTimeout(resolve, 800));
		const log = (await (await page.$('[role="log"] > div'))!.boundingBox())!;
		await page.mouse.move(log.x + 40, log.y + 80);
		for (let i = 0; i < 8; i++) { await page.mouse.wheel({ deltaY: 1500 }); await new Promise(resolve => setTimeout(resolve, 40)); }
		await new Promise(resolve => setTimeout(resolve, 400));
		assert(await page.$eval('[role="log"] > div', el => el.scrollTop > 0 && el.scrollHeight - el.clientHeight - el.scrollTop < 2), `${path}: scenario must start scrolled to the chat bottom`);
		const sample = async (control: string, act: (x: number, y: number) => Promise<void>) => {
			const box = (await (await demo.$(control))!.boundingBox())!;
			const view = await page.$eval('[role="log"] > div', el => el.getBoundingClientRect().bottom);
			assert(box.y > log.y && box.y + box.height < view, `${path}: ${control} must be visible for a real input`);
			const install = (record: string) => `(() => { const w = window; w.samples = []; let ts = 0; const probe = document.createElement("div"); probe.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none"; document.documentElement.append(probe); const ro = new ResizeObserver(() => w.samples.push([ts, ${record}])); ro.observe(probe); const start = performance.now(); const tick = now => { ts = Math.round(performance.timeOrigin + now); probe.style.width = probe.style.width === "1px" ? "2px" : "1px"; if (performance.now() - start < 900) requestAnimationFrame(tick); else { ro.disconnect(); probe.remove(); } }; requestAnimationFrame(tick); })()`;
			await demo.evaluate(install(`document.querySelector(${JSON.stringify(control)}).getBoundingClientRect().top`));
			await page.evaluate(install(`document.querySelector("iframe").getBoundingClientRect().top`));
			await new Promise(resolve => setTimeout(resolve, 50));
			await act(box.x + box.width / 2, box.y + box.height / 2);
			await new Promise(resolve => setTimeout(resolve, 1000));
			const inner = new Map(await demo.evaluate(() => (window as unknown as { samples: [number, number][] }).samples));
			const outer = await page.evaluate(() => (window as unknown as { samples: [number, number][] }).samples);
			const screen = outer.filter(([ts]) => inner.has(ts)).map(([ts, top]) => top + inner.get(ts)!);
			assert(screen.length > 30, `${path}: frames must be joinable across the documents`);
			return { maxDrift: +Math.max(...screen.map(y => Math.abs(y - screen[0]!))).toFixed(2), finalDrift: +(screen.at(-1)! - screen[0]!).toFixed(2) };
		};
		const height = () => page.$eval("iframe", el => el.clientHeight);
		const start = await height();
		const grow = await sample("#next", (x, y) => page.mouse.click(x, y));
		assert(await height() - start > 60, `${path}: fixture must grow content above the control`);
		const keyboard = await sample("#next", async () => { await demo.focus("#next"); await page.keyboard.press("Enter"); });
		const rapid = await sample("#next", async (x, y) => { for (let i = 0; i < 3; i++) { await page.mouse.click(x, y); await new Promise(resolve => setTimeout(resolve, 90)); } });
		const grown = await height();
		// Every input landed, including all three fast clicks at one screen point: 1 + 1 + 3 steps.
		if (path.startsWith("/follow")) assert.equal(await demo.$eval("#step", el => el.textContent), "Шаг 5");
		else assert.equal(grown - start, 5 * 200);
		const shrink = await sample("#reset", (x, y) => page.mouse.click(x, y));
		assert(grown - await height() > 200, `${path}: reset must shrink content above the control`);
		if (path.startsWith("/follow")) assert.equal(await demo.$eval("#step", el => el.textContent), "Шаг 0");
		anchored[path] = { grow, keyboard, rapid, shrink, grownBy: grown - start };
		console.log("anchored control", path, anchored[path]);
		for (const [name, run] of Object.entries({ grow, keyboard, rapid, shrink })) {
			assert(run.maxDrift < 8, `${path} ${name}: the control must stay under the pointer in every frame (max ${run.maxDrift}px)`);
			assert(Math.abs(run.finalDrift) < 2, `${path} ${name}: the control must settle where it was pressed`);
		}
	}
	metrics.anchoredControl = anchored;
	assert.deepEqual(errors, []);
	await writeFile("work/demo-motion/metrics.json", JSON.stringify(metrics, null, 2));
	console.log("PASS: resize, presence, interruptions, scroll, quiet bridge, SVG/Canvas, immediate keyboard/drag, theme/focus, widths, DPR, reduced motion, empty content, legacy HTML");
} finally {
	await browser.close();
	await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
}
