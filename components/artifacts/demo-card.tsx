"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { visualFonts } from "./visual-fonts";
import { DownloadIcon } from "lucide-react";
import { Toggle } from "@/components/settings/controls";
import { InvertDiscIcon } from "@/components/artifacts/invert-disc";
import { ChatActionsContext } from "@/components/chat";
import { ConversationScrollContext } from "@/components/ai-elements/conversation";
import { downloadFile, slugFilename } from "@/components/artifacts/download";
import { DispatchCard } from "@/components/artifacts/dispatch-card";
import type { ArtifactPartProps, DemoResult } from "@/src/core";

/**
 * Demo artifact card (W6): while the part is input-available, a job activity
 * card (the chat view's jobs feed — the job-card idiom); when output-available, the demo
 * runs in a SANDBOXED iframe (sandbox="allow-scripts", no allow-same-origin →
 * no access to app storage/cookies/DOM).
 *
 * The bridge script (contracts.ts "Demo iframe bridge") is auto-injected into
 * every demo by buildDemoSrcDoc — never the model's job: ResizeObserver →
 * postMessage {type:"demo-resize",height} (parent sizes the iframe) and
 * window.onerror → {type:"demo-error",message} (error chip on the card, with
 * a "Send to teacher" button that feeds the error back into the lesson — the
 * fix loop).
 *
 * Bridge message handling is a pure function (reduceDemoBridgeState) so
 * tests cover it without a DOM.
 */

// ─── bridge injection + message handling (pure, testable) ───────────────────

/** The runtime's Flow curve (components/visual-runtime/motion.tsx); the frame and scroll follow it. */
export const DEMO_RESIZE_MS = 240;
export const DEMO_RESIZE_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
/** How late the parent applies the bridge's follow plan: longer than a message hop plus a frame. */
export const DEMO_FOLLOW_HOLD_MS = 40;

/** CSS cubic-bezier(0.32, 0.72, 0, 1) at time fraction `t`, for the scroll that runs beside the frame animation. */
export function demoResizeEase(t: number): number {
	if (t <= 0) return 0;
	if (t >= 1) return 1;
	const curve = (a: number, b: number, u: number) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
	let low = 0;
	let high = 1;
	for (let i = 0; i < 24; i++) {
		const mid = (low + high) / 2;
		if (curve(0.32, 0, mid) < t) low = mid;
		else high = mid;
	}
	return curve(0.72, 1, (low + high) / 2);
}

