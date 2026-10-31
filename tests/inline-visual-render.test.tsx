import React from "react";
(globalThis as Record<string, unknown>).React = React;
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { InlineVisualText, referencedVisualJobs } from "../components/artifacts/inline-visual.tsx";
import { SubagentSteerCard } from "../components/artifacts/steer-card.tsx";
import { JobsContext } from "../components/jobs-context.ts";
import type { LhViewMessage, JobRecord } from "../src/core";

const result = { title: "Square", html: "<p>Square</p>", tested: true, format: "components-v1" as const };
const delivered: LhViewMessage = { id: "delivery", role: "user", metadata: { subagentResult: { jobId: "job_1", kind: "demo", toolCallId: "call_1" } }, parts: [{ type: "data-subagent-artifact", data: { kind: "demo", result } }] };
const text = "Before\n\n[visual](lh-artifact:job_1)\n\nAfter";

test("delivered visualization stays between paragraphs and suppresses its duplicate", () => {
	const message: LhViewMessage = { id: "teacher", role: "assistant", parts: [{ type: "text", text }] };
	const messages = [message, delivered];
	const html = renderToStaticMarkup(<InlineVisualText text={text} messages={messages} />);
	assert(html.indexOf("Before") < html.indexOf("<iframe"));
	assert(html.indexOf("<iframe") < html.lastIndexOf("After"));
	assert.match(html, /sandbox="allow-scripts"/);
	assert.match(html, /border-0 bg-transparent/);
	assert(!html.includes("demo-download"));
	assert.equal(renderToStaticMarkup(<SubagentSteerCard message={delivered} referencedJobs={referencedVisualJobs(messages)} />), "");
});

test("pending and failed inline slots never show legacy artifact chrome", () => {
	const job: JobRecord = { id: "job_1", kind: "demo", chatId: "chat", toolCallId: "call_1", status: "running", activity: "", createdAt: "", updatedAt: "" };
	const render = () => renderToStaticMarkup(<JobsContext.Provider value={[job]}><InlineVisualText text={text} messages={[]} /></JobsContext.Provider>);
	assert.match(render(), /Подготовка визуализации/);
	job.result = { ...result, html: "", notes: "Failed to render" };
	assert.match(render(), /Failed to render/);
	assert(!render().includes("demo-card"));
	assert.match(renderToStaticMarkup(<InlineVisualText text={text} messages={[]} />), /Визуализация недоступна/);
});
