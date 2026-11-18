import React, { act } from "react";
(globalThis as { React?: typeof React }).React = React;
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { ToolContentResponse, MessageResponse } from "../components/ai-elements/message.tsx";
import { QuestionDock } from "../components/question-dock.tsx";
import { AnsweredCard } from "../components/answered-card.tsx";
import { QuestionPreview } from "../components/question-preview.tsx";
import { readContentSpans } from "../src/core/content-reader.ts";
import { repairMathForDisplay, parseQuizInput, parseAskInput, parseExplainInput, newAnswerResult,
	type QuestionAnswerData } from "../src/core/index.ts";

const body = [
	String.raw`print("\n")`,
	String.raw`path = "C:\\new\\notes"`,
	String.raw`pattern = r"\w+\s+\u0061"`,
	String.raw`quoted = "a\"b"`,
	String.raw`# $\nu$ and \begin{matrix}a&b\\c&d\end{matrix} are code, not math`,
].join("\n");
const fence = "```python\n" + body + "\n```";
const extraLayer = (source: string) => source.replaceAll("\n", "\\n");
const documentOf = (element: React.ReactElement) => parseHTML(`<html><body>${renderToStaticMarkup(element)}</body></html>`).document;

// Fork policy: recover structural newlines while preserving code literals.
// Upstream's JSON-layer decoding is deliberately not used in this fork.
test("fork recovery preserves quoted escapes and TeX commands", () => {
 const encoded = "```python\\n" + String.raw`print('\n')` + "\\n```";
 assert.equal(repairMathForDisplay(encoded), "```python\n" + String.raw`print('\n')` + "\n```");
 const tex = "```tex\\n" + String.raw`\nabla f \neq 0` + "\\n```";
 assert.equal(repairMathForDisplay(tex), "```tex\n" + String.raw`\nabla f \neq 0` + "\n```");
});

test("fully JSON-escaped quoted programs remain literal under fork policy", () => {
 const encoded = JSON.stringify(fence).slice(1, -1);
 assert.equal(repairMathForDisplay(encoded), encoded);
 assert.equal(readContentSpans(encoded).map(span => span.raw).join(""), encoded);
 assert.equal(repairMathForDisplay(fence), fence);
});

test("only tool presentation recovers code, and teaser output agrees with native Markdown", () => {
	const native = "Read the program.\n\n" + fence + "\n\nContinue.";
	const source = extraLayer(native);
	const recovered = documentOf(<ToolContentResponse mode="static">{source}</ToolContentResponse>);
	assert.equal(recovered.querySelectorAll('[data-testid="md-code"]').length, 1);
	assert.equal(recovered.querySelectorAll(".katex").length, 0, "math-like source inside code is literal");
	const ordinary = documentOf(<MessageResponse mode="static">{source}</MessageResponse>);
	assert.equal(ordinary.querySelectorAll('[data-testid="md-code"]').length, 0);
	const preview = documentOf(<QuestionPreview>{source}</QuestionPreview>);
	const expected = documentOf(<QuestionPreview>{native}</QuestionPreview>);
	assert.equal(preview.body.textContent, expected.body.textContent);
	assert.equal(preview.querySelectorAll('[data-testid="md-code"], button, pre').length, 0);
	assert.equal(preview.querySelector('[data-preview-cut="true"]') !== null, true);
});

test("pending → exact copy → submit → saved/answered copy never changes source or identities", async () => {
	const { window, document } = parseHTML("<html><body></body></html>");
	const previous = Object.getOwnPropertyDescriptors(globalThis);
	const copies: string[] = [];
	Object.assign(globalThis, { window, document, Element: window.Element, HTMLElement: window.HTMLElement,
		IS_REACT_ACT_ENVIRONMENT: true });
	Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (text: string) => { copies.push(text); } } } });
	const question = "Read the program.\\n\\n" + extraLayer(fence);
	const input = { question, options: [{ label: "Yes", value: "yes" }, { label: "No", value: "no" }], correctAnswer: "yes", explanation: question };
	const before = structuredClone(input);
	assert.equal(parseQuizInput(input)!.question, question);
	assert.equal(parseAskInput({ question })!.question, question);
	assert.equal(parseExplainInput({ question, correctAnswer: "yes" })!.question, question);
	let answer: QuestionAnswerData | undefined;
	const host = document.createElement("div"); document.body.append(host);
	const root = createRoot(host);
	try {
		await act(async () => root.render(<QuestionDock toolName="probe" toolCallId="escaped_code" input={input} expanded
			dictationClaim={false} onExpand={() => {}} onSubmit={result => { answer = result; }} />));
		const copy = () => host.querySelector<HTMLButtonElement>('[aria-label="Copy code"]')!;
		assert.ok(copy());
		await act(async () => copy().click());
		assert.equal(copies[0], body + "\n", "copied program is the native Markdown code source");
		assert.equal(host.querySelectorAll(".katex").length, 0);
		const yes = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(button => button.textContent?.includes("Yes"))!;
		await act(async () => yes.click());
		const submit = [...host.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.includes("Submit answer"))!;
		assert.equal(submit.disabled, false);
		await act(async () => submit.closest("form")!.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })));
		assert.ok(answer);
		assert.equal(answer.questionText, question);
		assert.equal(answer.explanation, question);
		assert.equal(answer.answers[0]!.value, "yes");
		assert.equal(answer.correct, true);
		const saved = JSON.parse(JSON.stringify(newAnswerResult("escaped_code", "probe", answer))).details;
		const savedBefore = structuredClone(saved);
		await act(async () => root.render(<AnsweredCard answer={saved} input={input} />));
		await act(async () => copy().click());
		assert.deepEqual(copies, [body + "\n", body + "\n"]);
		assert.deepEqual(saved, savedBefore);
		assert.deepEqual(input, before);
	} finally {
		await act(async () => root.unmount()); host.remove();
		for (const key of ["window", "document", "Element", "HTMLElement", "navigator", "IS_REACT_ACT_ENVIRONMENT"]) {
			if (previous[key]) Object.defineProperty(globalThis, key, previous[key]!);
			else Reflect.deleteProperty(globalThis, key);
		}
	}
});