export const DEMO_BRIDGE_SCRIPT = `<script>(function(){
var send=function(m){try{parent.postMessage(m,"*")}catch(e){}};
var lastHeight=0,queued=0,instant=false,disposed=false,changedAt=0,mutated=false,direct=false,renderedDirect=false;
// The control the learner is working with: the parent keeps it under the pointer while
// the demo resizes. Only changes shortly after input follow it; later ones keep the demo top.
var anchor=null,anchorTop=0,anchorUntil=0;
var layoutTop=function(el){var t=0;for(var n=el;n;n=n.offsetParent)t+=n.offsetTop;return t};
var hold=function(el){anchor=el instanceof HTMLElement&&el!==document.body&&el!==document.documentElement?el:null;if(anchor){anchorTop=layoutTop(anchor);anchorUntil=performance.now()+1000}};
var touch=function(){if(anchor)anchorUntil=performance.now()+1000};
// Follow plan shared with the parent: segments of the control's displacement, retargeted from
// the current value like the runtime's layout animation. The parent applies the plan HOLD ms
// late on the shared frame clock (it learns of a change only after a message hop); until then
// this document carries the difference, so the control never jumps in the frames in between.
var HOLD=${DEMO_FOLLOW_HOLD_MS},DUR=${DEMO_RESIZE_MS},segs=[],burst=0,carrying=0,painted=0,html=document.documentElement;
var ease=function(t){if(t<=0)return 0;if(t>=1)return 1;var lo=0,hi=1,u;for(var i=0;i<24;i++){u=(lo+hi)/2;if(3*0.32*u*(1-u)*(1-u)+u*u*u<t)lo=u;else hi=u}u=(lo+hi)/2;return 3*0.72*u*(1-u)*(1-u)+3*u*u*(1-u)+u*u*u};
var plan=function(t){for(var i=segs.length-1;i>=0;i--){var g=segs[i];if(g.s<=t)return g.from+(g.to-g.from)*(g.a?ease((t-g.s)/DUR):1)}return 0};
var carry=function(frameTime){
var last=segs[segs.length-1],d=last?plan(performance.timeOrigin+performance.now())-plan(frameTime-HOLD):0;
html.style.translate=Math.abs(d)<0.01?"":"0 "+(-d)+"px";
if(last&&frameTime-HOLD<last.s+(last.a?DUR:0)){if(!carrying)carrying=requestAnimationFrame(function(t){carrying=0;painted=performance.timeOrigin+performance.now();carry(performance.timeOrigin+t)})}
else html.style.translate="";
};
document.addEventListener("keydown",function(e){
var editable=e.target instanceof Element&&e.target.closest("input,textarea,select,[contenteditable]");
var activates=e.key===" "&&e.target instanceof Element&&e.target.closest("button,[role=button]");
if(!editable&&!activates&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","PageUp","PageDown","Home","End"," "].includes(e.key)){cancel();return}
instant=direct=true;if(document.activeElement!==anchor)hold(document.activeElement);else touch()},true);
document.addEventListener("input",function(){instant=direct=true;touch()},true);
// direct mirrors the runtime's directInput (motion.tsx); instant also covers frame width changes.
document.addEventListener("pointerdown",function(e){instant=direct=e.target instanceof Element&&!!e.target.closest("input,textarea,select,[contenteditable]");hold(e.target)},true);
document.addEventListener("click",touch,true);
document.addEventListener("change",touch,true);
// Scrolling the chat over the demo is manual input: it wins over the follow plan on both sides.
var cancel=function(notify){anchor=null;segs=[];html.style.translate="";if(notify!==false)send({type:"demo-follow-cancel"})};
// Input outside the sandbox must also clear its anchor, or a later resize restarts follow.
window.addEventListener("message",function(e){if(e.source===parent&&e.data&&e.data.type==="demo-follow-cancel")cancel(false)});
document.addEventListener("wheel",cancel,{capture:true,passive:true});
document.addEventListener("touchstart",cancel,{capture:true,passive:true});
var post=function(){
queued=0;
var at=changedAt;changedAt=0;
if(disposed)return;
var b=document.body;
if(!b)return;
var root=document.getElementById("root");
// components-v1 measures flow layout, never exiting/transformed children or the iframe viewport.
if(root&&root.hasAttribute("data-visual-root")&&!root.hasChildNodes()&&!lastHeight)return;
var h=root&&root.hasAttribute("data-visual-root")?root.offsetHeight:Math.max(b.scrollHeight,b.getBoundingClientRect().height);
var cs=getComputedStyle(b);
h+=(parseFloat(cs.marginTop)||0)+(parseFloat(cs.marginBottom)||0);
h=Math.max(1,Math.ceil(h));
var shift=0;
if(anchor&&(!anchor.isConnected||performance.now()>anchorUntil))anchor=null;
// offsetTop ignores the runtime's layout transforms: this is where the control settles.
if(anchor){var top=layoutTop(anchor);shift=top-anchorTop;anchorTop=top}
var follow=null;
if(shift){
var now=performance.timeOrigin+performance.now(),start=at||now,last=segs[segs.length-1];
if(last&&now-HOLD>last.s+(last.a?DUR:0)){segs=[];last=null}
if(!last)burst++;
// The runtime animates layout only when the previous commit rendered with layout on (it needs that snapshot).
var visual=!!root&&root.hasAttribute("data-visual-root")&&!direct&&!renderedDirect&&!matchMedia("(prefers-reduced-motion: reduce)").matches;
// An interrupted layout animation restarts from what the last frame painted (its snapshot).
follow={burst:burst,s:start,from:plan(last&&painted>last.s?Math.min(painted,start):start),to:(last?last.to:0)+shift,a:visual};
segs.push(follow);
carry(now);
}
if(mutated){renderedDirect=direct;mutated=false}
if(h!==lastHeight||shift){send({type:"demo-resize",height:h,motion:lastHeight>0&&!instant,shift:shift,at:at,follow:follow});lastHeight=h}
};
// Offscreen iframe rAF is suspended; a content mutation must still resize the transcript.
// The first trigger after a commit is when the runtime starts its layout animation (Motion's clock).
var schedule=function(){if(!changedAt)changedAt=performance.timeOrigin+performance.now();if(!queued&&!disposed){queued=1;queueMicrotask(post)}};
var resizeObserver=typeof ResizeObserver!=="undefined"?new ResizeObserver(schedule):null;
if(resizeObserver)resizeObserver.observe(document.body||document.documentElement);
var mutationOptions={childList:true,subtree:true,characterData:true};
// Legacy style-only changes must report offscreen; exclude components-v1's per-frame Motion styles.
var visualRoot=document.getElementById("root");
if(!visualRoot||!visualRoot.hasAttribute("data-visual-root")){mutationOptions.attributes=true;mutationOptions.attributeFilter=["style","class","hidden","open"]}
var mutationObserver=new MutationObserver(function(){mutated=true;schedule()});
mutationObserver.observe(document.body||document.documentElement,mutationOptions);
window.addEventListener("pagehide",function(e){if(!e.persisted){disposed=true;mutationObserver.disconnect();if(resizeObserver)resizeObserver.disconnect()}});
var width=innerWidth;
window.addEventListener("resize",function(){if(innerWidth!==width){width=innerWidth;instant=true;schedule()}});
window.addEventListener("load",schedule);
if(document.fonts){document.fonts.ready.then(schedule);document.fonts.addEventListener("loadingdone",schedule)}
window.addEventListener("error",function(e){send({type:"demo-error",message:e.message||String(e)})});
schedule();
})();</script>`;

/** Inject the bridge before </body> (or at the end of a body-less document). */
export function buildDemoSrcDoc(html: string): string {
	if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${DEMO_BRIDGE_SCRIPT}</body>`);
	return `${html}${DEMO_BRIDGE_SCRIPT}`;
}

export interface DemoBridgeState {
	height: number | null;
	error: string | null;
	motion: boolean;
}

export const INITIAL_DEMO_BRIDGE_STATE: DemoBridgeState = { height: null, error: null, motion: false };

const MIN_HEIGHT = 80;
/** Legacy HTML only: its body measurement can feed back through 100vh. A
 *  components-v1 demo measures its flow root and keeps its full height. */
const LEGACY_MAX_HEIGHT = 2400;

/** Pure reducer over incoming postMessage data (contracts.ts DemoBridgeMessage). */
export function reduceDemoBridgeState(state: DemoBridgeState, data: unknown, { inline = false }: { inline?: boolean } = {}): DemoBridgeState {
	if (typeof data !== "object" || data === null) return state;
	const message = data as { type?: unknown; height?: unknown; message?: unknown; motion?: unknown };
	if (message.type === "demo-resize") {
		if (typeof message.height !== "number" || !Number.isFinite(message.height) || message.height <= 0) return state;
		const height = Math.min(Math.max(Math.round(message.height), MIN_HEIGHT), inline ? Infinity : LEGACY_MAX_HEIGHT);
		const motion = state.height !== null && message.motion !== false;
		return height === state.height && motion === state.motion ? state : { ...state, height, motion };
	}
	if (message.type === "demo-error") {
		const text = typeof message.message === "string" && message.message.trim() ? message.message : "unknown error";
		return text === state.error ? state : { ...state, error: text };
	}
	return state;
}

// ─── the demo card ──────────────────────────────────────────────────────────

/** The demo tool-call box: the part's output is the dispatch ack — the box
 * is the DispatchCard (live status via the chat view's jobs feed). The demo
 * itself renders from the steer message via DemoOutputCard. */
export function DemoCard({ part }: ArtifactPartProps) {
	if (part.state !== "output-available") return null;
	return <DispatchCard toolCallId={part.toolCallId} kind="demo" />;
}

/** The demo artifact — exported: the steer card renders the delivered
 *  result. `messageId` + `initialInverted` carry the PERSISTED invert
 *  switch (details.ui.inverted via the artifact-ui route, owner 2026-10-07). */
export function DemoOutputCard({
	output,
	messageId,
	initialInverted = false,
}: {
	output: unknown;
	messageId?: string;
	initialInverted?: boolean;
}) {
	const result = output as DemoResult | undefined;
	if (!result || typeof result.html !== "string" || typeof result.title !== "string") {
		return (
			<div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
				Demo completed, but the result could not be displayed.
			</div>
		);
	}
	const failed = result.html.length === 0;
	if (failed) {
		return (
			<div className="rounded-xl border bg-card p-4 text-card-foreground" data-testid="demo-card-failed">
				<div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Interactive demo
					<span className="rounded bg-error/15 px-1.5 py-0.5 text-error">failed</span>
				</div>
				<p className="mt-2 text-sm text-muted-foreground">{result.notes ?? "The demo could not be built."}</p>
			</div>
		);
	}
	return (
		<DemoFrame inline={result.format === "components-v1"} title={result.title} html={result.html} messageId={messageId} initialInverted={initialInverted} />
	);
}

function DemoFrame({
	inline = false,
	title,
	html,
	messageId,
	initialInverted = false,
}: {
	inline?: boolean;
	title: string;
	html: string;
	messageId?: string;
	initialInverted?: boolean;
}) {
	const actions = useContext(ChatActionsContext);
	const conversation = useContext(ConversationScrollContext);
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const [state, setState] = useState<DemoBridgeState>(INITIAL_DEMO_BRIDGE_STATE);
	// Brightness inversion (owner, 2026-10-07): the switch state PERSISTS on
	// the steer record (details.ui.inverted) — seeded here, written through
	// the silent artifact-ui route on toggle. Without a chat page (tests,
	// previews) the toggle stays local-only. The filter rides the iframe
	// element, which carries the card's white backing, so one filter flips
	// page + content together while hue-rotate(180deg) undoes invert's hue
	// flip.
	const [inverted, setInverted] = useState(initialInverted);
	const toggleInverted = (next: boolean) => {
		setInverted(next);
		if (!actions?.chatId || !messageId) return;
		void fetch(`/api/chats/${actions.chatId}/artifact-ui`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ input: { messageId, inverted: next } }),
		}).catch(() => {});
	};
	useEffect(() => {
 if(!inline)return;
 const send=()=>{void visualFonts().then(css=>iframeRef.current?.contentWindow?.postMessage({type:'visual-fonts',css},'*'));const tokens:Record<string,string>={};const css=getComputedStyle(document.documentElement);for(let i=0;i<css.length;i++){const k=css[i];if(k?.startsWith('--'))tokens[k]=css.getPropertyValue(k);}
 iframeRef.current?.contentWindow?.postMessage({type:'visual-theme',tokens,dark:document.documentElement.classList.contains('dark')},'*');};
 const observer=new MutationObserver(send);observer.observe(document.documentElement,{attributes:true,attributeFilter:['class','style']});
 const frame=iframeRef.current;frame?.addEventListener('load',send);send();return()=>{observer.disconnect();frame?.removeEventListener('load',send);};
 },[inline]);
 const srcDoc = useMemo(() => buildDemoSrcDoc(html), [html]);

	useEffect(() => {
		const frame = iframeRef.current;
		if (!frame) return;
		let anchor: { scroller: HTMLElement; bottom: number; height: number } | null = null;
		// The first reported height is the demo's arrival, which follows the bottom as before.
		let measured = false;
		// Keeps the control the learner pressed under the pointer while the demo resizes. The
		// bridge sends its plan (segments of the control's displacement on the runtime's curve);
		// the scroll and the frame height apply it DEMO_FOLLOW_HOLD_MS late on the frame clock
		// shared with the iframe, which carries the difference until then.
		type Segment = { s: number; from: number; to: number; a: boolean };
		let plan: { burst: number; moves: Segment[]; heights: Segment[]; scroller: HTMLElement | null; base: number; written: number } | null = null;
		let loop = 0;
		let cancelledAt = -Infinity;
		const at = (segments: Segment[], time: number, fallback: number) => {
			for (let i = segments.length - 1; i >= 0; i--) {
				const g = segments[i]!;
				if (g.s <= time) return g.from + (g.to - g.from) * (g.a ? demoResizeEase((time - g.s) / DEMO_RESIZE_MS) : 1);
			}
			return fallback;
		};
		const end = (segments: Segment[]) => {
			const last = segments.at(-1);
			return last ? last.s + (last.a ? DEMO_RESIZE_MS : 0) : -Infinity;
		};
		const stopFollow = () => {
			cancelledAt = performance.timeOrigin + performance.now();
			if (plan) plan.scroller = null;
		};
		const releaseAnchor = () => {
			anchor = null;
			stopFollow();
			frame.contentWindow?.postMessage({ type: "demo-follow-cancel" }, "*");
		};
		const findScroller = () => {
			for (let scroller = frame.parentElement; scroller; scroller = scroller.parentElement) {
				if (/^(auto|scroll)$/.test(getComputedStyle(scroller).overflowY)) return scroller;
			}
			return null;
		};
		const step = (frameTime: number) => {
			loop = 0;
			if (!plan) return;
			const time = performance.timeOrigin + frameTime - DEMO_FOLLOW_HOLD_MS;
			frame.style.height = `${at(plan.heights, time, plan.heights[0]?.from ?? frame.clientHeight)}px`;
			const { scroller } = plan;
			if (scroller) {
				// The learner scrolled meanwhile: manual input wins. A clamp at the end of the content is not input.
				const clamped = plan.written > scroller.scrollTop && scroller.scrollTop >= scroller.scrollHeight - scroller.clientHeight - 1;
				if (Math.abs(scroller.scrollTop - plan.written) > 1 && !clamped) plan.scroller = null;
				else {
					scroller.scrollTop = plan.base + at(plan.moves, time, 0);
					plan.written = scroller.scrollTop;
					// Programmatic: a scroll down near the end must not re-engage the bottom lock.
					const scroll = conversation?.current;
					if (scroll?.scrollRef.current === scroller) scroll.state.ignoreScrollToTop = plan.written;
				}
			}
			if (time < Math.max(end(plan.moves), end(plan.heights))) loop = requestAnimationFrame(step);
			else {
				// Commit the settled height only now: an early smaller value would clamp the scroll at the end of the chat.
				const settled = plan.heights.at(-1)?.to;
				plan = null;
				if (settled !== undefined) setState((prev) => reduceDemoBridgeState(prev, { type: "demo-resize", height: settled, motion: false }, { inline }));
			}
		};
		const observer = new ResizeObserver(() => {
			if (!anchor) return;
			// Native scroll anchoring can lose the reading position when a focused
			// offscreen iframe shrinks. Correct only the unhandled displacement.
			const drift = frame.getBoundingClientRect().bottom - anchor.bottom;
			if (Math.abs(drift) >= 1) anchor.scroller.scrollTop += drift;
			if (Math.abs(frame.clientHeight - anchor.height) <= 1) anchor = null;
		});
		observer.observe(frame);
		const onMessage = (event: MessageEvent) => {
			// Only messages from THIS demo's iframe (the sandbox gives it an
			// opaque origin; the window reference still matches).
			if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
			if ((event.data as { type?: unknown } | null)?.type === "demo-follow-cancel") { anchor = null; stopFollow(); return; }
			let data = event.data as { shift?: unknown; motion?: unknown; follow?: unknown } | null;
			const height = reduceDemoBridgeState(INITIAL_DEMO_BRIDGE_STATE, data, { inline }).height;
			const resizing = height !== null && Math.abs(frame.clientHeight - height) > 1;
			const shift = typeof data?.shift === "number" && Number.isFinite(data.shift) ? data.shift : 0;
			const scroll = conversation?.current;
			const scroller = scroll?.scrollRef.current ?? findScroller();
			const view = scroller?.getBoundingClientRect();
			const box = frame.getBoundingClientRect();
			const visible = !!view && box.bottom > view.top && box.top < view.bottom;
			// The learner is working in this visible demo: its resize must not
			// drag the transcript to the bottom. Release the lock like a scroll up;
			// native scroll anchoring then keeps the demo top where it is.
			if (resizing && measured && visible && (shift || document.activeElement === frame) && scroll?.state.isAtBottom) scroll.stopScroll();
			const segment = data?.follow as (Segment & { burst: number }) | null | undefined;
			// A queued iframe report can arrive after manual input cancelled its plan.
			const follows = !!segment && Number.isFinite(segment.s) && segment.s > cancelledAt && Number.isFinite(segment.to) && measured && visible && !!scroller;
			// While the frame runs on the plan's clock, later reports retarget it there too.
			if (height !== null && measured && (follows || plan)) {
				// A CSS height transition from an earlier resize hands over at its current height.
				const current = frame.clientHeight;
				for (const running of frame.getAnimations()) running.cancel();
				if (follows && segment && scroller && segment.burst !== plan?.burst) {
					plan = { burst: segment.burst, moves: [], heights: [], scroller, base: scroller.scrollTop, written: scroller.scrollTop };
				}
				if (plan) {
					const start = follows && segment ? segment.s : performance.timeOrigin + performance.now();
					const visual = follows && segment ? segment.a : inline && data?.motion === true && !matchMedia("(prefers-reduced-motion: reduce)").matches;
					if (follows && segment) plan.moves.push({ s: segment.s, from: segment.from, to: segment.to, a: segment.a });
					plan.heights.push({ s: start, from: plan.heights.length ? at(plan.heights, start, current) : current, to: height, a: visual });
					if (!loop) loop = requestAnimationFrame(step);
				}
				// The frame moves on the plan's clock; its height reaches state when the plan settles.
				if (plan) data = null;
			}
			if (height !== null) measured = true;
			if (resizing && scroller) {
				const bottom = frame.getBoundingClientRect().bottom;
				if (bottom <= scroller.getBoundingClientRect().top && scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop > 2) {
					anchor = { scroller, bottom, height };
				}
			}
			const message = data;
			if (message) setState((prev) => reduceDemoBridgeState(prev, message, { inline }));
		};
		const inputs = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
		for (const type of inputs) window.addEventListener(type, releaseAnchor, { capture: true, passive: true });
		window.addEventListener("message", onMessage);
		return () => {
			observer.disconnect();
			cancelAnimationFrame(loop);
			for (const type of inputs) window.removeEventListener(type, releaseAnchor, true);
			window.removeEventListener("message", onMessage);
		};
	}, [conversation, inline]);

	return (
		<div className={inline ? "my-3 w-full" : "rounded-xl border bg-card p-4 text-card-foreground"} data-testid="demo-card">
			{/* Caption header (owner, 2026-10-07): kind label + title in the
			   label's size/tracking (title normal-case, foreground) — the
			   figure card's grammar plus a name. Switch + download far right. */}
			{!inline && <div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-baseline gap-2">
					<span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						interactive demo
					</span>
					<span className="truncate text-xs font-medium tracking-wide text-foreground">{title}</span>
				</div>
				<div className="flex shrink-0 items-center gap-1.5">
					<Toggle
						checked={inverted}
						onChange={toggleInverted}
						label="Invert demo brightness"
						title="Invert colors"
						discIcon={<InvertDiscIcon className="size-3" />}
					/>
					<button
						type="button"
						aria-label="Download demo as HTML"
						title="Download as HTML"
						onClick={() => downloadFile(`${slugFilename(title)}.html`, html, "text/html")}
						data-testid="demo-download"
						className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						<DownloadIcon className="size-3.5" />
					</button>
				</div>
			</div>}
			{state.error && (
				<DemoErrorChip
					title={title}
					message={state.error}
					onSend={actions ? () => actions.sendText(`The demo "${title}" threw an error: ${state.error}`) : undefined}
				/>
			)}
			<iframe
				ref={iframeRef}
				title={title}
				// allow-scripts ONLY — no allow-same-origin: the demo can run code
				// but never touch the app's storage, cookies, or DOM.
				sandbox="allow-scripts"
				srcDoc={srcDoc}
				// scrolling OFF (owner, 2026-10-07): the bridge auto-sizes the
				// iframe to its content, so an internal scrollbar can only appear
				// before the first resize lands — and a scrollable iframe TRAPS
				// the wheel (session scrolling stalls over the demo). With
				// scrolling disabled the wheel chains straight to the session.
				scrolling="no"
				className={`${inline ? "block w-full border-0 bg-transparent" : "mt-2 w-full rounded-lg border bg-white"} motion-reduce:!transition-none`}
				// content-box: the bridge reports the CONTENT height — with the
				// preflight's border-box the 2px border would eat into it and clip
				// the bottom of the demo (smoke finding, 2026-10-07).
				style={{
					height: state.height ?? 360,
					// Flow height must move with the transcript; a transform would overlap the next paragraph.
					transition: state.motion ? `height ${DEMO_RESIZE_MS}ms ${DEMO_RESIZE_EASING}` : "none",
					boxSizing: "content-box",
					filter: inverted ? "invert(1) hue-rotate(180deg)" : undefined,
				}}
				data-testid="demo-iframe"
			/>
		</div>
	);
}

export function DemoErrorChip({
	title,
	message,
	onSend,
}: {
	title: string;
	message: string;
	onSend?: () => void;
}) {
	return (
		<div
			className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error"
			data-testid="demo-error-chip"
		>
			<span className="font-medium">This demo threw an error</span>
			<span className="min-w-0 flex-1 truncate font-mono text-xs" title={message}>
				{message}
			</span>
			{onSend && (
				<button
					type="button"
					onClick={onSend}
					className="rounded-md border border-error/40 px-2 py-1 text-xs font-medium hover:bg-error/15"
					data-testid="demo-error-send"
				>
					Send to teacher
				</button>
			)}
		</div>
	);
}
